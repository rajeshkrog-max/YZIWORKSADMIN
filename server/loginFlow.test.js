// Login + demo credential, end to end: the REAL server process (own temp data dir) against a
// fake Google and a fake Vapi. No network, no real keys. Run: npm test
import test, { after, before } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { SAMPLE_OFFERS } from '../netlify/lib/fixtures/seraOffers.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const CLIENT_ID = 'our-client-id'
const DEMO_CODE = 'YZI-TEST-DEMO'
const GOOD = 'ya29.good-token-for-priya'
const OTHER_APP = 'ya29.token-for-another-app'
const UNVERIFIED = 'ya29.unverified-email-token'

let dataDir
let fake // fake Google + Vapi on one port
let app
let limited // a second server for the rate-limit test
const vapiCalls = []

const SENSITIVE = /^(VAPI_|OPENAI_|R2_|RAZORPAY_|RESEND_|MSG91_|WHATSAPP_|SERA_|RETELL_|NETLIFY_|GOOGLE_|VITE_)/
const cleanEnv = () => Object.fromEntries(Object.entries(process.env).filter(([key]) => !SENSITIVE.test(key)))

const listen = (handler) =>
  new Promise((resolve) => {
    const srv = http.createServer(handler)
    srv.listen(0, '127.0.0.1', () => resolve({ srv, port: srv.address().port }))
  })

async function startApp(extraEnv = {}) {
  const port = 41000 + Math.floor(Math.random() * 8000)
  const proc = spawn(process.execPath, [path.join(here, 'index.js')], {
    env: {
      ...cleanEnv(),
      SERA_SKIP_DOTENV: '1',
      SERA_PORT: String(port),
      SERA_DATA_DIR: dataDir,
      GOOGLE_CLIENT_ID: CLIENT_ID,
      GOOGLE_TOKENINFO_URL: `http://127.0.0.1:${fake.port}/tokeninfo`,
      GOOGLE_USERINFO_URL: `http://127.0.0.1:${fake.port}/userinfo`,
      VAPI_API_BASE: `http://127.0.0.1:${fake.port}`,
      VAPI_PUBLIC_KEY: 'test-pub',
      VAPI_SQUAD_ID: 'squad-test',
      OPENAI_API_BASE: `http://127.0.0.1:${fake.port}`,
      OPENAI_API_KEY: 'test-openai',
      VAPI_WEBHOOK_SECRET: 'test-diag-secret',
      SERA_DEMO_CODE: DEMO_CODE,
      SERA_DEMO_SEATS: '1',
      ...extraEnv,
    },
    stdio: process.env.SERA_TEST_LOGS ? 'inherit' : 'ignore',
  })
  for (let i = 0; i < 80; i++) {
    try {
      if ((await fetch(`http://127.0.0.1:${port}/health`)).ok) return { port, proc }
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 100))
  }
  throw new Error('server did not start')
}

