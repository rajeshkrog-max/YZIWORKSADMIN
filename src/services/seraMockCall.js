// DEV ONLY — simulated Sera call for mock mode (VITE_SERA_MOCK=true on the
// Vite dev server). Every caller gates on import.meta.env.DEV, so none of this
// ships in a production build. No sera-start-call, no Retell: the interview
// screen is driven by fake ticks. The panel lives in components/sera/dev/.
import { isMockMode } from './seraAuthService'

export const isDevMock = () => import.meta.env.DEV && isMockMode()

const SPEAK_SECONDS = 6 // "Sera speaking" before each turn
const ANSWER_SECONDS = 8 // "Your turn" advances early so you don't wait out the full turn
const WRAP_SECONDS = 25 // matches the real screen's "Wrapping up" window
const DROP_INCOMPLETE_BELOW = 120 // dropped under 2 min → incomplete report
export const MOCK_REPORT_DELAY_MS = 3000

// Session and turn lengths per route (visitor 5:00 / 35s, student 10:00 / 45s).
const durationsFor = (route) => (route === 'student' ? { session: 600, turn: 45 } : { session: 300, turn: 35 })

export const MOCK_REPORT = {
  strengths: [
    'Explained your recent project clearly, with a concrete example of what you built.',
    'Stayed calm on the follow-up question and kept your answer on point.',
    'Clear about the role you want next and a realistic timeline for it.',
  ],
  growthAreas: [
    'Add numbers to your results — "cut report time from 2 hours to 20 minutes" lands harder.',
    'Lead with the outcome, then the detail; a couple of answers took a while to reach the point.',
  ],
  seraNote:
    "You clearly know your tools. Next step: tell the story of what changed because of your work — that's what interviewers remember.",
  roadmap: [
    { role: 'Junior Data Analyst', description: 'Where your current skills already fit today.', skills: ['Excel', 'SQL basics', 'Reporting'] },
    { role: 'Data Analyst', description: 'One focused step up within 6–12 months.', skills: ['Power BI', 'Python', 'Stakeholder updates'] },
    { role: 'Analytics Lead', description: 'Where this path can go with steady growth.', skills: ['Team leading', 'Data strategy'] },
  ],
}

// ── Tiny store shared by the DEV panel, the fake call and the pay screen ─────
let devState = { call: null, payOutcome: 'success' }
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

// Starts a fake call. onUpdate({ elapsed, turnState, turnElapsed }) every second;
// onEnd({ incomplete }) once, when time runs out or the call is ended/dropped.
export function createMockCall({ route, onUpdate, onEnd }) {
  const durations = durationsFor(route)
  const { session } = durations
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
  const end = (incomplete) => {
    if (done) return
    stop()
    onEnd({ incomplete })
  }

  const tick = () => {
    elapsed += 1
    if (elapsed >= session) return end(false)
    if (session - elapsed <= WRAP_SECONDS) {
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

  const controls = {
    durations,
    skipToLast30: () => {
      if (done) return
      elapsed = Math.max(elapsed, session - 30)
      turnState = 'sera-speaking'
      turnElapsed = 0
      stepLeft = SPEAK_SECONDS
      push()
    },
    endNow: () => end(false),
    drop: () => end(elapsed < DROP_INCOMPLETE_BELOW),
    stop,
  }

  timer = setInterval(tick, 1000)
  setDev({ call: controls })
  push()
  return controls
}
