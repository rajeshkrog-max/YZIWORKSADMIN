// Where a refresh or a reopened login puts the candidate (src/shared/seraResumePoint.js, browser code).
import test from 'node:test'
import assert from 'node:assert/strict'
import { resumePoint } from '../src/shared/seraResumePoint.js'
import { createSession } from '../src/shared/seraSession.js'
import { SAMPLE_OFFERS } from '../netlify/lib/fixtures/seraOffers.js'

const s = (patch) => ({ ...createSession({ sessionId: 'x', route: 'visitor', email: 'p@example.com' }), ...patch })

test('resumePoint: every stage lands on the right screen', () => {
  assert.equal(resumePoint(null), null)
  assert.deepEqual(resumePoint(s({})), { screen: 'upload' })
  assert.deepEqual(resumePoint(s({ offers: SAMPLE_OFFERS })), { screen: 'pay' }, 'offers ready, not paid')
  assert.deepEqual(resumePoint(s({ offers: SAMPLE_OFFERS, payment: { orderId: 'o', paymentId: 'p' } })), { screen: 'upload' })
  assert.deepEqual(resumePoint(s({ offers: SAMPLE_OFFERS, route: 'student' })), { screen: 'upload' }, 'students never pay')
  assert.deepEqual(resumePoint(s({ status: 'live', rounds: { ...s({}).rounds, screening: { callId: 'c', status: 'live', transcript: null } } })), { screen: 'wrapup' })
  assert.deepEqual(resumePoint(s({ status: 'report_retrying' })), { screen: 'wrapup' })
  assert.deepEqual(resumePoint(s({ status: 'restart_available' })), { screen: 'restart' })
  assert.deepEqual(resumePoint(s({ status: 'incomplete' })), { screen: 'report', incomplete: true })
  assert.deepEqual(resumePoint(s({ status: 'report_failed' })), { screen: 'report', incomplete: true })
  assert.deepEqual(resumePoint(s({ status: 'completed', report: { score: 1 } })), { screen: 'report' })
})
