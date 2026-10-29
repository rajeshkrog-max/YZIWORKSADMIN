import { useCallback, useEffect, useRef, useState } from 'react'
import { isMockMode } from '../services/seraAuthService'
import { createMockCall, getDevState, MOCK_REPORT_DELAY_MS, saveMockSession, setDev } from '../services/seraMockCall'
import { markCandidateEnded, reportConnectionLost } from '../services/seraSessionService'
import { saveOfferChoice } from '../services/seraOffersService'
import { prepareResume } from '../services/seraResumeService'
import { fetchCallState, fetchReport, releaseReservation, startInterviewCall } from '../services/seraCallService'
import { createSession, patchRound } from '../shared/seraSession'
import { buildCallVariables } from '../../netlify/lib/seraCall/variables.js'
import { isShowOffersMessage } from '../../netlify/lib/seraVapi/clientEvents.js'
import { roundOfAssistantName } from '../../netlify/lib/seraVapi/squad.js'
import { OFFER_PICK_SECONDS, roundsFor } from '../config/seraRounds'
import { clearSessionId, fetchServerSession, loadSessionId, saveSessionId } from '../services/seraRestoreService'
import { resumePoint } from '../shared/seraResumePoint'
import { checkMicrophone } from '../utils/micCheck'

// @vapi-ai/web is a CommonJS package (`exports.default = Vapi`). Depending on the bundler's
// interop, `import()` hands back the class, or a module object holding it one level down
// (`default.default`) — `new` on that object throws "r is not a constructor". Take whichever is the class.
export async function loadVapiClass() {
  const mod = await import('@vapi-ai/web')
  const Vapi = [mod.default?.default, mod.default, mod.Vapi].find((candidate) => typeof candidate === 'function')
  if (!Vapi) throw new Error('The voice client failed to load. Please refresh and try again.')
  return Vapi
}

const TURN_SECONDS = 35
// The squad runs as ONE call, and the SERVER runs its rounds (it sends Vinit and Sonia their "time is
// nearly up / time is up" notes and ends the call). The page only SHOWS where we are and follows the
// server and Vapi's own messages. No timer here ever stops the call: an earlier version did, and it cut
// Sonia off mid-sentence because the clocks drifted from the real conversation. These only move the SCREEN
// along if a signal never arrives:
const OFFERS_FALLBACK_SECONDS = 60 // Sera never called show_offers: show the cards anyway
const HR_UI_GRACE_SECONDS = 45 // no sign of Sonia long after HR's time: show the final round
const CLOCK_START_FALLBACK_MS = 8000 // no speech event after the call connects: start the clock anyway
// Wrap-up: after the report arrives, the last checklist tick + fade before showing it.
const REPORT_FADE_MS = 900
// HR → Final: a short "Connecting you to the final round with Sonia…" hand-over.
const CONNECT_MS = 2500

// If the candidate's turn timer sits pegged at TURN_SECONDS this long with
// no assistant speech starting, the call is treated as stalled/dropped
// rather than the candidate just running long (the prompts already
// enforce the real cutoff — this is purely a client-side dead-call guard).
const STALL_GRACE_SECONDS = 15
// A stall this early almost certainly means the call never really started —
// don't burn the candidate's one-per-login slot over it.
const STALL_FORGIVENESS_WINDOW_SECONDS = 90

