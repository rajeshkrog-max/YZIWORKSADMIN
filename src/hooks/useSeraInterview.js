import { useCallback, useEffect, useRef, useState } from 'react'
import { signInWithGoogle } from '../utils/googleAuth'
import { uploadResumeToR2 } from '../utils/seraUpload'
import { isMockMode } from '../services/seraAuthService'
import { createMockCall, MOCK_REPORT, MOCK_REPORT_DELAY_MS } from '../services/seraMockCall'

const SESSION_SECONDS = 5 * 60
const TURN_SECONDS = 35
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

// Screens: hero | signin | upload | preparing | pay | interview | wrapup | report | blocked
// `pay` is visitor-only: students go from preparing straight to the interview.
export function useSeraInterview() {
  const [screen, setScreen] = useState('hero')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const [profile, setProfile] = useState(null)
  const [resumeFile, setResumeFile] = useState(null)
  const [resumeMeta, setResumeMeta] = useState(null)

  const [elapsed, setElapsed] = useState(0)
  const [turnState, setTurnState] = useState('sera-speaking') // sera-speaking | your-turn | wrapping-up
  const [turnElapsed, setTurnElapsed] = useState(0)
  const [muted, setMuted] = useState(false)
  const [report, setReport] = useState(null)
  const [incomplete, setIncomplete] = useState(false)
  const [blockedMessage, setBlockedMessage] = useState(null)

  const retellRef = useRef(null)
  const transcriptRef = useRef('')
  const sessionTimerRef = useRef(null)
  const turnActiveRef = useRef(false)
  const elapsedRef = useRef(0)
  const profileRef = useRef(null)
  const suppressCallEndedRef = useRef(false)
  const stalledExtraSecondsRef = useRef(0)
  // Result of the résumé check ({ uploaded, extracted }) — kept for startInterview,
  // which runs after the pay screen for visitors.
  const preparedRef = useRef(null)
  // A verified payment whose interview never started (start-call failed): reused
  // on the next attempt so the visitor isn't charged twice.
  const paidPaymentIdRef = useRef(null)
  // DEV ONLY — simulated call in mock mode (seraMockCall) and its clock lengths.
  const mockCallRef = useRef(null)
  const [mockDurations, setMockDurations] = useState(null)

  useEffect(() => {
    profileRef.current = profile
  }, [profile])

  const reset = useCallback(() => {
    setScreen('hero')
    setError(null)
    setBusy(false)
    setProfile(null)
    setResumeFile(null)
    setResumeMeta(null)
    setElapsed(0)
    setTurnState('sera-speaking')
    setTurnElapsed(0)
    turnActiveRef.current = false
    setMuted(false)
    setReport(null)
    setIncomplete(false)
    setBlockedMessage(null)
    transcriptRef.current = ''
    preparedRef.current = null
    paidPaymentIdRef.current = null
    if (import.meta.env.DEV) {
      mockCallRef.current?.stop()
      mockCallRef.current = null
      setMockDurations(null)
    }
    if (sessionTimerRef.current) clearInterval(sessionTimerRef.current)
  }, [])

  const goToSignIn = useCallback(() => setScreen('signin'), [])

  const signIn = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      const googleProfile = await signInWithGoogle()
      setProfile(googleProfile)
      setScreen('upload')
    } catch (err) {
      setError(err.message || 'Google sign-in failed — please try again')
    } finally {
      setBusy(false)
    }
  }, [])

  // Session from the glass login (SeraLogin). `route` stays on the profile —
  // the server later uses it to pick the paid (5-min) vs student (10-min) agent.
  const completeLogin = useCallback((session) => {
    setError(null)
    setProfile({
      name: session.name,
      email: session.email,
      phone: session.phone,
      route: session.route,
      studentCode: session.studentCode ?? null,
      instituteName: session.instituteName ?? null,
    })
    setScreen('upload')
  }, [])

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

    const email = profileRef.current?.email
    if (elapsedRef.current < STALL_FORGIVENESS_WINDOW_SECONDS && email) {
      fetch('/.netlify/functions/sera-release-reservation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      }).catch(() => {})
    }
  }, [stopSessionTimer])

  const finishInterview = useCallback(async () => {
    stopSessionTimer()
    setScreen('wrapup')

    // The report is generated exactly once, server-side, by the Retell
    // webhook — never here. Polling a cheap read-only endpoint instead of
    // running our own LLM call means every interview costs one analysis
    // call, not two.
    const POLL_INTERVAL_MS = 2000
    const MAX_ATTEMPTS = 30 // ~60s

    try {
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))

        const response = await fetch('/.netlify/functions/sera-get-report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: profile?.email }),
        })
        const result = await response.json()

        if (response.ok && result.ready) {
          if (result.incomplete) {
            setIncomplete(true)
            setScreen('report')
            return
          }
          if (result.report) {
            setReport(result.report)
            setScreen('report')
            return
          }
        }
      }
      throw new Error(
        "Your report is taking longer than expected — it's still on its way to our team by email, and we'll make sure you see it."
      )
    } catch (err) {
      setError(err.message || 'Unable to prepare your report')
      setScreen('report')
    }
  }, [profile, stopSessionTimer])

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
      client.on('update', (update) => {
        if (typeof update?.transcript === 'string') {
          transcriptRef.current = update.transcript
        }
      })
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

  // DEV ONLY — drives the existing interview screen with a simulated call:
  // no sera-start-call, no Retell. End → wrapup → mock report after ~3s.
  const startMockCall = useCallback(() => {
    if (!import.meta.env.DEV) return // stripped from production builds
    mockCallRef.current?.stop()
    const call = createMockCall({
      route: profileRef.current?.route,
      onUpdate: (tick) => {
        elapsedRef.current = tick.elapsed
        setElapsed(tick.elapsed)
        setTurnState(tick.turnState)
        setTurnElapsed(tick.turnElapsed)
      },
      onEnd: ({ incomplete: dropped }) => {
        mockCallRef.current = null
        setScreen('wrapup')
        setTimeout(() => {
          if (dropped) setIncomplete(true)
          else setReport(MOCK_REPORT)
          setScreen('report')
        }, MOCK_REPORT_DELAY_MS)
      },
    })
    mockCallRef.current = call
    setMockDurations(call.durations)
  }, [])

  // sera-start-call + Retell. Runs only after the résumé check passed, and for
  // visitors only after the server verified the payment.
  const startInterview = useCallback(
    async ({ paymentId } = {}) => {
      const prepared = preparedRef.current
      if (!prepared || !profile) return
      const { uploaded, extracted } = prepared
      setBusy(true)
      setError(null)
      if (paymentId) paidPaymentIdRef.current = paymentId

      // Mock mode never creates a real call. On the dev server it simulates one.
      if (isMockMode()) {
        setScreen('interview')
        setTurnState('sera-speaking')
        setBusy(false)
        if (import.meta.env.DEV) startMockCall()
        return
      }

      try {
        const startResponse = await fetch('/.netlify/functions/sera-start-call', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: profile.email,
            name: profile.name,
            resumeText: extracted.resumeText,
            highlight: extracted.highlight,
            field: extracted.field,
            objectKey: uploaded.objectKey,
            route: profile.route,
            studentCode: profile.studentCode ?? null,
            paymentId: paymentId ?? null,
          }),
        })
        const startResult = await startResponse.json()

        if (startResponse.status === 403 && startResult.error === 'already-used') {
          setBlockedMessage(startResult.message)
          setScreen('blocked')
          return
        }
        if (!startResponse.ok || !startResult.success) {
          throw new Error(startResult.error || 'Unable to start the interview')
        }

        paidPaymentIdRef.current = null
        setScreen('interview')
        setTurnState('sera-speaking')
        await connectRetell(startResult.accessToken)
      } catch (err) {
        setError(err.message || 'Something went wrong — please try again')
        setScreen('upload')
      } finally {
        setBusy(false)
      }
    },
    [profile, connectRetell, startMockCall]
  )

  const beginInterview = useCallback(async () => {
    if (!resumeFile || !profile) return
    setBusy(true)
    setError(null)
    setScreen('preparing')
    preparedRef.current = null

    try {
      let uploaded
      let extracted

      if (isMockMode()) {
        // Plain `vite` has no Netlify functions: fake the upload + résumé check.
        // A file name containing "bad" simulates a rejected résumé.
        await new Promise((resolve) => setTimeout(resolve, 900))
        uploaded = { objectKey: `sera-interviews/mock/${resumeFile.name}`, originalFilename: resumeFile.name, size: resumeFile.size }
        extracted = /bad/i.test(resumeFile.name)
          ? { valid: false, reason: "That doesn't look like a résumé — please try another file." }
          : { valid: true, resumeText: '', highlight: '', field: '' }
        setResumeMeta(uploaded)
      } else {
        uploaded = await uploadResumeToR2(resumeFile)
        setResumeMeta(uploaded)

        const extractResponse = await fetch('/.netlify/functions/sera-extract-resume', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ objectKey: uploaded.objectKey }),
        })
        extracted = await extractResponse.json()

        if (!extractResponse.ok) {
          // A genuine server/API failure — NOT the same as "this isn't a résumé".
          // Don't blame the candidate's file for something on our end.
          setError(extracted.error || 'Something went wrong reading your résumé — please try again in a moment.')
          setResumeFile(null)
          setResumeMeta(null)
          setScreen('upload')
          return
        }
      }

      if (!extracted.valid) {
        setError(extracted.reason || "That doesn't look like a résumé — please try another file.")
        setResumeFile(null)
        setResumeMeta(null)
        setScreen('upload')
        return
      }

      preparedRef.current = { uploaded, extracted }
      setBusy(false)
      if (profile.route === 'student') {
        await startInterview()
      } else if (paidPaymentIdRef.current) {
        await startInterview({ paymentId: paidPaymentIdRef.current })
      } else {
        setScreen('pay')
      }
    } catch (err) {
      setError(err.message || 'Something went wrong — please try again')
      setScreen('upload')
    } finally {
      setBusy(false)
    }
  }, [resumeFile, profile, startInterview])

  const onPaymentSuccess = useCallback((paymentId) => startInterview({ paymentId }), [startInterview])

  // "Use a different résumé" from the pay screen.
  const changeResume = useCallback(() => {
    preparedRef.current = null
    setError(null)
    setResumeFile(null)
    setResumeMeta(null)
    setScreen('upload')
  }, [])

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

  const endCallEarly = useCallback(() => {
    if (import.meta.env.DEV) mockCallRef.current?.endNow()
    retellRef.current?.stopCall()
  }, [])

  useEffect(() => stopSessionTimer, [stopSessionTimer])
  useEffect(() => () => import.meta.env.DEV && mockCallRef.current?.stop(), [])

  // DEV ONLY — the mock call can run longer (student 10:00); phases scale to it.
  const mock = import.meta.env.DEV ? mockDurations : null
  const sessionSeconds = mock ? mock.session : SESSION_SECONDS
  const sessionSecondsLeft = Math.max(0, sessionSeconds - elapsed)
  const phase = phaseForElapsed(mock ? (elapsed * SESSION_SECONDS) / mock.session : elapsed)

  return {
    screen,
    error,
    busy,
    profile,
    resumeFile,
    resumeMeta,
    blockedMessage,
    sessionSecondsLeft,
    phase,
    turnState,
    turnElapsed,
    turnSeconds: mock ? mock.turn : TURN_SECONDS,
    muted,
    report,
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
