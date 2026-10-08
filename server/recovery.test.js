// Restart recovery (spec 0001: AC-8, AC-9, AC-10, AC-11), with fakes and a fake clock. No network. Run: npm test
import test from 'node:test'
import assert from 'node:assert/strict'
import { MAX_REPORT_ATTEMPTS, canClaimReport, createRecovery, roundElapsedSeconds } from './recovery.js'

const NOW = Date.parse('2026-10-08T12:00:00.000Z')
const ago = (seconds) => new Date(NOW - seconds * 1000).toISOString()
const ROUND_SECONDS = { screening: 300, hr: 240, final: 240 }

function rig({ sessions = [], reservations = [], key = true, calls = {}, startFails = [] } = {}) {
  const log = []
  const timers = { started: [], running: new Set(), cleared: [] }
  const refunds = []
  const released = []
  const handled = []
  const finalized = []
  const db = new Map(sessions.map((s) => [s.sessionId, s]))
  const recovery = createRecovery({
    store: {
      listSessions: async () => [...db.values()].map((s) => structuredClone(s)),
      listReservations: async () => reservations,
      releaseReservationByKey: async (k) => released.push(k),
      refundStudentSeat: async (code) => refunds.push(code),
    },
    roundTimers: {
      isRunning: (id, round) => timers.running.has(`${id}:${round}`),
      start: (args) => {
        if (startFails.includes(args.sessionId)) throw new Error('boom')
        timers.started.push(args)
      },
      clear: (id) => timers.cleared.push(id),
    },
    roundSeconds: ROUND_SECONDS,
    hasVapiKey: () => key,
    getCall: async (callId) => {
      const r = calls[callId]
      if (r instanceof Error) throw r
      return r
    },
    callToEndOfCall: (call) =>
      call?.status === 'ended' && call.endedAt
        ? { callId: call.id, sessionId: call.sessionId ?? null, endedReason: call.endedReason, messages: [], endedAt: call.endedAt }
        : null,
    processEndOfCall: async (e) => handled.push(e),
    finalizeReport: async (id, opts) => finalized.push([id, opts]),
    mutateSession: async (id, fn) => {
      const s = db.get(id)
      return s ? fn(s) : null
    },
    now: () => NOW,
    log: (m) => log.push(m),
  })
  return { recovery, log, timers, refunds, released, handled, finalized, db }
}

const live = (extra = {}) => ({
  sessionId: 'sess-live-0001',
  status: 'live',
  vapi: { callId: 'call-1', controlUrl: 'https://control/x', startedAt: ago(100), round: 'screening', ...extra },
  rounds: {},
})

test('roundElapsedSeconds: screening from the call start, HR from the handoff, unknown is null', () => {
  assert.equal(roundElapsedSeconds({ round: 'screening', startedAt: ago(100) }, NOW), 100)
  assert.equal(roundElapsedSeconds({ round: 'hr', roundStartedAt: { hr: ago(30) }, handoffAt: ago(90) }, NOW), 30)
  assert.equal(roundElapsedSeconds({ round: 'hr', handoffAt: ago(90) }, NOW), 90)
  assert.equal(roundElapsedSeconds({ round: 'final' }, NOW), null)
})

test('AC-8: a live call gets its round timers back, part way through, with the steps already sent left out', async () => {
  const r = rig({ sessions: [live({ round: 'hr', handoffAt: ago(250), timerSteps: { hr: { nearly: ago(50) } } })] })
  const summary = await r.recovery.sweep({ startup: true, startedMs: NOW })
  assert.equal(summary.rearmed, 1)
  assert.deepEqual(r.timers.started, [
    { sessionId: 'sess-live-0001', round: 'hr', seconds: 240, controlUrl: 'https://control/x', elapsedSeconds: 250, done: ['nearly'] },
  ])
})

test('AC-8: timers that are already running are left alone, and no key does not stop the re-arm', async () => {
  const r = rig({ sessions: [live()], key: false })
  r.timers.running.add('sess-live-0001:screening')
  assert.equal((await r.recovery.sweep({ startup: true })).rearmed, 0)
  r.timers.running.clear()
  assert.equal((await r.recovery.sweep({ startup: true })).rearmed, 1)
})

