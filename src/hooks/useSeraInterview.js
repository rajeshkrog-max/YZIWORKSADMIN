import { useCallback, useEffect, useRef, useState } from 'react'
import { signInWithGoogle } from '../utils/googleAuth'
import { uploadResumeToR2 } from '../utils/seraUpload'

const SESSION_SECONDS = 5 * 60
const TURN_SECONDS = 35
const PHASE_SKILLS_START = 55 // 0:55
const PHASE_GOAL_START = 230 // 3:50

function phaseForElapsed(elapsed) {
  if (elapsed < PHASE_SKILLS_START) return 'warmup'
  if (elapsed < PHASE_GOAL_START) return 'skills'
  return 'goal'
}

// Screens: hero | signin | upload | preparing | interview | wrapup | report | blocked
export function useSeraInterview() {
  const [screen, setScreen] = useState('hero')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const [profile, setProfile] = useState(null)
  const [resumeFile, setResumeFile] = useState(null)
  const [resumeMeta, setResumeMeta] = useState(null)
  const [resumeData, setResumeData] = useState(null)

  const [elapsed, setElapsed] = useState(0)
  const [turnState, setTurnState] = useState('sera-speaking') // sera-speaking | your-turn | wrapping-up
  const [turnElapsed, setTurnElapsed] = useState(0)
  const [muted, setMuted] = useState(false)
  const [report, setReport] = useState(null)
  const [blockedMessage, setBlockedMessage] = useState(null)

  const retellRef = useRef(null)
  const transcriptRef = useRef('')
  const sessionTimerRef = useRef(null)
  const turnActiveRef = useRef(false)

  const reset = useCallback(() => {
    setScreen('hero')
    setError(null)
    setBusy(false)
    setProfile(null)
    setResumeFile(null)
    setResumeMeta(null)
    setResumeData(null)
    setElapsed(0)
    setTurnState('sera-speaking')
    setTurnElapsed(0)
    turnActiveRef.current = false
    setMuted(false)
    setReport(null)
    setBlockedMessage(null)
    transcriptRef.current = ''
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

  const finishInterview = useCallback(async () => {
    stopSessionTimer()
    setScreen('wrapup')

    try {
      const response = await fetch('/.netlify/functions/sera-analyze-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateName: profile?.name,
          resumeText: resumeData?.resumeText,
          transcript: transcriptRef.current,
        }),
      })
      const result = await response.json()
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Unable to prepare your report')
      }
      setReport(result.report)
    } catch (err) {
      setError(err.message || 'Unable to prepare your report')
    } finally {
      setScreen('report')
    }
  }, [profile, resumeData, stopSessionTimer])

  const startSessionTimer = useCallback(() => {
    stopSessionTimer()
    setElapsed(0)
    sessionTimerRef.current = setInterval(() => {
      setElapsed((prev) => {
        const next = prev + 1
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
        setTurnElapsed((prev) => Math.min(prev + 1, TURN_SECONDS))
      }
    }, 1000)
  }, [finishInterview, stopSessionTimer])

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
        setTurnElapsed(0)
        setTurnState('sera-speaking')
      })
      client.on('agent_stop_talking', () => {
        turnActiveRef.current = true
        setTurnElapsed(0)
        setTurnState('your-turn')
      })
      client.on('update', (update) => {
        if (typeof update?.transcript === 'string') {
          transcriptRef.current = update.transcript
        }
      })
      client.on('call_ended', () => {
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

  const beginInterview = useCallback(async () => {
    if (!resumeFile || !profile) return
    setBusy(true)
    setError(null)
    setScreen('preparing')

    try {
      const uploaded = await uploadResumeToR2(resumeFile)
      setResumeMeta(uploaded)

      const extractResponse = await fetch('/.netlify/functions/sera-extract-resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ objectKey: uploaded.objectKey }),
      })
      const extracted = await extractResponse.json()

      if (!extractResponse.ok || !extracted.valid) {
        setError(extracted.reason || "That doesn't look like a résumé — please try another file.")
        setScreen('upload')
        return
      }
      setResumeData(extracted)

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

      setScreen('interview')
      setTurnState('sera-speaking')
      await connectRetell(startResult.accessToken)
    } catch (err) {
      setError(err.message || 'Something went wrong — please try again')
      setScreen('upload')
    } finally {
      setBusy(false)
    }
  }, [resumeFile, profile, connectRetell])

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
    retellRef.current?.stopCall()
  }, [])

  useEffect(() => stopSessionTimer, [stopSessionTimer])

  const sessionSecondsLeft = Math.max(0, SESSION_SECONDS - elapsed)
  const phase = phaseForElapsed(elapsed)

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
    turnSeconds: TURN_SECONDS,
    muted,
    report,
    goToSignIn,
    signIn,
    selectFile,
    beginInterview,
    toggleMute,
    endCallEarly,
    reset,
  }
}