// Screens: hero | signin | upload | preparing | pay | interview | wrapup | report | restart | blocked | lost
// `restart` = the call was lost before the offers; the server allows ONE free restart (spec 0002).
// `lost` = DEV mock only now: a real lost call goes to wrapup, where the server's decision arrives.
// `pay` is New User-only (route 'visitor'): students go from preparing straight to the interview.
//
// All interview DATA lives in one `session` (src/shared/seraSession.js); the
// rest of the state here is UI only (screen, timers, busy/error).
export function useSeraInterview() {
  const [screen, setScreen] = useState('hero')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const [session, setSession] = useState(null)
  const sessionRef = useRef(null)
  const [resumeFile, setResumeFile] = useState(null)

  const [elapsed, setElapsed] = useState(0)
  const [turnState, setTurnState] = useState('sera-speaking') // sera-speaking | your-turn | wrapping-up
  const [turnElapsed, setTurnElapsed] = useState(0)
  const [muted, setMuted] = useState(false)
  const [reportReady, setReportReady] = useState(false) // wrap-up checklist: last step ticks only when true
  const [incomplete, setIncomplete] = useState(false)
  const [blockedMessage, setBlockedMessage] = useState(null)

  const vapiRef = useRef(null)
  const callActiveRef = useRef(false) // a Vapi call is connected and its end hasn't been handled
  const liveRef = useRef({}) // latest handlers, for timers and Vapi events (see the effect below)
  const offerTimerRef = useRef(null)
  const offersPollRef = useRef(null)
  const clockStartedRef = useRef(false) // the first clock starts when Sera is actually audible
  const clockFallbackRef = useRef(null)
  const offerPickedRef = useRef(false)
  const [offerSecondsLeft, setOfferSecondsLeft] = useState(null) // the 45 s cap on the offer pick
  const sessionTimerRef = useRef(null)
  const turnActiveRef = useRef(false)
  const elapsedRef = useRef(0)
  const callStartedRef = useRef(false) // Vapi reported the call started (for "never got going" vs "dropped")
  const stalledExtraSecondsRef = useRef(0)
  const turnElapsedRef = useRef(0)
  // Rounds (src/config/seraRounds.js): index into the route's rounds.
  const [roundIndex, setRoundIndex] = useState(0)
  const roundIndexRef = useRef(0)
  const candidateEndedRef = useRef(false)
  const restartRef = useRef(false) // the current call is the interview's one free restart
  const preparedFileRef = useRef(null) // the file the stored offers were built from (a retry never re-reads it)
  const [connectingTo, setConnectingTo] = useState(null) // next round during the HR → Final hand-over
  const [lostInfo, setLostInfo] = useState(null) // { rejoinIssued } on the lost screen
  // DEV ONLY — the simulated call in mock mode (seraMockCall).
  const mockCallRef = useRef(null)
  const mockConnectTimerRef = useRef(null)
  const toReportRef = useRef(null)

  // Synchronous update: the ref is current immediately (timers and mock
  // callbacks read it before React re-renders).
  const updateSession = useCallback((update) => {
    const next = typeof update === 'function' ? update(sessionRef.current) : update
    sessionRef.current = next
    setSession(next)
    return next
  }, [])

  const reset = useCallback(() => {
    clearSessionId()
    setScreen('hero')
    setError(null)
    setBusy(false)
    updateSession(null)
    setResumeFile(null)
    setElapsed(0)
    setTurnState('sera-speaking')
    setTurnElapsed(0)
    turnActiveRef.current = false
    setMuted(false)
    setReportReady(false)
    setIncomplete(false)
    setBlockedMessage(null)
    setRoundIndex(0)
    roundIndexRef.current = 0
    candidateEndedRef.current = false
    setLostInfo(null)
    setConnectingTo(null)
    if (import.meta.env.DEV) {
      mockCallRef.current?.stop()
      mockCallRef.current = null
      clearTimeout(mockConnectTimerRef.current)
    }
    if (sessionTimerRef.current) clearInterval(sessionTimerRef.current)
    clearInterval(offerTimerRef.current)
    clearInterval(offersPollRef.current)
    clearTimeout(clockFallbackRef.current)
    offerPickedRef.current = false
    setOfferSecondsLeft(null)
    callActiveRef.current = false
    vapiRef.current?.stop().catch(() => {})
    vapiRef.current = null
  }, [updateSession])

  const goToSignIn = useCallback(() => setScreen('signin'), [])

  // Login from the glass card (SeraLogin): { route, firstName, email, phone, studentCode }.
  // A login the server matched to this email's existing interview (`resumed`) reopens it where it is.
  const completeLogin = useCallback(
    (login, { resumed = false } = {}) => {
      setError(null)
      if (login.sessionId) saveSessionId(login.sessionId)
      if (resumed && login.sessionId) {
        liveRef.current.restoreSession?.(login.sessionId, { fallback: login })
        return
      }
      const fresh = createSession(login)
      // A verified payment this email has not used yet (paid in an earlier tab): never ask again.
      updateSession(login.payment?.paymentId ? { ...fresh, payment: login.payment, status: 'reserved' } : fresh)
      setScreen('upload')
    },
    [updateSession]
  )

  const selectFile = useCallback((file, message) => {
    setError(message || null)
    setResumeFile(file)
  }, [])

  const stopSessionTimer = useCallback(() => {
    if (sessionTimerRef.current) {
      clearInterval(sessionTimerRef.current)
      sessionTimerRef.current = null
    }
  }, [])

  const handleStalledCall = useCallback(() => {
    // We're stopping the call ourselves here, which would otherwise also
    // fire the SDK's own call-end event and race finishInterview() into
    // overwriting the 'upload' screen we're about to set.
    callActiveRef.current = false
    stopSessionTimer()
    vapiRef.current?.stop().catch(() => {})
    // The server only forgives a start that stalled in its first 90 seconds (and ends that call). Otherwise
    // the call's end decides: a free restart before the offers, or the report on what was said.
    if (elapsedRef.current >= STALL_FORGIVENESS_WINDOW_SECONDS) return liveRef.current.finishInterview?.()
    setError("Sera's having a connection hiccup — let's try that again.")
    if (restartRef.current) updateSession((s) => ({ ...s, status: 'restart_available' }))
    setScreen(restartRef.current ? 'restart' : 'upload')
    releaseReservation(sessionRef.current).then((released) => {
      if (!released) liveRef.current.finishInterview?.()
    })
  }, [stopSessionTimer, updateSession])

  const finishInterview = useCallback(async () => {
    stopSessionTimer()
    setReportReady(false)
    setScreen('wrapup')

    // The report is generated exactly once, server-side, after the final
    // round — never here. Polling a cheap read-only endpoint means every
    // interview costs one analysis call, not two.
    // Every 2 s for the first minute, then every 5 s: a report (and its one retry) can take a few minutes.
    const MAX_WAIT_MS = 6 * 60 * 1000
    const started = Date.now()

    for (let attempt = 0; Date.now() - started < MAX_WAIT_MS; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, attempt < 30 ? 2000 : 5000))
      const result = await fetchReport(sessionRef.current)
      if (!result.ready) continue
      if (result.restart) {
        // The call was lost before the offers: the server offers one free restart (spec 0002).
        updateSession((s) => ({ ...s, status: 'restart_available' }))
        setScreen('restart')
        return
      }
      if (result.incomplete) {
        setIncomplete(result.reason === 'failed' ? 'failed' : true)
        setScreen('report')
        return
      }
      if (result.report) {
        updateSession((s) => ({ ...s, report: result.report, status: 'completed' }))
        setReportReady(true) // final checklist tick, then a short fade into the report
        await new Promise((resolve) => setTimeout(resolve, REPORT_FADE_MS))
        setScreen('report')
        return
      }
    }
    // Nothing is lost: the report is saved on the server and the login reopens it.
    setError("Your report is taking longer than usual. It's saved — refresh this page in a few minutes, or sign in again later with the same Google account to see it.")
    setScreen('report')
  }, [stopSessionTimer, updateSession])

  // Shows the clock for one timed round. The call itself is never stopped by a
  // clock (it is ONE call for all rounds): liveRef.onClockTick only runs safety nets.
  const startRoundClock = useCallback(
    (seconds) => {
      stopSessionTimer()
      setElapsed(0)
      elapsedRef.current = 0
      stalledExtraSecondsRef.current = 0
      turnElapsedRef.current = 0

      sessionTimerRef.current = setInterval(() => {
        elapsedRef.current += 1
        const next = elapsedRef.current
        setElapsed(next)
        if (next >= seconds - 25) setTurnState('wrapping-up')
        liveRef.current.onClockTick?.(next)

        if (turnActiveRef.current) {
          if (turnElapsedRef.current >= TURN_SECONDS) {
            stalledExtraSecondsRef.current += 1
            if (stalledExtraSecondsRef.current > STALL_GRACE_SECONDS) handleStalledCall()
          } else {
            stalledExtraSecondsRef.current = 0
            turnElapsedRef.current += 1
            setTurnElapsed(turnElapsedRef.current)
          }
        }
      }, 1000)
    },
    [handleStalledCall, stopSessionTimer]
  )

  // Moves the page to round `index` (a timed round restarts the clock; the offer
  // pick has no clock).
  const enterRound = useCallback(
    (index) => {
      const round = roundsFor(sessionRef.current?.route)[index]
      roundIndexRef.current = index
      setRoundIndex(index)
      turnActiveRef.current = false
      turnElapsedRef.current = 0
      setTurnElapsed(0)
      setTurnState('sera-speaking')
      if (round?.seconds) startRoundClock(round.seconds)
      else {
        stopSessionTimer()
        setElapsed(0)
        elapsedRef.current = 0
      }
    },
    [startRoundClock, stopSessionTimer]
  )

  // The 45 s cap on the offer pick: the call is open but silent, so this is cost
  // control. At zero the first offer is chosen for the candidate.
  const startOfferCountdown = useCallback(() => {
    clearInterval(offerTimerRef.current)
    offerPickedRef.current = false
    let left = OFFER_PICK_SECONDS
    setOfferSecondsLeft(left)
    offerTimerRef.current = setInterval(() => {
      left -= 1
      setOfferSecondsLeft(left)
      if (left > 0) return
      clearInterval(offerTimerRef.current)
      const first = sessionRef.current?.offers?.[0]
      if (first) liveRef.current.chooseOffer?.(first)
    }, 1000)
  }, [])

  // The candidate tapped a tile: stop the countdown now (the tile's exit
  // animation runs before chooseOffer fires, so the cap must not pick over them).
  const holdOfferTimer = useCallback(() => {
    clearInterval(offerTimerRef.current)
    setOfferSecondsLeft(null)
  }, [])

  // Sera called show_offers (or the fallback fired): silence the mic and show the
  // 3 cards that were stored from the résumé before the call began.
  const showOffers = useCallback(() => {
    if (roundIndexRef.current !== 0) return
    clearInterval(offersPollRef.current)
    updateSession((s) => patchRound(s, 'screening', { status: 'completed' }))
    vapiRef.current?.setMuted(true)
    setMuted(true)
    enterRound(1)
    startOfferCountdown()
  }, [enterRound, startOfferCountdown, updateSession])

  // HR → Final: the assistants hand over on their own; this is the page catching up.
  const enterFinal = useCallback(() => {
    if (roundIndexRef.current !== 2) return
    updateSession((s) => patchRound(s, 'hr', { status: 'completed' }))
    const finalRound = roundsFor(sessionRef.current?.route)[3]
    roundIndexRef.current = 3
    setRoundIndex(3)
    stopSessionTimer()
    setConnectingTo(finalRound)
    setTimeout(() => {
      setConnectingTo(null)
      if (roundIndexRef.current === 3) enterRound(3)
    }, CONNECT_MS)
  }, [enterRound, stopSessionTimer, updateSession])

  // Joins the call the SERVER created (start-call). The browser holds no Vapi
  // secret: the web URL is the only thing it needs.
  const connectVapi = useCallback(async ({ webCallUrl, callId }) => {
    if (vapiRef.current) await vapiRef.current.stop().catch(() => {})
    callStartedRef.current = false
    clockStartedRef.current = false
    clearTimeout(clockFallbackRef.current)
    const Vapi = await loadVapiClass()
    // reconnect() joins an existing web call and never calls the Vapi API, so the
    // token is unused. A public key is only needed if that ever changes.
    const client = new Vapi(import.meta.env.VITE_VAPI_PUBLIC_KEY || 'server-created-call')
    vapiRef.current = client
    callActiveRef.current = true

    client.on('call-start', () => liveRef.current.onCallStart?.())
    client.on('speech-start', () => liveRef.current.onSeraSpeaking?.(true))
    client.on('speech-end', () => liveRef.current.onSeraSpeaking?.(false))
    client.on('message', (message) => liveRef.current.onVapiMessage?.(message))
    client.on('call-end', () => liveRef.current.onCallEnd?.())
    client.on('error', (err) => liveRef.current.onVapiError?.(err))

    await client.reconnect({ webCallUrl, id: callId })
  }, [])

  // The call dropped without the candidate pressing End: tell the server (it
  // decides whether a rejoin link/code is issued) and show the lost screen.
  // Real drops reach here from the Vapi 'error' event (onVapiError below).
  const handleConnectionLost = useCallback(
    async (roundId) => {
      stopSessionTimer()
      updateSession((s) => ({ ...patchRound(s, roundId, { status: 'dropped' }), status: 'dropped' }))
      const result = await reportConnectionLost(sessionRef.current?.sessionId, roundId)
      setLostInfo({ rejoinIssued: result.rejoinIssued })
      setScreen('lost')
    },
    [stopSessionTimer, updateSession]
  )

  // DEV ONLY — walks the rounds with a simulated call: no start-call, no
  // Vapi. Screening → offers → HR → (hand-over) → Final, then wrapup → report.
  // Uses the real server modules on the fixtures (seraMockReport): the call
  // variables per round, the round transcripts + summaries, and the report.
  const runMockRound = useCallback(
    (startIndex) => {
      if (!import.meta.env.DEV) return // stripped from production builds
      // What Vapi (transcript) and the summary LLM would give for a round.
      const recordRound = async (roundId, seconds, status) => {
        const { mockRoundResult } = await import('../services/seraMockReport')
        const { transcript, summary } = mockRoundResult(roundId, seconds)
        updateSession((s) => {
          const next = patchRound(s, roundId, { status, transcript })
          return roundId in s.summaries ? { ...next, summaries: { ...s.summaries, [roundId]: summary } } : next
        })
      }

      const run = (index, { connected = false } = {}) => {
        mockCallRef.current?.stop()
        mockCallRef.current = null
        clearTimeout(mockConnectTimerRef.current)
        const rounds = roundsFor(sessionRef.current?.route)
        const round = rounds[index]

        const toReport = () => {
          setReportReady(false)
          setScreen('wrapup')
          const started = Date.now()
          const delay = getDevState()?.skipWrapupDelay ? 400 : MOCK_REPORT_DELAY_MS
          import('../services/seraMockReport')
            .then(({ buildMockReportFromSession }) => buildMockReportFromSession(sessionRef.current))
            .then((report) => ({ report }), (err) => ({ err }))
            .then(({ report, err }) =>
              setTimeout(() => {
                if (err) {
                  console.info('[DEV mock] No report:', err.message)
                  setIncomplete(true)
                  setScreen('report')
                  return
                }
                updateSession((s) => ({ ...s, report, status: 'completed' }))
                setReportReady(true)
                setTimeout(() => setScreen('report'), REPORT_FADE_MS)
              }, Math.max(0, delay - (Date.now() - started)))
            )
        }
        toReportRef.current = toReport

        setRoundIndex(index)
        setElapsed(0)
        elapsedRef.current = 0
        setTurnElapsed(0)
        setTurnState('sera-speaking')
        if (!round) return toReport()
        if (round.seconds == null) {
          startOfferCountdown() // offer pick: waits for chooseOffer() (or the 45 s cap)
          return
        }

        // Two timed rounds back to back (HR → Final): hand over to the next interviewer.
        if (!connected && rounds[index - 1]?.seconds != null) {
          setConnectingTo(round)
          mockConnectTimerRef.current = setTimeout(() => {
            setConnectingTo(null)
            run(index, { connected: true })
          }, CONNECT_MS)
          return
        }

        // What the server would send the squad for this round.
        try {
          console.info(`[DEV mock] ${round.id} agent variables`, buildCallVariables(sessionRef.current, round.id))
        } catch (err) {
          console.error('[DEV mock]', err.message)
        }
        updateSession((s) => ({ ...patchRound(s, round.id, { callId: `mock-call-${round.id}-${Date.now()}`, status: 'live' }), status: 'live' }))
        saveMockSession(sessionRef.current.sessionId, { ...sessionRef.current, round: round.id })

        const offerIndex = rounds.findIndex((r) => r.id === 'offer')
        mockCallRef.current = createMockCall({
          seconds: round.seconds,
          wrapSeconds: index === rounds.length - 1 ? 25 : 8,
          onUpdate: (tick) => {
            elapsedRef.current = tick.elapsed
            setElapsed(tick.elapsed)
            setTurnState(tick.turnState)
            setTurnElapsed(tick.turnElapsed)
          },
          onEnd: async ({ reason, elapsed: roundElapsed }) => {
            mockCallRef.current = null
            if (reason === 'dropped') return handleConnectionLost(round.id)
            await recordRound(round.id, roundElapsed, reason === 'time' ? 'completed' : 'cut_short')
            if (reason === 'time') return run(index + 1)
            updateSession((s) => ({ ...s, status: 'ended_by_candidate' }))
            toReport()
          },
          extra: {
            roundId: round.id,
            roundIndex: index,
            roundName: round.label,
            interviewer: round.interviewer?.name,
            jumpToOffers:
              offerIndex > index
                ? async () => {
                    mockCallRef.current?.stop()
                    await recordRound(round.id, round.seconds, 'completed')
                    run(offerIndex)
                  }
                : null,
            jumpToRound: async (targetIndex) => {
              mockCallRef.current?.stop()
              if (targetIndex > 1 && !sessionRef.current?.chosenOfferId && sessionRef.current?.offers?.length) {
                updateSession((s) => ({ ...s, chosenOfferId: s.offers[0].id }))
              }
              await recordRound(round.id, round.seconds, 'completed')
              run(targetIndex)
            },
            jumpToReport: async () => {
              mockCallRef.current?.stop()
              if (!sessionRef.current?.chosenOfferId && sessionRef.current?.offers?.length) {
                updateSession((s) => ({ ...s, chosenOfferId: s.offers[0].id }))
              }
              await recordRound(round.id, round.seconds, 'completed')
              toReport()
            },
          },
        })
      }
      run(startIndex)
    },
    [handleConnectionLost, startOfferCountdown, updateSession]
  )

  const startMockCall = useCallback(() => {
    if (!import.meta.env.DEV) return
    const sessionId = `mock-session-${Date.now()}`
    updateSession((s) => ({ ...s, sessionId, status: 'reserved' }))
    saveMockSession(sessionId, { ...sessionRef.current, round: 'screening', rejoinCount: 0 })
    runMockRound(0)
  }, [runMockRound, updateSession])

  // The candidate picked an offer (or the 45 s cap picked offers[0]). The server
  // checks it is one of the 3 stored offers, writes it into the live call and hands
  // the SAME call to Vinit; only then does the HR round start on screen.
  const chooseOffer = useCallback(
    async (offer) => {
      if (offerPickedRef.current) return
      offerPickedRef.current = true
      clearInterval(offerTimerRef.current)
      setOfferSecondsLeft(null)
      updateSession((s) => ({ ...s, chosenOfferId: offer.id }))

      if (import.meta.env.DEV && isMockMode()) {
        saveOfferChoice(sessionRef.current?.sessionId, offer.id)
        runMockRound(2)
        return
      }

      setConnectingTo(roundsFor(sessionRef.current?.route)[2])
      let saved = { ok: false }
      for (let attempt = 0; attempt < 3 && !saved.ok; attempt++) {
        if (attempt) await new Promise((resolve) => setTimeout(resolve, 1500))
        saved = await saveOfferChoice(sessionRef.current?.sessionId, offer.id)
      }

      if (!saved.ok) {
        // The call is open but silent and nothing can continue it: end it and
        // report on what was said in screening.
        setConnectingTo(null)
        setError("We couldn't connect your next round, so here is what we have from the first one.")
        candidateEndedRef.current = true
        markCandidateEnded(sessionRef.current?.sessionId)
        vapiRef.current?.stop().catch(() => {})
        return
      }

      vapiRef.current?.setMuted(false)
      setMuted(false)
      updateSession((s) => ({ ...patchRound(s, 'hr', { status: 'live' }), status: 'live' }))
      setConnectingTo(null)
      enterRound(2)
    },
    [enterRound, runMockRound, updateSession]
  )

  // Starts the ONE call for the whole interview (Sera → Vinit → Sonia). Runs only
  // after the résumé check passed, and for New Users only after the server
  // verified the payment.
  const startInterview = useCallback(async () => {
    const current = sessionRef.current
    if (!current?.resume.objectKey) return
    setBusy(true)
    setError(null)
    // A restart skips the upload, so its microphone check is here.
    if (current.status === 'restart_available' && !isMockMode()) {
      const mic = await checkMicrophone()
      if (!mic.ok) {
        setError(mic.error)
        setBusy(false)
        return
      }
    }

    // Mock mode never creates a real call. On the dev server it simulates one.
    if (isMockMode()) {
      setScreen('interview')
      setTurnState('sera-speaking')
      setBusy(false)
      if (import.meta.env.DEV) startMockCall()
      return
    }

    try {
      const result = await startInterviewCall(current)
      if (result.blocked) {
        setBlockedMessage(result.message)
        setScreen('blocked')
        return
      }
      if (!result.ok) throw new Error(result.error)
      saveSessionId(result.sessionId)
      restartRef.current = current.status === 'restart_available'

      updateSession((s) => ({
        ...patchRound(s, 'screening', { callId: result.callId, status: 'live' }),
        sessionId: result.sessionId,
        status: 'live',
      }))
      roundIndexRef.current = 0
      setRoundIndex(0)
      setScreen('interview')
      setTurnState('connecting') // until Sera is actually audible
      await connectVapi(result)
    } catch (err) {
      setError(err.message || 'Something went wrong — please try again')
      // A restart that failed to start is still a restart (the server kept it); anything else goes back to upload.
      setScreen(sessionRef.current?.status === 'restart_available' ? 'restart' : 'upload')
    } finally {
      setBusy(false)
    }
  }, [connectVapi, startMockCall, updateSession])

  // Résumé check + the 3 offers in one step (seraResumeService), stored on the session.
  const beginInterview = useCallback(
    async (overrideFile = null) => {
      // overrideFile is only for the DEV panel; anything that is not a real file (e.g. a click event) is ignored
      const file = overrideFile instanceof Blob ? overrideFile : resumeFile
      if (!file || !sessionRef.current) return
      setBusy(true)
      setError(null)
      // The microphone first: before the résumé read, the payment or the call cost anything.
      if (!isMockMode()) {
        const mic = await checkMicrophone()
        if (!mic.ok) {
          setError(mic.error)
          setBusy(false)
          return
        }
      }
      // "Try again" after a start that did not connect: the offers from this file are already stored.
      const current = sessionRef.current
      if (file === preparedFileRef.current && current.offers?.length === 3 && current.resume?.objectKey) {
        setBusy(false)
        if (current.route === 'student' || current.payment?.paymentId) await startInterview()
        else setScreen('pay')
        return
      }
      setScreen('preparing')

      try {
        const result = await prepareResume(file, sessionRef.current?.sessionId)
        if (!result.ok) {
          setError(result.error)
          setResumeFile(null)
          setScreen('upload')
          return
        }

        preparedFileRef.current = file
        const current = updateSession((s) => ({ ...s, resume: result.resume, offers: result.offers, chosenOfferId: null }))
        setBusy(false)
        // A verified payment whose interview never started is reused, never charged twice.
        if (current.route === 'student' || current.payment.paymentId) await startInterview()
        else setScreen('pay')
      } catch (err) {
        setError(err.message || 'Something went wrong — please try again')
        setScreen('upload')
      } finally {
        setBusy(false)
      }
    },
    [resumeFile, startInterview, updateSession]
  )

  // payment: { orderId, paymentId } — verified by the server (SeraPay).
  const onPaymentSuccess = useCallback(
    (payment) => {
      updateSession((s) => ({ ...s, payment, status: 'reserved' }))
      return startInterview()
    },
    [startInterview, updateSession]
  )

  // "Use a different résumé" from the pay screen.
  const changeResume = useCallback(() => {
    updateSession((s) => ({ ...s, resume: { objectKey: null, highlight: '', field: '' }, offers: [], chosenOfferId: null }))
    setError(null)
    setResumeFile(null)
    setScreen('upload')
  }, [updateSession])

  const toggleMute = useCallback(() => {
    const client = vapiRef.current
    if (!client) return
    client.setMuted(!muted)
    setMuted(!muted)
  }, [muted])

  // Candidate confirmed "End interview". Tell the server it was intentional
  // BEFORE hanging up (ended_by_candidate → no rejoin), but never wait long.
  const endCallEarly = useCallback(async () => {
    candidateEndedRef.current = true
    await Promise.race([
      markCandidateEnded(sessionRef.current?.sessionId),
      new Promise((resolve) => setTimeout(resolve, 1500)),
    ])
    if (import.meta.env.DEV) mockCallRef.current?.endNow()
    const client = vapiRef.current
    if (!client) return
    client.stop().catch(() => {})
    // Leaving the room normally fires call-end; if it somehow doesn't, don't hang.
    setTimeout(() => {
      if (!candidateEndedRef.current) return
      candidateEndedRef.current = false
      callActiveRef.current = false
      finishInterview()
    }, 1500)
  }, [finishInterview])

  // Rejoin after a dropped call ({ session, round } from redeemRejoin): skip
  // upload and pay, restart the dropped round (earlier rounds, offers and the
  // chosen offer are kept on the session).
  const resumeSession = useCallback(
    async ({ session: rejoined, round: roundId }) => {
      updateSession(rejoined)
      setError(null)
      setLostInfo(null)
      const index = Math.max(0, roundsFor(rejoined.route).findIndex((r) => r.id === roundId))
      setScreen('interview')
      if (import.meta.env.DEV && isMockMode()) {
        // A test rejoin from a fresh browser has no résumé yet: use the sample.
        if (!rejoined.offers?.length) {
          const { mockPreparedResume } = await import('../services/seraMockReport')
          const prepared = await mockPreparedResume('Resume.pdf')
          updateSession((s) => ({ ...s, ...prepared }))
        }
        runMockRound(index)
        return
      }
      // TODO(backend): rejoin on the squad. A Vapi squad call starts at its first
      // member, so restarting mid-interview needs a decision (docs/sera-vapi.md).
      setRoundIndex(index)
    },
    [runMockRound, updateSession]
  )

  // Timers and Vapi events call the LATEST handlers through this ref, so they never
  // act on stale state. (Assigned after render, as React expects.)
  useEffect(() => {
    liveRef.current = {
      chooseOffer,
      finishInterview,

      // Reopens an existing interview from the server (a refresh, or a login matched to it).
      restoreSession: async (sessionId, { fallback = null } = {}) => {
        let server
        try {
          server = await fetchServerSession(sessionId)
        } catch {
          setError("We couldn't reach the server. Check your connection and refresh the page.")
          if (fallback) {
            updateSession(createSession(fallback))
            setScreen('upload')
          }
          return
        }
        if (!server) {
          clearSessionId()
          return
        }
        const point = resumePoint(server)
        updateSession({ ...createSession(server), ...server, sessionId })
        if (point.screen === 'wrapup') return finishInterview()
        if (point.incomplete) setIncomplete(server.status === 'report_failed' ? 'failed' : true)
        setScreen(point.screen)
      },

      // Safety nets only — the assistants hand over by themselves.
      onClockTick: (elapsedSeconds) => {
        const round = roundsFor(sessionRef.current?.route)[roundIndexRef.current]
        if (!round?.seconds) return
        if (round.id === 'screening' && elapsedSeconds === round.seconds + OFFERS_FALLBACK_SECONDS) showOffers()
        if (round.id === 'hr' && elapsedSeconds === round.seconds + HR_UI_GRACE_SECONDS) enterFinal()
      },

      onCallStart: () => {
        if (callStartedRef.current) return // the SDK reports call-start twice; the second must not restart anything
        callStartedRef.current = true
        setTurnState('connecting')
        // The clock starts when Sera is audible (startFirstClock), not when the room connects.
        clearTimeout(clockFallbackRef.current)
        clockFallbackRef.current = setTimeout(() => liveRef.current.startFirstClock?.(), CLOCK_START_FALLBACK_MS)
        // Follow the server for the whole call: it hears Vapi (show_offers, which assistant is speaking).
        clearInterval(offersPollRef.current)
        offersPollRef.current = setInterval(async () => {
          const state = await fetchCallState(sessionRef.current)
          if (!state) return
          if (state.offersShown && roundIndexRef.current === 0) showOffers()
          if (state.round === 'final' && roundIndexRef.current === 2) enterFinal()
        }, 2000)
      },

      startFirstClock: () => {
        if (clockStartedRef.current || roundIndexRef.current !== 0) return
        clockStartedRef.current = true
        clearTimeout(clockFallbackRef.current)
        enterRound(0)
      },

      // Vapi's speech-start / speech-end are the ASSISTANT's speech.
      onSeraSpeaking: (speaking) => {
        if (roundIndexRef.current === 0 && speaking) liveRef.current.startFirstClock?.() // first audible speech starts the clock
        if (roundIndexRef.current === 1) return // offer pick: silent
        turnActiveRef.current = !speaking
        stalledExtraSecondsRef.current = 0
        turnElapsedRef.current = 0
        setTurnElapsed(0)
        setTurnState(speaking ? 'sera-speaking' : 'your-turn')
      },

      onVapiMessage: (message) => {
        if (isShowOffersMessage(message)) {
          showOffers()
          return
        }
        // Vapi's own turn signal: who is speaking (more exact than the SDK's audio-level guess).
        if (message?.type === 'speech-update' && message.role === 'assistant') {
          liveRef.current.onSeraSpeaking?.(message.status === 'started')
          return
        }
        // Vapi tells the client which squad member took over: follow it.
        if (message?.type === 'assistant.started') {
          const name = message.assistant?.name ?? message.newAssistant?.name ?? message.assistantName
          if (roundOfAssistantName(name) === 'final') enterFinal()
        }
      },

      onCallEnd: () => {
        if (!callActiveRef.current) return
        callActiveRef.current = false
        stopSessionTimer()
        clearInterval(offerTimerRef.current)
        clearInterval(offersPollRef.current)
        if (candidateEndedRef.current) {
          candidateEndedRef.current = false
          finishInterview()
          return
        }
        const index = roundIndexRef.current
        if (index >= 2) {
          // HR or Final: the assistant ended the call — the server decides what the report can say.
          updateSession((s) => patchRound(s, index === 2 ? 'hr' : 'final', { status: 'completed' }))
          finishInterview()
          return
        }
        // Ended before the HR round (a drop, a refresh, silence): the server decides between the one free
        // restart and the report on what was said (spec 0002). Wait for it on the wrap-up screen.
        finishInterview()
      },

      onVapiError: (err) => {
        console.error('Vapi call error:', err)
        if (!callActiveRef.current) return
        callActiveRef.current = false
        stopSessionTimer()
        clearInterval(offerTimerRef.current)
        clearInterval(offersPollRef.current)
        vapiRef.current?.stop().catch(() => {})
        if (candidateEndedRef.current) {
          candidateEndedRef.current = false
          finishInterview()
          return
        }
        if (!callStartedRef.current) {
          setError('The call could not connect — please try again.')
          // A forgiven restart is still the restart; a forgiven first start goes back to Begin.
          if (restartRef.current) updateSession((s) => ({ ...s, status: 'restart_available' }))
          setScreen(restartRef.current ? 'restart' : 'upload')
          releaseReservation(sessionRef.current).then((released) => {
            if (!released) finishInterview()
          })
          return
        }
        // The server hears the call's end from Vapi and decides (restart or report): wait for it.
        finishInterview()
      },
    }
  })

  // A refresh in this tab: reopen the interview where the server has it (never in DEV mock mode).
  useEffect(() => {
    if (isMockMode()) return
    const saved = loadSessionId()
    if (saved) liveRef.current.restoreSession?.(saved)
  }, [])

  // A live call cannot survive a reload: ask before the tab is closed or refreshed by accident.
  useEffect(() => {
    if (screen !== 'interview') return
    const warn = (event) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [screen])

  useEffect(() => stopSessionTimer, [stopSessionTimer])
  useEffect(
    () => () => {
      clearInterval(offerTimerRef.current)
      clearInterval(offersPollRef.current)
      vapiRef.current?.stop().catch(() => {})
    },
    []
  )
  useEffect(() => () => import.meta.env.DEV && mockCallRef.current?.stop(), [])

  useEffect(() => {
    if (!import.meta.env.DEV) return
    const roundsList = roundsFor(session?.route)
    setDev({
      ui: {
        screen,
        roundIndex,
        roundId: roundsList[roundIndex]?.id,
        roundName: roundsList[roundIndex]?.label,
        session,
        quickLoginStudent: () => {
          updateSession(
            createSession({
              firstName: 'Test Student',
              email: 'student.test@gmail.com',
              phone: '9876543211',
              route: 'student',
              studentCode: 'YZI-PUNE-OCT26',
            })
          )
          setScreen('upload')
        },
        quickLoginVisitor: () => {
          updateSession(
            createSession({
              firstName: 'Test Visitor',
              email: 'visitor.test@gmail.com',
              phone: '9876543210',
              route: 'visitor',
              studentCode: null,
            })
          )
          setScreen('upload')
        },
        autoUploadAndBegin: async () => {
          const sampleFile = new File(['%PDF-1.4 Mock Candidate Resume'], 'Sample_Resume.pdf', { type: 'application/pdf' })
          setResumeFile(sampleFile)
          await beginInterview(sampleFile)
        },
        autoPickOffer: () => {
          const firstOffer = sessionRef.current?.offers?.[0]
          if (firstOffer) chooseOffer(firstOffer)
        },
        skipToReport: async () => {
          mockCallRef.current?.stop()
          if (!sessionRef.current?.offers?.length) {
            const { mockPreparedResume } = await import('../services/seraMockReport')
            const prepared = await mockPreparedResume('Sample_Resume.pdf')
            updateSession((s) => ({ ...s, ...prepared, chosenOfferId: prepared.offers[0].id }))
          } else if (!sessionRef.current?.chosenOfferId) {
            updateSession((s) => ({ ...s, chosenOfferId: s.offers[0].id }))
          }
          toReportRef.current?.()
        },
        resetInterview: reset,
      },
    })
  }, [screen, roundIndex, session, beginInterview, chooseOffer, reset, updateSession])

  const rounds = roundsFor(session?.route)
  const round = rounds[roundIndex] ?? rounds[0]
  // Countdown for the current round (null during the untimed offer choice).
  const roundSecondsLeft = round.seconds == null ? null : Math.max(0, round.seconds - elapsed)

  return {
    screen,
    error,
    busy,
    session,
    resumeFile,
    blockedMessage,
    turnState,
    turnElapsed,
    turnSeconds: round.turnSeconds ?? 45,
    connectingTo,
    rounds,
    roundIndex,
    roundSecondsLeft,
    chooseOffer,
    holdOfferTimer,
    offerSecondsLeft,
    lostInfo,
    resumeSession,
    muted,
    reportReady,
    incomplete,
    goToSignIn,
    completeLogin,
    selectFile,
    beginInterview,
    startInterview,
    onPaymentSuccess,
    changeResume,
    toggleMute,
    endCallEarly,
    reset,
  }
}
