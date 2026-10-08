// A round that is already part way through when the server restarts (spec 0001, AC-8).
// Steps already recorded are never sent again, overdue steps go straight away and in order,
// and "nearly up" is dropped when "up" is due or was sent. Run: npm test
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRoundTimers, planForResume, planRoundTimers } from './index.js'

const HR = planRoundTimers('hr', 240) // nearly 200, up 240, force-handoff 265, assume-final 275

test('resume plan: no elapsed time and nothing done is the whole plan, as before', () => {
  assert.deepEqual(planForResume(HR), HR)
  assert.deepEqual(planForResume(HR, { elapsedSeconds: 0, done: [] }), HR)
})

test('resume plan: steps already done never come back', () => {
  assert.deepEqual(planForResume(HR, { elapsedSeconds: 210, done: ['nearly'] }).map((p) => p.step), ['up', 'force-handoff', 'assume-final'])
})

test('resume plan: "nearly up" is dropped when "up" is due, or was already sent', () => {
  assert.deepEqual(planForResume(HR, { elapsedSeconds: 250 }).map((p) => p.step), ['up', 'force-handoff', 'assume-final'])
  assert.deepEqual(planForResume(HR, { elapsedSeconds: 100, done: ['up'] }).map((p) => p.step), ['force-handoff', 'assume-final'])
  assert.deepEqual(planForResume(HR, { elapsedSeconds: 205 }).map((p) => p.step), ['nearly', 'up', 'force-handoff', 'assume-final'], 'nearly is still useful before up is due')
})

function rig() {
  const sent = []
  const recorded = []
  const handles = []
  const timers = createRoundTimers({
    send: async (url, message) => sent.push(message.type === 'add-message' ? (message.message.content.includes('nearly') ? 'nearly' : 'up') : message.type),
    isCurrent: async () => true,
    record: async (_s, _r, step) => recorded.push(step),
    setTimer: (fn, ms) => {
      const h = { fn, ms }
      handles.push(h)
      return h
    },
    clearTimer: () => {},
  })
  return { timers, sent, recorded, handles }
}

test('resume: overdue steps run once, in order, in one go; future steps keep their remaining time', async () => {
  const { timers, sent, recorded, handles } = rig()
  timers.start({ sessionId: 's', round: 'hr', seconds: 240, controlUrl: 'u', elapsedSeconds: 270, done: ['nearly'] })
  // due now: up (240) and force-handoff (265) together; assume-final (275) in 5 s
  assert.deepEqual(handles.map((h) => h.ms), [0, 5000])
  for (const h of handles) await h.fn()
  assert.deepEqual(sent, ['up', 'handoff'], '"up" first, then the backstop; assume-final sends nothing')
  assert.deepEqual(recorded, ['up', 'force-handoff', 'assume-final'])
})

test('resume: a step is recorded BEFORE it is sent, so a crash can lose a note but never repeat it', async () => {
  const order = []
  const handles = []
  const timers = createRoundTimers({
    send: async () => order.push('send'),
    isCurrent: async () => true,
    record: async () => order.push('record'),
    setTimer: (fn) => {
      const h = { fn }
      handles.push(h)
      return h
    },
    clearTimer: () => {},
  })
  timers.start({ sessionId: 's', round: 'final', seconds: 240, controlUrl: 'u', elapsedSeconds: 245 })
  await handles[0].fn()
  assert.deepEqual(order.slice(0, 2), ['record', 'send'])
})

test('resume: a step the round has moved past is not recorded or sent', async () => {
  const sent = []
  const recorded = []
  const handles = []
  const timers = createRoundTimers({
    send: async (_u, m) => sent.push(m),
    isCurrent: async () => false,
    record: async (_s, _r, step) => recorded.push(step),
    setTimer: (fn) => {
      const h = { fn }
      handles.push(h)
      return h
    },
    clearTimer: () => {},
  })
  timers.start({ sessionId: 's', round: 'hr', seconds: 240, controlUrl: 'u', elapsedSeconds: 300 })
  for (const h of handles) await h.fn()
  assert.deepEqual([sent.length, recorded.length], [0, 0])
})

test('default start is unchanged: every step on its own timer from zero', () => {
  const { timers, handles } = rig()
  timers.start({ sessionId: 's', round: 'final', seconds: 240, controlUrl: 'u' })
  assert.deepEqual(handles.map((h) => h.ms), [200_000, 240_000, 260_000])
})
