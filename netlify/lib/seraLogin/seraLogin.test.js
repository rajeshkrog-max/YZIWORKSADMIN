// Run: npm test   (node's built-in test runner — no framework)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  MOCK_GOOGLE_TOKEN,
  clientIp,
  createRateLimiter,
  demoIdentity,
  isValidEmail,
  isValidPhone,
  verifyGoogleLogin,
  verifyMsg91Token,
} from './index.js'

const json = (body, ok = true) => ({ ok, json: async () => body })
// A Google that answers tokeninfo and userinfo.
const google = (info, user = { name: 'Priya Sharma', picture: 'p.png' }) => async (url) =>
  String(url).includes('tokeninfo') ? json(info, info.ok !== false) : json(user)
const TOKEN = 'ya29.a0AbCdEfGhIjKlMnOp'

test('google: the email comes from Google, never from the request body', async () => {
  const res = await verifyGoogleLogin(
    { accessToken: TOKEN, email: 'someone-else@gmail.com', name: 'Fake' },
    { fetchImpl: google({ email: 'Priya@Example.com', email_verified: 'true', aud: 'cid' }), clientId: 'cid' }
  )
  assert.deepEqual(res, { ok: true, identity: { email: 'priya@example.com', name: 'Priya Sharma', picture: 'p.png' } })
})

test('google: a token issued to another app is refused', async () => {
  const res = await verifyGoogleLogin({ accessToken: TOKEN }, { fetchImpl: google({ email: 'a@b.com', email_verified: 'true', aud: 'other-app' }), clientId: 'cid' })
  assert.equal(res.ok, false)
})

test('google: unverified email, bad token and a Google outage are all refused', async () => {
  assert.equal((await verifyGoogleLogin({ accessToken: TOKEN }, { fetchImpl: google({ email: 'a@b.com', email_verified: 'false', aud: 'cid' }), clientId: 'cid' })).ok, false)
  assert.equal((await verifyGoogleLogin({ accessToken: TOKEN }, { fetchImpl: async () => json({}, false) })).ok, false)
  assert.equal((await verifyGoogleLogin({ accessToken: TOKEN }, { fetchImpl: async () => { throw new Error('down') } })).ok, false)
  assert.equal((await verifyGoogleLogin({ accessToken: 'x' }, { fetchImpl: google({}) })).ok, false)
  assert.equal((await verifyGoogleLogin({}, { fetchImpl: google({}) })).ok, false)
})

test('google: the dev mock token is refused unless explicitly allowed, and never calls Google', async () => {
  let called = false
  const fetchImpl = async () => { called = true; return json({}) }
  const body = { accessToken: MOCK_GOOGLE_TOKEN, email: 'admin@example.com', name: 'Admin' }
  assert.equal((await verifyGoogleLogin(body, { fetchImpl })).ok, false)
  assert.equal(called, false)
  assert.equal((await verifyGoogleLogin(body, { fetchImpl, allowMock: true })).ok, true)
  assert.equal((await verifyGoogleLogin({ ...body, email: 'nope' }, { fetchImpl, allowMock: true })).ok, false)
})

test('msg91: only an explicit success counts', async () => {
  const ok = async () => json({ type: 'success', message: 'verified' })
  assert.deepEqual(await verifyMsg91Token({ token: 'abcdefgh1234', authKey: 'k', fetchImpl: ok }), { ok: true })
  assert.equal((await verifyMsg91Token({ token: 'abcdefgh1234', authKey: 'k', fetchImpl: async () => json({ type: 'error' }) })).ok, false)
  assert.equal((await verifyMsg91Token({ token: 'abcdefgh1234', authKey: 'k', fetchImpl: async () => json({ type: 'success' }, false) })).ok, false)
  assert.equal((await verifyMsg91Token({ token: 'short', authKey: 'k', fetchImpl: ok })).ok, false)
  assert.equal((await verifyMsg91Token({ token: 'abcdefgh1234', authKey: 'k', fetchImpl: async () => { throw new Error('x') } })).ok, false)
})

test('rate limiter: blocks after max in the window, frees up after it, keys are independent', () => {
  let t = 0
  const limiter = createRateLimiter({ windowMs: 60_000, max: 3, now: () => t })
  for (let i = 0; i < 3; i++) assert.equal(limiter.hit('ip-a').allowed, true)
  const blocked = limiter.hit('ip-a')
  assert.equal(blocked.allowed, false)
  assert.equal(blocked.retryAfterSeconds, 60)
  assert.equal(limiter.hit('ip-b').allowed, true)
  t = 61_000
  assert.equal(limiter.hit('ip-a').allowed, true)
})

test('client ip: the last x-forwarded-for entry (the proxy\'s) wins over forged ones', () => {
  assert.equal(clientIp({ 'x-forwarded-for': '6.6.6.6, 203.0.113.9' }), '203.0.113.9')
  assert.equal(clientIp({}, '127.0.0.1'), '127.0.0.1')
})

test('validation and the demo identity', () => {
  assert.ok(isValidPhone('9876543210') && !isValidPhone('1234567890') && !isValidPhone('98765') && !isValidPhone(undefined))
  assert.ok(isValidEmail('a@b.co') && !isValidEmail('nope') && !isValidEmail('a@b'))
  const id = demoIdentity('  Ravi <script>  ', 'abc123')
  assert.equal(id.email, 'demo-abc123@demo.yziworks.com')
  assert.ok(!id.name.includes('<'))
  assert.equal(demoIdentity('', 'x').name, 'Demo')
})