const post = async (a, route, body) => {
  const res = await fetch(`http://127.0.0.1:${a.port}${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  return { status: res.status, body: await res.json() }
}
const login = (overrides = {}) =>
  post(app, '/api/sera/login', {
    route: 'student',
    google: { accessToken: GOOD, email: 'attacker-chosen@example.com', name: 'Wrong Name' },
    phone: '9876543210',
    msg91Token: 'otp-token-123',
    studentCode: 'YZI-REAL-CAMPUS',
    ...overrides,
  })
const readSession = async (id) => JSON.parse(await fs.readFile(path.join(dataDir, 'sessions', `${id}.json`), 'utf8'))

before(async () => {
  dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sera-login-'))
  await fs.writeFile(
    path.join(dataDir, 'student_codes.json'),
    JSON.stringify({
      'YZI-REAL-CAMPUS': { instituteName: 'Real Campus', seatsTotal: 5, seatsLeft: 5, active: true },
      'YZI-OLD-CAMPUS': { instituteName: 'Old Campus', seatsTotal: 5, seatsLeft: 5, active: true, expiresAt: '2020-01-01T00:00:00Z' },
      'YZI-EMPTY-CAMPUS': { instituteName: 'Empty', seatsTotal: 5, seatsLeft: 0, active: true },
    })
  )
  fake = await listen(async (req, res) => {
    const url = new URL(req.url, 'http://x')
    res.setHeader('Content-Type', 'application/json')
    if (url.pathname === '/tokeninfo') {
      const t = url.searchParams.get('access_token')
      if (t === GOOD) return res.end(JSON.stringify({ aud: CLIENT_ID, email: 'Priya.Real@Example.com', email_verified: 'true' }))
      if (t === OTHER_APP) return res.end(JSON.stringify({ aud: 'some-other-app', email: 'x@example.com', email_verified: 'true' }))
      if (t === UNVERIFIED) return res.end(JSON.stringify({ aud: CLIENT_ID, email: 'u@example.com', email_verified: 'false' }))
      res.statusCode = 400
      return res.end('{"error":"invalid_token"}')
    }
    if (url.pathname === '/userinfo') return res.end(JSON.stringify({ name: 'Priya Sharma', picture: 'p.png' }))
    if (url.pathname === '/v1/models') {
      res.statusCode = req.headers.authorization === 'Bearer test-openai' ? 200 : 401
      return res.end('{}')
    }
    let raw = ''
    for await (const chunk of req) raw += chunk
    if (url.pathname === '/call/web') {
      vapiCalls.push(JSON.parse(raw))
      const id = `call-${vapiCalls.length}`
      return res.end(JSON.stringify({ id, webCallUrl: `https://vapi.daily.co/${id}`, monitor: { controlUrl: `http://127.0.0.1:${fake.port}/control/${id}` } }))
    }
    res.statusCode = 404
    res.end('{}')
  })
  app = await startApp()
  limited = await startApp()
})

after(async () => {
  app?.proc.kill()
  limited?.proc.kill()
  fake?.srv.close()
  await fs.rm(dataDir, { recursive: true, force: true })
})

test('login: the dev mock token is refused on the server, whatever email it claims', async () => {
  const res = await login({ google: { accessToken: 'mock-google-token', email: 'rajeshkrog@gmail.com', name: 'Admin' } })
  assert.equal(res.body.ok, false)
})

test('login: no token, a forged token, another app\'s token and an unverified email are all refused', async () => {
  assert.equal((await login({ google: { email: 'a@b.com' } })).body.ok, false)
  assert.equal((await login({ google: { accessToken: 'ya29.forged-token-value' } })).body.ok, false)
  assert.equal((await login({ google: { accessToken: OTHER_APP } })).body.ok, false)
  assert.equal((await login({ google: { accessToken: UNVERIFIED } })).body.ok, false)
})

test('login: identity comes from Google, not from the request body', async () => {
  const res = await login()
  assert.equal(res.body.ok, true)
  assert.equal(res.body.login.email, 'priya.real@example.com')
  assert.equal(res.body.login.firstName, 'Priya')
  assert.equal(res.body.login.studentCode, 'YZI-REAL-CAMPUS')
  assert.equal((await readSession(res.body.login.sessionId)).email, 'priya.real@example.com')
})

test('login: bad phone, unknown / expired / full student codes and a bad route are refused', async () => {
  assert.equal((await login({ phone: '12345' })).body.ok, false)
  assert.equal((await login({ studentCode: 'NOPE-CODE' })).body.ok, false)
  const expired = await login({ studentCode: 'YZI-OLD-CAMPUS' })
  assert.equal(expired.body.ok, false)
  assert.match(expired.body.error, /expired/)
  assert.equal((await login({ studentCode: 'YZI-EMPTY-CAMPUS' })).body.ok, false)
  assert.equal((await login({ route: 'admin' })).body.ok, false)
  // New User needs no code
  assert.equal((await login({ route: 'visitor', studentCode: null })).body.ok, true)
})

test('student-code check reports an expired code', async () => {
  assert.deepEqual((await post(app, '/api/sera/student-code/check', { code: 'YZI-OLD-CAMPUS' })).body, { valid: false, reason: 'expired' })
  assert.equal((await post(app, '/api/sera/student-code/check', { code: 'YZI-REAL-CAMPUS' })).body.valid, true)
})

