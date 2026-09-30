import { useCallback, useEffect, useRef, useState } from 'react'
import { signInWithGoogle } from '../utils/googleAuth'
import { isMockMode } from '../services/seraAuthService'
import { createMockCall, MOCK_REPORT_DELAY_MS, saveMockSession } from '../services/seraMockCall'
import { markCandidateEnded, reportConnectionLost } from '../services/seraSessionService'
import { saveOfferChoice } from '../services/seraOffersService'
import { prepareResume } from '../services/seraResumeService'
import { fetchReport, releaseReservation, startRoundCall } from '../services/seraCallService'
import { createSession, patchRound } from '../shared/seraSession'
import { buildCallVariables } from '../../netlify/lib/seraCall/variables.js'
import { roundsFor } from '../config/seraRounds'

const SESSION_SECONDS = 5 * 60
const TURN_SECONDS = 35
// Wrap-up: after the report arrives, the last checklist tick + fade before showing it.
const REPORT_FADE_MS = 900
// HR → Final: a short "Connecting you to the final round with Arvind…" hand-over.
const CONNECT_MS = 2500
const PHASE_SKILLS_START = 55 // 0:55
const PHASE_GOAL_START = 230 // 3:50

// If the candidate's turn timer sits pegged at TURN_SECONDS this long with
// no agent_start_talking firing, the call is treated as stalled/dropped
// rather than the candidate just running long (Retell/the prompt already
// enforces the real cutoff — this is purely a client-side dead-call guard).
const STALL_GRACE_SECONDS = 15
// A stall this early almost certainly means the call never really started —
// don't burn the candidate's one-per-login slot over it.
const STALL_FORGIVENESS_WINDOW_SECONDS = 90

function phaseForElapsed(elapsed) {
  if (elapsed < PHASE_SKILLS_START) return 'warmup'
  if (elapsed < PHASE_GOAL_START) return 'skills'
  return 'goal'
}

