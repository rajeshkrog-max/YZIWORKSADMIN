import test from 'node:test'
import assert from 'node:assert/strict'
import { msg91NumberMatches, pickPhoneSession } from './phoneSignIn.js'

test('msg91NumberMatches: only the exact verified number', () => {
  assert.equal(msg91NumberMatches('919876543210', '9876543210'), true)
  assert.equal(msg91NumberMatches('9876543210', '9876543210'), true)
  assert.equal(msg91NumberMatches('+91 98765 43210', '9876543210'), true)
  assert.equal(msg91NumberMatches('919876543211', '9876543210'), false)
  assert.equal(msg91NumberMatches('', '9876543210'), false)
  assert.equal(msg91NumberMatches(undefined, '9876543210'), false)
  assert.equal(msg91NumberMatches('Token verified', '9876543210'), false)
  assert.equal(msg91NumberMatches('919876543210', ''), false)
})

const reservations = { 'a@x.com': { sessionId: 's-report' }, 'b@x.com': null }
const reservationFor = async (email) => reservations[email] ?? null

test('pickPhoneSession: the furthest interview this number has', async () => {
  const sessions = [
    { sessionId: 's-new', phone: '9876543210', email: 'b@x.com' },
    { sessionId: 's-report', phone: '9876543210', email: 'a@x.com', report: { ok: 1 } },
    { sessionId: 's-other', phone: '9000000000', email: 'c@x.com', report: { ok: 1 } },
  ]
  assert.equal((await pickPhoneSession(sessions, '9876543210', reservationFor)).sessionId, 's-report')
})

test('pickPhoneSession: skips stale logins, demo sessions and other numbers', async () => {
  const sessions = [
    { sessionId: 's-stale', phone: '9876543210', email: 'a@x.com', offers: [1] }, // a@x.com's interview is s-report
    { sessionId: 's-demo', phone: '9876543210', email: 'd@demo.yziworks.com', demo: true, report: {} },
  ]
  assert.equal(await pickPhoneSession(sessions, '9876543210', reservationFor), null)
  assert.equal(await pickPhoneSession([], '9876543210', reservationFor), null)
})