test('demo credential: wrong code refused; right code signs in without Google or WhatsApp', async () => {
  assert.equal((await post(app, '/api/sera/demo-login', { code: 'YZI-REAL-CAMPUS' })).body.ok, false) // a real campus code is not a demo code
  assert.equal((await post(app, '/api/sera/demo-login', { code: 'WRONG' })).body.ok, false)

  const res = await post(app, '/api/sera/demo-login', { code: DEMO_CODE.toLowerCase(), name: ' Ravi <b>X</b> ' })
  assert.equal(res.body.ok, true)
  const { login: l } = res.body
  assert.equal(l.route, 'student')
  assert.equal(l.studentCode, DEMO_CODE)
  assert.match(l.email, /^demo-[0-9a-f]{12}@demo\.yziworks\.com$/)
  assert.equal(l.phone, '')
  assert.ok(!/[<>]/.test(l.firstName))
  const s = await readSession(l.sessionId)
  assert.equal(s.demo, true)
  assert.equal((await post(app, '/api/sera/student-code/check', { code: DEMO_CODE })).body.seatsLeft, 1) // login uses no seat
})

test('demo credential is capped by its seats: a started interview uses the only seat', async () => {
  const { login: l } = (await post(app, '/api/sera/demo-login', { code: DEMO_CODE })).body
  // the demo visitor uploads a résumé (stubbed here): offers + résumé on the session
  const s = await readSession(l.sessionId)
  await fs.writeFile(
    path.join(dataDir, 'sessions', `${l.sessionId}.json`),
    JSON.stringify({ ...s, resume: { objectKey: 'sera-interviews/demo.pdf', highlight: 'x', field: 'y' }, offers: SAMPLE_OFFERS })
  )
  const start = await post(app, '/api/sera/start-call', { sessionId: l.sessionId })
  assert.equal(start.status, 200)
  assert.equal(vapiCalls.length, 1)
  assert.equal((await post(app, '/api/sera/student-code/check', { code: DEMO_CODE })).body.seatsLeft, 0)
  const again = await post(app, '/api/sera/demo-login', { code: DEMO_CODE })
  assert.equal(again.body.ok, false)
  assert.match(again.body.error, /no interviews left/)
})

test('résumé upload is judged by content, not by the file name or content type', async () => {
  const b64 = (text) => Buffer.from(text, 'latin1').toString('base64')
  const upload = (filename, contentType, text) => post(app, '/api/sera/create-upload', { filename, contentType, size: text.length, base64: b64(text) })
  // not a PDF, however it is named or typed
  assert.equal((await upload('cv.pdf', 'application/pdf', 'PK\u0003\u0004 this is a docx')).status, 400)
  assert.equal((await upload('cv.pdf', 'application/pdf', '')).status, 400)
  // a real PDF is never refused for its name or type (R2 is not configured in tests, so it stops after validation with a 500, not a 400)
  for (const [name, type] of [['Resume', ''], ['resume.pdf (1)', 'application/octet-stream'], ['resume.pdf ', 'application/pdf'], ['CV.PDF', undefined]]) {
    assert.notEqual((await upload(name, type, '%PDF-1.7 body')).status, 400, `${name} / ${type}`)
  }
})

test('diagnostics: locked behind the secret, reports a bad OpenAI key and missing R2 without leaking anything', async () => {
  const call = (headers) => fetch(`http://127.0.0.1:${app.port}/api/sera/diagnostics`, { headers }).then(async (r) => ({ status: r.status, body: await r.json() }))
  assert.equal((await call({})).status, 401)
  assert.equal((await call({ Authorization: 'Bearer wrong' })).status, 401)
  const ok = await call({ Authorization: 'Bearer test-diag-secret' })
  assert.equal(ok.status, 200)
  assert.equal(ok.body.openai.ok, true) // the fake accepts test-openai
  assert.equal(ok.body.r2.ok, false) // no R2 in the test environment
  assert.equal(ok.body.ok, false)
  assert.equal(ok.body.vapi.publicKey, true)
  const text = JSON.stringify(ok.body)
  assert.ok(!text.includes('test-openai') && !text.includes('test-pub') && !text.includes('test-diag-secret'), 'no secret in the response')
})

test('rate limit: repeated attempts from one address get 429', async () => {
  let blocked = null
  for (let i = 0; i < 14 && !blocked; i++) {
    const res = await post(limited, '/api/sera/demo-login', { code: `GUESS-${i}` })
    if (res.status === 429) blocked = res
  }
  assert.ok(blocked, 'expected a 429 within 14 guesses')
  assert.equal(blocked.body.ok, false)
  // and the guesses never worked
  assert.equal((await post(limited, '/api/sera/demo-login', { code: DEMO_CODE })).status, 429)
})
