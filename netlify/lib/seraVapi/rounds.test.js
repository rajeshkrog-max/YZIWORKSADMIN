// Run: npm test   (node's built-in test runner — no framework)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  FORCE_HANDOFF_TO_SONIA,
  createRoundTimers,
  isForward,
  planRoundTimers,
  roundFromServerMessage,
  roundNote,
  splitRounds,
} from './index.js'

const DASH = '–'

test('plan: nearly-up a little before the end, then up, then a backstop per round', () => {
  assert.deepEqual(planRoundTimers('hr', 240), [
    { afterSeconds: 200, step: 'nearly' },
    { afterSeconds: 240, step: 'up' },
    { afterSeconds: 265, step: 'force-handoff' },
    { afterSeconds: 275, step: 'assume-final' },
  ])
  assert.deepEqual(planRoundTimers('final', 240).map((s) => s.step), ['nearly', 'up', 'end-call'])
  assert.equal(planRoundTimers('final', 240).at(-1).afterSeconds, 260)
  // a very short round still gets nearly-up before up
  const [nearly, up] = planRoundTimers('hr', 30)
  assert.ok(nearly.afterSeconds < up.afterSeconds)
})

test('notes: nearly-up waits for the next turn, time-up makes the assistant close now', () => {
  assert.equal(roundNote('nearly').triggerResponseEnabled, false)
  assert.equal(roundNote('up').triggerResponseEnabled, true)
  assert.match(roundNote('nearly').message.content, /nearly up/)
  assert.match(roundNote('up').message.content, /time is up/)
  assert.equal(roundNote('up').message.role, 'system')
  assert.deepEqual(FORCE_HANDOFF_TO_SONIA.destination, { type: 'assistant', assistantName: 'sonia-final round' })
})

test('which round is speaking, from each kind of Vapi server message', () => {
  assert.equal(roundFromServerMessage({ type: 'assistant.started', assistant: { name: `Vinit ${DASH} HR Round` } }), 'hr')
  assert.equal(roundFromServerMessage({ type: 'assistant.started', newAssistant: { name: 'sonia-final round' } }), 'final')
  assert.equal(roundFromServerMessage({ type: 'speech-update', status: 'started', role: 'assistant', assistant: { name: `Sera ${DASH} Screening` } }), 'screening')
  const convo = {
    type: 'conversation-update',
    messages: [
      { role: 'bot', message: 'hi', assistantName: `Sera ${DASH} Screening` },
      { role: 'user', message: 'hello' },
      { role: 'bot', message: 'good to meet you', assistantName: `Vinit ${DASH} HR Round` },
      { role: 'user', message: 'thanks' },
    ],
  }
  assert.equal(roundFromServerMessage(convo), 'hr') // newest message that names its assistant
  assert.equal(roundFromServerMessage({ type: 'conversation-update', messages: [{ role: 'user', message: 'x' }] }), null)
  assert.equal(roundFromServerMessage({ type: 'status-update' }), null)
  assert.equal(roundFromServerMessage(null), null)
})

test('rounds only move forward', () => {
  assert.ok(isForward(undefined, 'hr') && isForward('screening', 'final') && isForward('hr', 'final'))
  assert.ok(!isForward('final', 'hr') && !isForward('hr', 'hr') && !isForward('hr', 'screening'))
})

test('timers: nearly, up and the backstop fire in order; starting the next round cancels the last', async () => {
  const sent = []
  const handles = []
  const timers = createRoundTimers({
    send: async (url, message) => sent.push({ url, type: message.type, text: message.message?.content ?? message.destination?.assistantName ?? '' }),
    isCurrent: async () => true,
    setTimer: (fn, ms) => { const h = { fn, ms, cleared: false }; handles.push(h); return h },
    clearTimer: (h) => { h.cleared = true },
  })
  timers.start({ sessionId: 's1', round: 'hr', seconds: 240, controlUrl: 'https://control/x' })
  assert.deepEqual(handles.map((h) => h.ms), [200_000, 240_000, 265_000, 275_000])
  assert.ok(timers.isRunning('s1', 'hr'))
  for (const h of handles) await h.fn()
  assert.deepEqual(sent.map((m) => m.type), ['add-message', 'add-message', 'handoff']) // assume-final sends nothing
  assert.match(sent[0].text, /nearly up/)
  assert.match(sent[1].text, /time is up/)

  const hr = [...handles]
  timers.start({ sessionId: 's1', round: 'final', seconds: 240, controlUrl: 'https://control/x' })
  assert.ok(hr.every((h) => h.cleared), 'the HR steps are cancelled when the final round starts')
  assert.equal(timers.isRunning('s1', 'final'), true)
  timers.clear('s1')
  assert.equal(timers.isRunning('s1', 'final'), false)
})

test('timers: a step is skipped once the round has moved on, and a failed send is reported, not thrown', async () => {
  const events = []
  const handles = []
  let current = true
  const timers = createRoundTimers({
    send: async () => { throw new Error('control down') },
    isCurrent: async () => current,
    onEvent: (e) => events.push(e),
    setTimer: (fn) => { const h = { fn }; handles.push(h); return h },
    clearTimer: () => {},
  })
  timers.start({ sessionId: 's2', round: 'final', seconds: 100, controlUrl: 'u' })
  await handles[0].fn()
  assert.deepEqual(events.map((e) => [e.step, e.ok]), [['nearly', false]])
  assert.equal(events[0].error, 'control down')
  current = false
  await handles[1].fn()
  assert.equal(events.length, 1, 'skipped: no send, no event')
})

test('report rounds come from assistantName on bot messages (the shape of a real Vapi call)', () => {
  const real = [
    { role: 'system', message: 'You are Sera…', secondsFromStart: 0 },
    { role: 'bot', message: 'Hi Vaibhav, I am Sera.', secondsFromStart: 1.2, duration: 3240, assistantName: `Sera ${DASH} Screening`, assistantId: 'a' },
    { role: 'user', message: 'Yes that is right.', secondsFromStart: 7 },
    { role: 'tool_calls', secondsFromStart: 229, toolCalls: [{ function: { name: 'show_offers' } }] },
    { role: 'tool_call_result', name: 'show_offers', result: 'The offers are on the candidate screen.', secondsFromStart: 250 },
    { role: 'bot', message: 'Good to meet you. I am Vinit from HR.', secondsFromStart: 271, assistantName: `Vinit ${DASH} HR Round` },
    { role: 'user', message: 'Sure.', secondsFromStart: 280 },
    { role: 'bot', message: 'I am Sonia, business head.', secondsFromStart: 480, assistantName: 'sonia-final round' },
    { role: 'user', message: 'Okay.', secondsFromStart: 496 },
  ]
  const { transcripts, attributedByName } = splitRounds(real)
  assert.ok(attributedByName)
  assert.deepEqual([transcripts.screening.length, transcripts.hr.length, transcripts.final.length], [2, 2, 2])
  assert.equal(transcripts.final[0].text, 'I am Sonia, business head.')
  assert.equal(transcripts.final[0].start, 0) // rebased to the round
})