// Screens: hero | signin | upload | preparing | pay | interview | wrapup | report | blocked | lost
// `lost` = the call dropped without the candidate pressing End (rejoin comes by WhatsApp).
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

  const retellRef = useRef(null)
  const sessionTimerRef = useRef(null)
  const turnActiveRef = useRef(false)
  const elapsedRef = useRef(0)
  const suppressCallEndedRef = useRef(false)
  const stalledExtraSecondsRef = useRef(0)
  // Rounds (src/config/seraRounds.js): index into the route's rounds.
  const [roundIndex, setRoundIndex] = useState(0)
  const [connectingTo, setConnectingTo] = useState(null) // next round during the HR → Final hand-over
  const [lostInfo, setLostInfo] = useState(null) // { rejoinIssued } on the lost screen
  // DEV ONLY — the simulated call in mock mode (seraMockCall).
  const mockCallRef = useRef(null)
  const mockConnectTimerRef = useRef(null)

  // Synchronous update: the ref is current immediately (timers and mock
  // callbacks read it before React re-renders).
  const updateSession = useCallback((update) => {
    const next = typeof update === 'function' ? update(sessionRef.current) : update
    sessionRef.current = next
    setSession(next)
    return next
  }, [])

  const reset = useCallback(() => {
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
    setLostInfo(null)
    setConnectingTo(null)
    if (import.meta.env.DEV) {
      mockCallRef.current?.stop()
      mockCallRef.current = null
      clearTimeout(mockConnectTimerRef.current)
    }
    if (sessionTimerRef.current) clearInterval(sessionTimerRef.current)
  }, [updateSession])

  const goToSignIn = useCallback(() => setScreen('signin'), [])

  const signIn = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      const google = await signInWithGoogle()
      updateSession(createSession({ route: 'visitor', name: google.name, email: google.email }))
      setScreen('upload')
    } catch (err) {
      setError(err.message || 'Google sign-in failed — please try again')
    } finally {
      setBusy(false)
    }
  }, [updateSession])

  // Login from the glass card (SeraLogin): { route, firstName, email, phone, studentCode }.
  const completeLogin = useCallback(
    (login) => {
      setError(null)
      updateSession(createSession(login))
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
    // fire the SDK's own call_ended event and race finishInterview() into
    // overwriting the 'upload' screen we're about to set.
    suppressCallEndedRef.current = true
    stopSessionTimer()
    retellRef.current?.stopCall()
    setError("Sera's having a connection hiccup — let's try that again.")
    setScreen('upload')
    if (elapsedRef.current < STALL_FORGIVENESS_WINDOW_SECONDS) releaseReservation(sessionRef.current)
  }, [stopSessionTimer])

  const finishInterview = useCallback(async () => {
    stopSessionTimer()
    setReportReady(false)
    setScreen('wrapup')

    // The report is generated exactly once, server-side, after the final
    // round — never here. Polling a cheap read-only endpoint means every
    // interview costs one analysis call, not two.
    const POLL_INTERVAL_MS = 2000
    const MAX_ATTEMPTS = 45 // ~90s, then the "still on its way by email" message

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
      const result = await fetchReport(sessionRef.current)
      if (!result.ready) continue
      if (result.incomplete) {
        setIncomplete(true)
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
    setError("Your report is taking longer than expected — it's still on its way to our team by email, and we'll make sure you see it.")
    setScreen('report')
  }, [stopSessionTimer, updateSession])

  const startSessionTimer = useCallback(() => {
    stopSessionTimer()
    setElapsed(0)
    elapsedRef.current = 0
    stalledExtraSecondsRef.current = 0
    sessionTimerRef.current = setInterval(() => {
      setElapsed((prev) => {
        const next = prev + 1
        elapsedRef.current = next
        if (next >= SESSION_SECONDS) {
          stopSessionTimer()
          retellRef.current?.stopCall()
          finishInterview()
          return prev
        }
        if (next >= SESSION_SECONDS - 25) {
          setTurnState('wrapping-up')
        }
        return next
      })
      if (turnActiveRef.current) {
        setTurnElapsed((prev) => {
          if (prev >= TURN_SECONDS) {
            stalledExtraSecondsRef.current += 1
            if (stalledExtraSecondsRef.current > STALL_GRACE_SECONDS) {
              handleStalledCall()
            }
            return prev
          }
          stalledExtraSecondsRef.current = 0
          return prev + 1
        })
      }
    }, 1000)
  }, [finishInterview, stopSessionTimer, handleStalledCall])

  const connectRetell = useCallback(
    async (accessToken) => {
      const { RetellWebClient } = await import('retell-client-js-sdk')
      const client = new RetellWebClient()
      retellRef.current = client

      client.on('call_started', () => {
        startSessionTimer()
      })
      client.on('agent_start_talking', () => {
        turnActiveRef.current = false
        stalledExtraSecondsRef.current = 0
        setTurnElapsed(0)
        setTurnState('sera-speaking')
      })
      client.on('agent_stop_talking', () => {
        turnActiveRef.current = true
        stalledExtraSecondsRef.current = 0
        setTurnElapsed(0)
        setTurnState('your-turn')
      })
      // The round transcripts reach the session on the server (Retell
      // webhook), not from the browser — the report never trusts client text.
      client.on('call_ended', () => {
        if (suppressCallEndedRef.current) {
          suppressCallEndedRef.current = false
          return
        }
        finishInterview()
      })
      client.on('error', (err) => {
        console.error('Retell call error:', err)
        setError('The call dropped unexpectedly — please try again.')
        stopSessionTimer()
        client.stopCall()
        setScreen('upload')
      })

      await client.startCall({ accessToken })
    },
    [finishInterview, startSessionTimer, stopSessionTimer]
  )

  // The call dropped without the candidate pressing End: tell the server (it
  // decides whether a rejoin link/code is issued) and show the lost screen.
  // TODO(backend): real Retell drops — call this from the Retell disconnect
  // handling once the server confirms the disconnection reason.
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

  // DEV ONLY — walks the rounds with a simulated call: no sera-start-call, no
  // Retell. Screening → offers → HR → (hand-over) → Final, then wrapup → report.
  // Uses the real server modules on the fixtures (seraMockReport): the call
  // variables per round, the round transcripts + summaries, and the report.
  const runMockRound = useCallback(
    (startIndex) => {
      if (!import.meta.env.DEV) return // stripped from production builds
      // What Retell (transcript) and the summary LLM would give for a round.
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
              }, Math.max(0, MOCK_REPORT_DELAY_MS - (Date.now() - started)))
            )
        }

        setRoundIndex(index)
        setElapsed(0)
        elapsedRef.current = 0
        setTurnElapsed(0)
        setTurnState('sera-speaking')
        if (!round) return toReport()
        if (round.seconds == null) return // offer choice: no call runs until chooseOffer()

        // Two timed rounds back to back (HR → Final): hand over to the next interviewer.
        if (!connected && rounds[index - 1]?.seconds != null) {
          setConnectingTo(round)
          mockConnectTimerRef.current = setTimeout(() => {
            setConnectingTo(null)
            run(index, { connected: true })
          }, CONNECT_MS)
          return
        }

        // What the server would send this round's Retell agent.
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
          extra:
            offerIndex > index
              ? {
                  jumpToOffers: async () => {
                    mockCallRef.current?.stop()
                    await recordRound(round.id, round.seconds, 'completed')
                    run(offerIndex)
                  },
                }
              : {},
        })
      }
      run(startIndex)
    },
    [handleConnectionLost, updateSession]
  )

  const startMockCall = useCallback(() => {
    if (!import.meta.env.DEV) return
    const sessionId = `mock-session-${Date.now()}`
    updateSession((s) => ({ ...s, sessionId, status: 'reserved' }))
    saveMockSession(sessionId, { ...sessionRef.current, round: 'screening', rejoinCount: 0 })
    runMockRound(0)
  }, [runMockRound, updateSession])

  // Candidate picks an offer → save it on the session → next round (HR). The
  // server builds the HR/Final agents' variables from the chosen offer.
  // No call runs while choosing.
  const chooseOffer = useCallback(
    (offer) => {
      updateSession((s) => ({ ...s, chosenOfferId: offer.id }))
      saveOfferChoice(sessionRef.current?.sessionId, offer.id)
      if (import.meta.env.DEV && isMockMode()) runMockRound(roundIndex + 1)
      // TODO(backend): real mode — startRoundCall(session, 'hr') once the server supports it.
    },
    [roundIndex, runMockRound, updateSession]
  )

  // Screening call. Runs only after the résumé check passed, and for New
  // Users only after the server verified the payment.
  const startInterview = useCallback(async () => {
    const current = sessionRef.current
    if (!current?.resume.objectKey) return
    setBusy(true)
    setError(null)

    // Mock mode never creates a real call. On the dev server it simulates one.
    if (isMockMode()) {
      setScreen('interview')
      setTurnState('sera-speaking')
      setBusy(false)
      if (import.meta.env.DEV) startMockCall()
      return
    }

    try {
      const result = await startRoundCall(current, 'screening')
      if (result.blocked) {
        setBlockedMessage(result.message)
        setScreen('blocked')
        return
      }
      if (!result.ok) throw new Error(result.error)

      updateSession((s) => ({
        ...patchRound(s, 'screening', { callId: result.callId, status: 'live' }),
        sessionId: result.sessionId,
        status: 'live',
      }))
      setRoundIndex(0)
      setScreen('interview')
      setTurnState('sera-speaking')
      await connectRetell(result.accessToken)
    } catch (err) {
      setError(err.message || 'Something went wrong — please try again')
      setScreen('upload')
    } finally {
      setBusy(false)
    }
  }, [connectRetell, startMockCall, updateSession])

  // Résumé check + the 3 offers in one step (seraResumeService), stored on the session.
  const beginInterview = useCallback(async () => {
    if (!resumeFile || !sessionRef.current) return
    setBusy(true)
    setError(null)
    setScreen('preparing')

    try {
      const result = await prepareResume(resumeFile)
      if (!result.ok) {
        setError(result.error)
        setResumeFile(null)
        setScreen('upload')
        return
      }

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
  }, [resumeFile, startInterview, updateSession])

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
    const client = retellRef.current
    if (!client) return
    if (muted) {
      client.unmute()
      setMuted(false)
    } else {
      client.mute()
      setMuted(true)
    }
  }, [muted])

  // Candidate confirmed "End interview". Tell the server it was intentional
  // BEFORE hanging up (ended_by_candidate → no rejoin), but never wait long.
  const endCallEarly = useCallback(async () => {
    await Promise.race([
      markCandidateEnded(sessionRef.current?.sessionId),
      new Promise((resolve) => setTimeout(resolve, 1500)),
    ])
    if (import.meta.env.DEV) mockCallRef.current?.endNow()
    retellRef.current?.stopCall()
  }, [])

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
      // TODO(backend): start the rejoin call via startRoundCall(session, round)
      // (no payment, no seat) and resume at this round.
      setRoundIndex(index)
    },
    [runMockRound, updateSession]
  )

  useEffect(() => stopSessionTimer, [stopSessionTimer])
  useEffect(() => () => import.meta.env.DEV && mockCallRef.current?.stop(), [])

  const rounds = roundsFor(session?.route)
  const round = rounds[roundIndex] ?? rounds[0]
  // Countdown for the current round (null during the untimed offer choice).
  const roundSecondsLeft = round.seconds == null ? null : Math.max(0, round.seconds - elapsed)
  const sessionSecondsLeft = roundSecondsLeft ?? Math.max(0, SESSION_SECONDS - elapsed)
  const phase = phaseForElapsed(elapsed)

  return {
    screen,
    error,
    busy,
    session,
    resumeFile,
    blockedMessage,
    sessionSecondsLeft,
    phase,
    turnState,
    turnElapsed,
    turnSeconds: round.turnSeconds ?? 45,
    connectingTo,
    rounds,
    roundIndex,
    roundSecondsLeft,
    chooseOffer,
    lostInfo,
    resumeSession,
    muted,
    reportReady,
    incomplete,
    goToSignIn,
    signIn,
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
