// Reading a finished call back from Vapi (spec 0001, AC-9). Fixture shaped like Vapi's GET /call/{id}.
// The shape is from Vapi's API reference and still has to be confirmed against one real past call once a
// VAPI_PRIVATE_KEY is on the server. Run: npm test
import test from 'node:test'
import assert from 'node:assert/strict'
import { VapiLookupError, VapiNotConfiguredError, callToEndOfCall, getCall, parseEndOfCall, vapiCallUrl } from './index.js'

const endedCall = {
  id: 'call-123',
  status: 'ended',
  endedReason: 'customer-ended-call',
  startedAt: '2026-10-08T10:00:00.000Z',
  endedAt: '2026-10-08T10:12:00.000Z',
  squadOverrides: { metadata: { sessionId: 'sess-abc', email: 'x@example.com' } },
  artifact: {
    messages: [
      { role: 'bot', message: 'Hello, I am Sera.', secondsFromStart: 1, duration: 2000, assistantName: 'Sera' },
      { role: 'user', message: 'Hi.', secondsFromStart: 4, duration: 500 },
    ],
  },
}

test('an ended call becomes the same thing the end-of-call webhook would have carried', () => {
  const fromCall = callToEndOfCall(endedCall)
  const fromWebhook = parseEndOfCall({
    message: { type: 'end-of-call-report', call: endedCall, endedReason: endedCall.endedReason, artifact: endedCall.artifact },
  })
  const { endedAt, ...rest } = fromCall
  assert.deepEqual(rest, fromWebhook)
  assert.equal(endedAt, '2026-10-08T10:12:00.000Z')
  assert.equal(fromCall.sessionId, 'sess-abc')
})

test('a call that is still going, or has no end time, is not ready', () => {
  assert.equal(callToEndOfCall({ ...endedCall, status: 'in-progress' }), null)
  assert.equal(callToEndOfCall({ ...endedCall, endedAt: undefined }), null)
  assert.equal(callToEndOfCall({ ...endedCall, endedAt: 'not a date' }), null)
  assert.equal(callToEndOfCall(null), null)
})

test('getCall reads with the private key, never the public one, and uses the base url override', async () => {
  const seen = []
  const call = await getCall('call-123', {
    env: { VAPI_PRIVATE_KEY: ' priv-key ', VAPI_PUBLIC_KEY: 'pub-key', VAPI_API_BASE: 'http://fake' },
    fetchImpl: async (url, init) => {
      seen.push({ url, auth: init.headers.Authorization })
      return { ok: true, json: async () => endedCall }
    },
  })
  assert.equal(call.id, 'call-123')
  assert.deepEqual(seen, [{ url: 'http://fake/call/call-123', auth: 'Bearer priv-key' }])
  assert.equal(vapiCallUrl('a/b', {}), 'https://api.vapi.ai/call/a%2Fb')
})

test('getCall without a private key says so, and a 404 or 5xx carries its status', async () => {
  await assert.rejects(() => getCall('c', { env: {} }), VapiNotConfiguredError)
  for (const status of [404, 401, 503]) {
    await assert.rejects(
      () => getCall('c', { env: { VAPI_PRIVATE_KEY: 'k' }, fetchImpl: async () => ({ ok: false, status }) }),
      (err) => err instanceof VapiLookupError && err.status === status && !err.message.includes('Bearer')
    )
  }
})