test('AC-9: a call that ended while the server was away is handled once the 90 s wait is over', async () => {
  const ended = { id: 'call-1', status: 'ended', endedAt: ago(120), endedReason: 'customer-ended-call', sessionId: 'sess-live-0001' }
  const r = rig({ sessions: [live()], calls: { 'call-1': ended } })
  const summary = await r.recovery.sweep({ startup: true })
  assert.equal(summary.caughtUp, 1)
  assert.equal(r.handled.length, 1)
  assert.equal(r.handled[0].sessionId, 'sess-live-0001')
  assert.equal(r.timers.started.length, 0, 'no timers for a call that is over')
})

test('AC-9: inside the 90 s wait nothing is done yet, the webhook may still arrive', async () => {
  const r = rig({ sessions: [live()], calls: { 'call-1': { id: 'call-1', status: 'ended', endedAt: ago(30), endedReason: 'x' } } })
  const summary = await r.recovery.sweep({ startup: true })
  assert.deepEqual([summary.caughtUp, summary.rearmed, r.handled.length], [0, 0, 0])
})

test('AC-9: Vapi says the call does not exist (404): incomplete, no report, no refund', async () => {
  const r = rig({
    sessions: [live({ seatConsumedFor: 'CODE-1', paymentOrderId: 'order-1' })],
    calls: { 'call-1': Object.assign(new Error('x'), { status: 404 }) },
  })
  const summary = await r.recovery.sweep({ startup: true })
  assert.equal(summary.missing, 1)
  const s = r.db.get('sess-live-0001')
  assert.deepEqual([s.status, s.vapi.endHandled, s.vapi.endedReason], ['incomplete', true, 'call-not-found'])
  assert.deepEqual([r.refunds, r.finalized, r.handled], [[], [], []])
  assert.deepEqual(r.timers.cleared, ['sess-live-0001'])
})

test('AC-9: a Vapi error other than 404 changes nothing and is logged once an hour', async () => {
  const r = rig({ sessions: [live()], calls: { 'call-1': Object.assign(new Error('x'), { status: 503 }) } })
  await r.recovery.sweep({ startup: true })
  await r.recovery.sweep({})
  assert.equal(r.db.get('sess-live-0001').vapi.endHandled, undefined)
  assert.equal(r.log.filter((m) => /could not read a call/.test(m)).length, 1)
})

test('AC-9: a call that never ended and is older than 30 minutes is left alone, with one log line', async () => {
  const r = rig({ sessions: [live({ startedAt: ago(31 * 60) })], key: false })
  const summary = await r.recovery.sweep({ startup: true })
  await r.recovery.sweep({})
  assert.equal(summary.rearmed, 0)
  assert.equal(r.log.filter((m) => /left alone/.test(m)).length, 1)
})

const finished = (extra = {}) => ({
  sessionId: 'sess-done-0001',
  status: 'live',
  vapi: { callId: 'call-2', endHandled: true, endedReason: 'customer-ended-call', startedAt: ago(900) },
  rounds: { screening: { transcript: [{ role: 'user', text: 'hi', start: 0, end: 1 }] }, hr: {}, final: {} },
  ...extra,
})

test('AC-10: a report that was running when the server stopped is retried once', async () => {
  const r = rig({ sessions: [finished({ reportState: 'running', reportStartedAt: ago(600) })] })
  const summary = await r.recovery.sweep({ startup: true, startedMs: NOW })
  assert.equal(summary.reportsRetried, 1)
  assert.deepEqual(r.finalized, [['sess-done-0001', { stale: true }]])
})

test('AC-10: nothing is retried a second time, a failed report is not retried, a running one from this process is not touched', async () => {
  const cases = [
    finished({ reportState: 'running', reportStartedAt: ago(600), reportAttempts: MAX_REPORT_ATTEMPTS }),
    finished({ reportState: 'failed', reportAttempts: 1 }),
    finished({ reportState: 'running', reportStartedAt: ago(5) }), // started after this process did
    finished({ reportState: 'done', report: {} }),
  ]
  for (const session of cases) {
    const r = rig({ sessions: [session] })
    await r.recovery.sweep({ startup: true, startedMs: NOW - 60_000 })
    assert.equal(r.finalized.length, 0, JSON.stringify({ state: session.reportState, attempts: session.reportAttempts }))
  }
})

