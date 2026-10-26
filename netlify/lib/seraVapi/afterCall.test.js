import test from 'node:test'
import assert from 'node:assert/strict'
import { decideAfterCall, reachedOffers } from './afterCall.js'

const said = { screening: [{ role: 'agent', text: 'Hi' }, { role: 'user', text: 'Hello' }], hr: [], final: [] }
const silent = { screening: [{ role: 'agent', text: 'Hi' }], hr: [], final: [] }
const base = { transcripts: said, candidateEnded: false, offersReached: false, restartsUsed: 0 }

test('before the offers, a lost call (error, refresh, silence) gets one restart', () => {
  for (const endedReason of ['pipeline-error-openai-llm-failed', 'customer-ended-call', 'silence-timed-out', null]) {
    assert.equal(decideAfterCall({ ...base, endedReason }), 'restart', endedReason)
  }
  assert.equal(decideAfterCall({ ...base, endedReason: 'customer-ended-call', transcripts: silent }), 'restart', 'a broken mic is a restart too')
})

test('no restart when the candidate pressed End, Sera ended it, or the restart was used', () => {
  assert.equal(decideAfterCall({ ...base, endedReason: 'customer-ended-call', candidateEnded: true }), 'report')
  assert.equal(decideAfterCall({ ...base, endedReason: 'assistant-ended-call' }), 'report')
  assert.equal(decideAfterCall({ ...base, endedReason: 'exceeded-max-duration' }), 'report')
  assert.equal(decideAfterCall({ ...base, endedReason: 'pipeline-error-x', restartsUsed: 1 }), 'report')
  assert.equal(decideAfterCall({ ...base, endedReason: 'assistant-ended-call', transcripts: silent }), 'incomplete')
})

test('after the offers, any end (even a provider error) is the report on what was said', () => {
  assert.equal(decideAfterCall({ ...base, endedReason: 'pipeline-error-x', offersReached: true }), 'report')
  assert.equal(decideAfterCall({ ...base, endedReason: 'pipeline-error-x', offersReached: true, transcripts: silent }), 'incomplete')
})

test('reachedOffers: show_offers, an offer pick, or a later round', () => {
  assert.equal(reachedOffers(null), false)
  assert.equal(reachedOffers({ round: 'screening' }), false)
  assert.equal(reachedOffers({ offersShownAt: '2026-10-26T10:00:00Z' }), true)
  assert.equal(reachedOffers({ handoffSent: true }), true)
  assert.equal(reachedOffers({ round: 'hr' }), true)
})
