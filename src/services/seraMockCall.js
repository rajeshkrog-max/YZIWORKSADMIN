// DEV ONLY — simulated Sera call for mock mode (VITE_SERA_MOCK=true on the
// Vite dev server). Every caller gates on import.meta.env.DEV, so none of this
// ships in a production build. No sera-start-call, no Retell: the interview
// screen is driven by fake ticks. The panel lives in components/sera/dev/.
import { isMockMode } from './seraAuthService'

export const isDevMock = () => import.meta.env.DEV && isMockMode()

const SPEAK_SECONDS = 6 // "Sera speaking" before each turn
const ANSWER_SECONDS = 8 // "Your turn" advances early so you don't wait out the full turn
export const MOCK_REPORT_DELAY_MS = 7000 // long enough to watch the wrap-up checklist

// ── Tiny store shared by the DEV panel, the fake call and the pay screen ─────
let devState = { call: null, payOutcome: 'success', skipWrapupDelay: false, ui: null }
let devListeners = null
export const setDev = (patch) => {
  devState = { ...devState, ...patch }
  devListeners?.forEach((listener) => listener())
}
export const subscribeDev = (listener) => {
  devListeners ??= new Set()
  devListeners.add(listener)
  return () => devListeners.delete(listener)
}
export const getDevState = () => devState

// The pay screen reads (and resets) the outcome armed from the panel.
export function takeMockPayOutcome() {
  const outcome = devState.payOutcome
  if (outcome !== 'success') setDev({ payOutcome: 'success' })
  return outcome
}

// Runs ONE fake round. onUpdate({ elapsed, turnState, turnElapsed }) every
// second; onEnd({ reason, elapsed }) once — reason: 'time' (round ran out),
// 'ended' (candidate ended) or 'dropped'. The last `wrapSeconds` show as
// 'wrapping-up' (Sera analysing). `extra` controls (e.g. jumpToOffers) are
// exposed to the DEV panel alongside the call controls.
export function createMockCall({ seconds, wrapSeconds, onUpdate, onEnd, extra = {} }) {
  let elapsed = 0
  let turnState = 'sera-speaking'
  let turnElapsed = 0
  let stepLeft = SPEAK_SECONDS
  let done = false
  let timer = null

  const push = () => onUpdate({ elapsed, turnState, turnElapsed })
  const stop = () => {
    done = true
    clearInterval(timer)
    if (devState.call === controls) setDev({ call: null })
  }
  const end = (reason) => {
    if (done) return
    stop()
    onEnd({ reason, elapsed })
  }

  const tick = () => {
    elapsed += 1
    if (elapsed >= seconds) return end('time')
    if (seconds - elapsed <= wrapSeconds) {
      turnState = 'wrapping-up'
      turnElapsed = 0
    } else if (turnState === 'your-turn') {
      turnElapsed += 1
      if (--stepLeft <= 0) {
        turnState = 'sera-speaking'
        turnElapsed = 0
        stepLeft = SPEAK_SECONDS
      }
    } else if (--stepLeft <= 0) {
      turnState = 'your-turn'
      turnElapsed = 0
      stepLeft = ANSWER_SECONDS
    }
    push()
  }

  const jumpTo = (secondsLeft) => {
    if (done) return
    elapsed = Math.max(elapsed, seconds - secondsLeft)
    turnState = 'sera-speaking'
    turnElapsed = 0
    stepLeft = SPEAK_SECONDS
    push()
  }

  const controls = {
    ...extra,
    skipToLast30: () => jumpTo(30),
    skipToEndOfRound: () => end('time'),
    finishRoundNow: () => end('time'),
    endNow: () => end('ended'),
    drop: () => end('dropped'),
    stop,
  }

  timer = setInterval(tick, 1000)
  setDev({ call: controls })
  push()
  return controls
}

// ── Mock interview sessions (dropped-call / rejoin testing) ──────────────────
// Kept in sessionStorage so a rejoin link opened with a full page load still
// finds the dropped session. Test values: visitor link token and student code.
export const MOCK_REJOIN_TOKEN = 'REJOIN-LINK-TEST'
export const MOCK_REJOIN_CODE = 'REJOIN-TEST'
const SESSIONS_KEY = 'sera-mock-sessions'

export function readMockSessions() {
  try {
    return JSON.parse(sessionStorage.getItem(SESSIONS_KEY)) ?? {}
  } catch {
    return {}
  }
}

export function saveMockSession(sessionId, patch) {
  if (!sessionId) return null
  const sessions = readMockSessions()
  sessions[sessionId] = { ...sessions[sessionId], sessionId, ...patch, updatedAt: Date.now() }
  try {
    sessionStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions))
  } catch {
    // Storage blocked: rejoin testing just won't survive a reload.
  }
  return sessions[sessionId]
}

// Latest session whose rejoin link token or code matches.
export function findMockSessionByRejoin({ token, code }) {
  return Object.values(readMockSessions())
    .filter((s) => (token && s.rejoinToken === token) || (code && s.rejoinCode === code))
    .sort((a, b) => b.updatedAt - a.updatedAt)[0]
}
