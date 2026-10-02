import test from 'node:test'
import assert from 'node:assert/strict'
import * as store from './store.js'

test('store: checkStudentCode valid and invalid codes', async () => {
  const valid = await store.checkStudentCode('YZI-PUNE-OCT26')
  assert.equal(valid.valid, true)
  assert.equal(valid.instituteName, 'Pune Institute of Applied Technology')
  assert.ok(valid.seatsLeft > 0)

  const invalid = await store.checkStudentCode('NONEXISTENT')
  assert.equal(invalid.valid, false)
  assert.equal(invalid.reason, 'not_found')
})

test('store: session persistence and lookup by email and rejoin', async () => {
  const testSession = {
    sessionId: 'test-sess-1234',
    route: 'student',
    firstName: 'TestUser',
    email: 'testuser@example.com',
    phone: '9876543210',
    studentCode: 'YZI-PUNE-OCT26',
    rejoinCode: 'REJOIN-ABC1',
    rejoinToken: 'token-xyz-123',
    rejoinRound: 'hr',
    rejoinIssuedAt: Date.now(),
    rejoinUsed: false,
    status: 'dropped',
  }

  await store.saveSession(testSession)

  const retrieved = await store.getSession('test-sess-1234')
  assert.equal(retrieved.sessionId, 'test-sess-1234')
  assert.equal(retrieved.email, 'testuser@example.com')

  const byEmail = await store.findSessionByEmail('testuser@example.com')
  assert.equal(byEmail?.sessionId, 'test-sess-1234')

  const byCode = await store.findSessionByRejoin({ code: 'REJOIN-ABC1' })
  assert.equal(byCode?.sessionId, 'test-sess-1234')

  const byToken = await store.findSessionByRejoin({ token: 'token-xyz-123' })
  assert.equal(byToken?.sessionId, 'test-sess-1234')
})

test('store: consume student seat decrements seatsLeft', async () => {
  const before = await store.checkStudentCode('YZI-PUNE-OCT26')
  const initialSeats = before.seatsLeft

  const res = await store.consumeStudentSeat('YZI-PUNE-OCT26')
  assert.equal(res.success, true)
  assert.equal(res.seatsLeft, initialSeats - 1)

  const after = await store.checkStudentCode('YZI-PUNE-OCT26')
  assert.equal(after.seatsLeft, initialSeats - 1)
})