test('AC-10: an ended call with no report state is a crash leftover only at start up, and only if it would have had a report', async () => {
  const stranded = rig({ sessions: [finished()] })
  await stranded.recovery.sweep({ startup: true })
  assert.equal(stranded.finalized.length, 1)

  const later = rig({ sessions: [finished()] })
  await later.recovery.sweep({ startup: false })
  assert.equal(later.finalized.length, 0, 'later sweeps leave it: its report is about to begin')

  const silent = rig({ sessions: [finished({ rounds: { screening: { transcript: [] }, hr: {}, final: {} } })] })
  await silent.recovery.sweep({ startup: true })
  assert.equal(silent.finalized.length, 0, 'the candidate never spoke: no report, no cost')
})

test('canClaimReport: the webhook path is as before; a recovery retry may take over an old running report once', () => {
  assert.equal(canClaimReport({}), true)
  assert.equal(canClaimReport({ report: {} }), false)
  assert.equal(canClaimReport({ reportState: 'running', reportStartedAt: ago(600) }), false)
  assert.equal(canClaimReport({ reportState: 'running', reportStartedAt: ago(600) }, { stale: true, processStartedMs: NOW }), true)
  assert.equal(canClaimReport({ reportState: 'running', reportStartedAt: ago(1) }, { stale: true, processStartedMs: NOW - 60_000 }), false)
  assert.equal(canClaimReport({ reportState: 'failed' }, { stale: true, processStartedMs: NOW }), false)
  assert.equal(canClaimReport({ reportState: 'failed' }), true, 'unchanged behaviour for the webhook')
  assert.equal(canClaimReport({ reportAttempts: 2 }, { stale: true }), false)
})

const reservation = (extra = {}) => ({ key: 'a'.repeat(64), status: 'reserved', reservedAt: ago(6 * 60), sessionId: 'sess-r-0001', ...extra })

test('AC-11: a slot taken before a crash is released after 5 minutes, and a consumed seat is given back', async () => {
  const r = rig({ sessions: [{ sessionId: 'sess-r-0001', status: 'new' }], reservations: [reservation({ seatConsumedFor: 'CODE-1' })] })
  const summary = await r.recovery.sweep({ startup: true })
  assert.equal(summary.released, 1)
  assert.deepEqual([r.released, r.refunds], [['a'.repeat(64)], ['CODE-1']])
  const noSeat = rig({ reservations: [reservation()] })
  await noSeat.recovery.sweep({})
  assert.deepEqual([noSeat.released.length, noSeat.refunds.length], [1, 0])
})

test('AC-11: a young reservation, a started one and one whose call exists are never released', async () => {
  const withCall = { sessionId: 'sess-r-0001', status: 'live', vapi: { callId: 'c', startedAt: ago(60), round: 'screening' } }
  const r = rig({
    sessions: [withCall],
    reservations: [
      reservation({ key: '1'.repeat(64) }),
      reservation({ key: '2'.repeat(64), sessionId: 'other', reservedAt: ago(60) }),
      reservation({ key: '3'.repeat(64), status: 'started', sessionId: 'other' }),
    ],
    key: false,
  })
  await r.recovery.sweep({ startup: true })
  assert.deepEqual(r.released, [])
})

test('a sweep that is still running is not started twice', async () => {
  const r = rig({ sessions: [live()], key: false })
  const first = r.recovery.sweep({ startup: true })
  assert.equal(await r.recovery.sweep({ startup: true }), null)
  await first
})

test('one bad session does not stop the others', async () => {
  const bad = { sessionId: 'sess-bad-0001', vapi: { callId: 'x', startedAt: ago(10), round: 'screening', controlUrl: 'u' } }
  const r = rig({ sessions: [bad, live()], key: false, startFails: ['sess-bad-0001'] })
  const summary = await r.recovery.sweep({ startup: true })
  assert.equal(summary.rearmed, 1)
  assert.ok(r.log.some((m) => /could not be checked/.test(m)))
})
