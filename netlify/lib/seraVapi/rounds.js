// Round timing for the ONE squad call. Pure: timers and the network are injected.
//
// Vinit's and Sonia's prompts say: "You can't see a clock. The interview system tracks time
// for you and may send you a short system note about time remaining." This module is that
// system: at a set time into each round it adds a "time is nearly up" and then a "time is
// up" note to the live call, with graceful backstops if an assistant does not wrap up.
import { roundOfAssistantName, SQUAD_MEMBERS } from './squad.js'

export const NEARLY_UP_LEAD_SECONDS = 40 // "nearly up" this long before the round's end
export const HANDOFF_BACKSTOP_SECONDS = 25 // HR: if Vinit has not handed to Sonia this long after "time is up"
export const FINAL_END_BACKSTOP_SECONDS = 20 // Final: Sonia has no end-call tool, so end the call this long after "time is up"

export const ROUND_ORDER = ['screening', 'hr', 'final']

// Which round Vapi's server message says is now speaking (null if it does not say).
// `assistant.started` / `speech-update` carry the assistant; `conversation-update` carries the
// messages, each stamped with `assistantName`.
export function roundFromServerMessage(message) {
  if (!message || typeof message !== 'object') return null
  if (message.type === 'assistant.started' || message.type === 'speech-update') {
    return roundOfAssistantName(message.assistant?.name ?? message.newAssistant?.name ?? message.assistantName)
  }
  if (message.type === 'conversation-update') {
    for (const list of [message.messages, message.conversation, message.messagesOpenAIFormatted]) {
      if (!Array.isArray(list)) continue
      for (let i = list.length - 1; i >= 0; i--) {
        const round = roundOfAssistantName(list[i]?.assistantName)
        if (round) return round
      }
    }
  }
  return null
}

// Only ever forward: a late or repeated message must not move the interview backwards.
export const isForward = (from, to) => ROUND_ORDER.indexOf(to) > ROUND_ORDER.indexOf(from ?? 'screening')

export const roundNote = (kind) => ({
  type: 'add-message',
  // "nearly up" is read on the next turn (let them finish the sentence); "up" makes the assistant close now.
  triggerResponseEnabled: kind === 'up',
  message: { role: 'system', content: kind === 'up' ? 'Interview system note: time is up.' : 'Interview system note: time is nearly up.' },
})

export const FORCE_HANDOFF_TO_SONIA = {
  type: 'handoff',
  destination: { type: 'assistant', assistantName: SQUAD_MEMBERS.final },
}

export const END_CALL = { type: 'end-call' }

// The steps for one round, in seconds from the moment it starts.
// → [{ afterSeconds, step: 'nearly' | 'up' | 'force-handoff' | 'end-call' }]
export function planRoundTimers(round, seconds) {
  const nearly = Math.max(Math.round(seconds / 2), seconds - NEARLY_UP_LEAD_SECONDS)
  const plan = [
    { afterSeconds: nearly, step: 'nearly' },
    { afterSeconds: seconds, step: 'up' },
  ]
  if (round === 'hr') {
    plan.push({ afterSeconds: seconds + HANDOFF_BACKSTOP_SECONDS, step: 'force-handoff' }) // only if Vapi's signals show Vinit still talking
    plan.push({ afterSeconds: seconds + HANDOFF_BACKSTOP_SECONDS + 10, step: 'assume-final' }) // only if no signals were ever seen
  }
  if (round === 'final') plan.push({ afterSeconds: seconds + FINAL_END_BACKSTOP_SECONDS, step: 'end-call' })
  return plan
}

// A round that is already part way through (the server restarted): which steps are still owed, in order.
//  elapsedSeconds  how long the round has been running
//  done            steps already recorded as sent, never sent again
// "nearly up" is dropped once "up" has been sent or is due, because it would only confuse the assistant.
// With no elapsed time and nothing done this returns the whole plan, the same as a fresh start.
export function planForResume(plan, { elapsedSeconds = 0, done = [] } = {}) {
  const remaining = plan.filter((p) => !done.includes(p.step))
  if (!(elapsedSeconds > 0) && done.length === 0) return remaining
  const upGone = done.includes('up') || remaining.some((p) => p.step === 'up' && p.afterSeconds <= elapsedSeconds)
  return upGone ? remaining.filter((p) => p.step !== 'nearly') : remaining
}

// null = a state-only step (nothing is sent to the call).
const messageFor = (step) =>
  step === 'nearly' ? roundNote('nearly') : step === 'up' ? roundNote('up') : step === 'force-handoff' ? FORCE_HANDOFF_TO_SONIA : step === 'end-call' ? END_CALL : null

// One set of timers per interview session.
//  send(controlUrl, message)           → POST to the call's live-control URL
//  isCurrent(sessionId, round, step)   → false once the round moved on or the call ended (the step is skipped)
//  record(sessionId, round, step)      → called BEFORE a step is sent, so a crash can lose one note but never repeat it
//  onEvent({ sessionId, round, step, ok, error })  → logging hook
// `scale` shrinks every delay (tests only).
export function createRoundTimers({ send, isCurrent, record, onEvent = () => {}, setTimer = setTimeout, clearTimer = clearTimeout, scale = 1 }) {
  const active = new Map() // sessionId -> { round, handles }

  const clear = (sessionId) => {
    for (const handle of active.get(sessionId)?.handles ?? []) clearTimer(handle)
    active.delete(sessionId)
  }

  return {
    clear,
    isRunning: (sessionId, round) => active.get(sessionId)?.round === round,
    // Starting a round clears the previous round's pending steps.
    // `elapsedSeconds` and `done` start a round part way through (after a restart): steps already due fire
    // once, in order, straight away; steps in `done` never fire again.
    start({ sessionId, round, seconds, controlUrl, elapsedSeconds = 0, done = [] }) {
      clear(sessionId)
      const resuming = elapsedSeconds > 0 || done.length > 0
      const runStep = async (step) => {
        try {
          if (!(await isCurrent(sessionId, round, step))) return
          await record?.(sessionId, round, step)
          const message = messageFor(step)
          if (message) await send(controlUrl, message)
          onEvent({ sessionId, round, step, ok: true })
        } catch (error) {
          onEvent({ sessionId, round, step, ok: false, error: error?.message ?? String(error) })
        }
      }
      const plan = planForResume(planRoundTimers(round, seconds), { elapsedSeconds, done })
      const overdue = resuming ? plan.filter((p) => p.afterSeconds <= elapsedSeconds) : []
      const handles = []
      if (overdue.length) {
        // One timer, run in order, so "up" is always sent before the backstops that follow it.
        const handle = setTimer(async () => {
          for (const { step } of overdue) await runStep(step)
        }, 0)
        handle?.unref?.()
        handles.push(handle)
      }
      for (const { afterSeconds, step } of plan) {
        if (overdue.some((o) => o.step === step)) continue
        const handle = setTimer(() => runStep(step), Math.max(0, (afterSeconds - elapsedSeconds) * 1000 * scale))
        handle?.unref?.()
        handles.push(handle)
      }
      active.set(sessionId, { round, handles })
    },
  }
}
