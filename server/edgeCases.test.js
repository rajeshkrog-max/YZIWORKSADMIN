// The edge cases a real candidate can hit (spec 0002), against the REAL server process with fake Google,
// Vapi, OpenAI, Razorpay and R2 on one local port. No network, no secrets, no real data.
// Run: npm test
import test, { after, before } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs/promises'
import crypto from 'node:crypto'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { SAMPLE_OFFERS } from '../netlify/lib/fixtures/seraOffers.js'
import { SAMPLE_LLM_OUTPUT, SAMPLE_TRANSCRIPT } from '../netlify/lib/fixtures/seraInterview.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const SECRET = 'test-webhook-secret'
const RZP_SECRET = 'rzp-test-secret'
const CLIENT_ID = 'test-client.apps.googleusercontent.com'
const NAMES = { screening: 'Sera – Screening', hr: 'Vinit – HR Round', final: 'sonia-final round' }
const OFFSETS = { screening: 0, hr: 300, final: 500 }

let dataDir
let fake
let app
const vapiCalls = []
const controlCalls = []
const rzpOrders = new Map() // order id -> payments Razorpay would list for it
const r2Puts = []
let llmCalls = 0
let llmFailures = 0 // the next N OpenAI requests answer 500

const SENSITIVE = /^(VAPI_|OPENAI_|R2_|RAZORPAY_|RESEND_|MSG91_|WHATSAPP_|SERA_|RETELL_|NETLIFY_|GOOGLE_|VITE_)/
const cleanEnv = () => Object.fromEntries(Object.entries(process.env).filter(([key]) => !SENSITIVE.test(key)))

const listen = (handler) =>
  new Promise((resolve) => {
    const srv = http.createServer(handler)
    srv.listen(0, '127.0.0.1', () => resolve({ srv, port: srv.address().port }))
  })

async function startApp(extraEnv = {}) {
  const port = 41000 + Math.floor(Math.random() * 8000)
  const base = `http://127.0.0.1:${fake.port}`
  const proc = spawn(process.execPath, [path.join(here, 'index.js')], {
    env: {
      ...cleanEnv(),
      SERA_SKIP_DOTENV: '1',
      SERA_PORT: String(port),
      SERA_DATA_DIR: dataDir,
      GOOGLE_CLIENT_ID: CLIENT_ID,
      GOOGLE_TOKENINFO_URL: `${base}/tokeninfo`,
      GOOGLE_USERINFO_URL: `${base}/userinfo`,
      VAPI_API_BASE: base,
      VAPI_PUBLIC_KEY: 'test-pub',
      VAPI_SQUAD_ID: 'squad-test',
      VAPI_WEBHOOK_SECRET: SECRET,
      OPENAI_API_BASE: base,
      OPENAI_API_KEY: 'test-openai',
      RAZORPAY_API_BASE: base,
      RAZORPAY_KEY_ID: 'rzp_test_key',
      RAZORPAY_KEY_SECRET: RZP_SECRET,
      R2_ACCOUNT_ID: 'testaccount',
      R2_ACCESS_KEY_ID: 'test-access',
      R2_SECRET_ACCESS_KEY: 'test-secret',
      R2_ENDPOINT: `${base}/r2`,
      R2_BUCKET_NAME: 'test-bucket',
      SERA_REPORT_RETRY_MS: '300',
      SERA_ADMIN_EMAILS: 'boss@example.com',
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

const post = async (route, body, headers = {}) => {
  const res = await fetch(`http://127.0.0.1:${app.port}${route}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(route.endsWith('vapi-webhook') ? { Authorization: `Bearer ${SECRET}` } : {}), ...headers },
    body: JSON.stringify(body),
  })
  return { status: res.status, body: await res.json() }
}
// Google answers the token `tok:<email>` with that verified email. Each candidate signs in from their own
// address, so the per-IP login limit (15 per 10 minutes) stays out of these tests.
const ipFor = (email) => `10.0.${crypto.createHash('sha1').update(email).digest()[0]}.${crypto.createHash('sha1').update(email).digest()[1]}`
const login = (email, overrides = {}) =>
  post('/api/sera/login', { route: 'visitor', google: { accessToken: `tok:${email}` }, phone: '9876543210', msg91Token: 'otp-token-123', ...overrides }, { 'X-Forwarded-For': ipFor(email) })
const sessionFile = (id) => path.join(dataDir, 'sessions', `${id}.json`)
const readSession = async (id) => JSON.parse(await fs.readFile(sessionFile(id), 'utf8'))
const patchSession = async (id, patch) => fs.writeFile(sessionFile(id), JSON.stringify({ ...(await readSession(id)), ...patch }))
const readOrder = async (id) => JSON.parse(await fs.readFile(path.join(dataDir, 'orders', `${id}.json`), 'utf8'))
const sign = (orderId, paymentId) => crypto.createHmac('sha256', RZP_SECRET).update(`${orderId}|${paymentId}`).digest('hex')
const ready = { resume: { objectKey: 'sera-interviews/cv.pdf', highlight: 'Built a Monday sales dashboard', field: 'data analysis' }, offers: SAMPLE_OFFERS }

async function waitFor(fn, ms = 15000) {
  const end = Date.now() + ms
  for (;;) {
    const v = await fn()
    if (v) return v
    if (Date.now() > end) throw new Error('timed out waiting')
    await new Promise((r) => setTimeout(r, 100))
  }
}

const messagesFor = (rounds) =>
  rounds.flatMap((round) =>
    SAMPLE_TRANSCRIPT.filter((t) => t.round === round).map((t) => ({
      role: t.role === 'agent' ? 'assistant' : 'user',
      message: t.text,
      secondsFromStart: OFFSETS[round] + t.start,
      duration: (t.end - t.start) * 1000,
      ...(t.role === 'agent' ? { name: NAMES[round] } : {}),
    }))
  )
const endOfCall = (callId, sessionId, messages, endedReason) =>
  post('/api/sera/vapi-webhook', { message: { type: 'end-of-call-report', endedReason, call: { id: callId, metadata: { sessionId } }, artifact: { messages } } })

// A signed-in student with résumé and offers, ready to start.
async function readyStudent(email, code = 'YZI-EDGE-CAMPUS') {
  const res = await login(email, { route: 'student', studentCode: code })
  assert.equal(res.body.ok, true, res.body.error)
  await patchSession(res.body.login.sessionId, ready)
  return res.body.login.sessionId
}

before(async () => {
  dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sera-edge-'))
  await fs.writeFile(
    path.join(dataDir, 'student_codes.json'),
    JSON.stringify({
      'YZI-EDGE-CAMPUS': { instituteName: 'Edge Campus', seatsTotal: 50, seatsLeft: 50, active: true },
      'YZI-ONE-SEAT': { instituteName: 'One Seat', seatsTotal: 1, seatsLeft: 1, active: true },
    })
  )
  fake = await listen(async (req, res) => {
    const url = new URL(req.url, 'http://x')
    let raw = ''
    for await (const chunk of req) raw += chunk
    if (url.pathname.startsWith('/r2')) {
      if (req.method === 'PUT') r2Puts.push(url.pathname)
      res.writeHead(200, { ETag: '"fake"' })
      return res.end()
    }
    res.setHeader('Content-Type', 'application/json')
    if (url.pathname === '/tokeninfo') {
      const token = url.searchParams.get('access_token') ?? ''
      if (!token.startsWith('tok:')) {
        res.statusCode = 400
        return res.end('{}')
      }
      return res.end(JSON.stringify({ aud: CLIENT_ID, email: token.slice(4), email_verified: 'true' }))
    }
    if (url.pathname === '/userinfo') return res.end(JSON.stringify({ name: 'Priya Sharma' }))
    if (url.pathname === '/call/web') {
      vapiCalls.push(JSON.parse(raw))
      const id = `call-${vapiCalls.length}`
      return res.end(JSON.stringify({ id, webCallUrl: `https://vapi.daily.co/${id}`, monitor: { controlUrl: `http://127.0.0.1:${fake.port}/control/${id}` } }))
    }
    if (url.pathname.startsWith('/control/')) {
      controlCalls.push({ callId: url.pathname.split('/').pop(), body: JSON.parse(raw) })
      return res.end('{}')
    }
    if (url.pathname === '/v1/orders' && req.method === 'POST') {
      const id = `order_${rzpOrders.size + 1}`
      rzpOrders.set(id, [])
      return res.end(JSON.stringify({ id, amount: JSON.parse(raw).amount, currency: 'INR', status: 'created' }))
    }
    const payments = url.pathname.match(/^\/v1\/orders\/([^/]+)\/payments$/)
    if (payments) return res.end(JSON.stringify({ entity: 'collection', items: rzpOrders.get(payments[1]) ?? [] }))
    if (url.pathname === '/v1/responses') {
      llmCalls += 1
      if (llmFailures > 0) {
        llmFailures -= 1
        res.statusCode = 500
        return res.end('{"error":"overloaded"}')
      }
      return res.end(JSON.stringify({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(SAMPLE_LLM_OUTPUT) }] }] }))
    }
    res.statusCode = 404
    res.end('{}')
  })
  app = await startApp()
})

after(async () => {
  app?.proc.kill()
  fake?.srv.close()
  await fs.rm(dataDir, { recursive: true, force: true })
})

test('payment: an order needs a signed-in New User session; email comes from the session; students never pay', async () => {
  assert.equal((await post('/api/sera/payment/create-order', { email: 'x@example.com' })).status, 400)
  const student = await readyStudent('pay-student@example.com')
  assert.equal((await post('/api/sera/payment/create-order', { sessionId: student })).status, 400)

  const { body } = await login('pay-1@example.com')
  const first = await post('/api/sera/payment/create-order', { sessionId: body.login.sessionId, email: 'someone-else@example.com' })
  assert.equal(first.body.ok, true)
  assert.equal((await readOrder(first.body.orderId)).email, 'pay-1@example.com', 'never the email in the request')
  // a second click / a reopened checkout gets the SAME unpaid order, not a new one
  const second = await post('/api/sera/payment/create-order', { sessionId: body.login.sessionId })
  assert.equal(second.body.orderId, first.body.orderId)
})

test('payment: paid but the page never verified (closed tab): the next login finds it, nobody pays twice', async () => {
  const a = (await login('lost-tab@example.com')).body.login
  await patchSession(a.sessionId, ready)
  const order = (await post('/api/sera/payment/create-order', { sessionId: a.sessionId })).body
  rzpOrders.set(order.orderId, [{ id: 'pay_failed_1', status: 'failed' }, { id: 'pay_lost_1', status: 'captured' }])

  // the tab is gone; the candidate signs in again on another device
  const b = (await login('lost-tab@example.com')).body.login
  assert.notEqual(b.sessionId, a.sessionId)
  assert.deepEqual(b.payment, { orderId: order.orderId, paymentId: 'pay_lost_1' })
  // asking to pay again says "already paid" instead of opening a checkout
  const again = await post('/api/sera/payment/create-order', { sessionId: b.sessionId })
  assert.equal(again.body.alreadyPaid, true)

  await patchSession(b.sessionId, ready)
  const start = await post('/api/sera/start-call', { sessionId: b.sessionId })
  assert.equal(start.status, 200, JSON.stringify(start.body))
  const used = await readOrder(order.orderId)
  assert.equal(used.used, true)
  assert.equal(used.usedBySessionId, b.sessionId)
})

test('payment: verify refuses unknown orders and bad input without a 500, and a replay never frees a used payment', async () => {
  assert.equal((await post('/api/sera/payment/verify', { orderId: 'order_x', paymentId: 'pay_x', signature: sign('order_x', 'pay_x') })).status, 400, 'not an order we created')
  assert.equal((await post('/api/sera/payment/verify', { orderId: 'order_x', paymentId: 'pay_x', signature: 12345 })).status, 400)

  const s = (await login('replay@example.com')).body.login
  await patchSession(s.sessionId, ready)
  const order = (await post('/api/sera/payment/create-order', { sessionId: s.sessionId })).body
  const verify = { orderId: order.orderId, paymentId: 'pay_replay', signature: sign(order.orderId, 'pay_replay'), sessionId: s.sessionId }
  assert.equal((await post('/api/sera/payment/verify', verify)).body.ok, true)
  assert.deepEqual((await readSession(s.sessionId)).payment, { orderId: order.orderId, paymentId: 'pay_replay' })
  assert.equal((await post('/api/sera/start-call', { sessionId: s.sessionId })).status, 200)
  assert.equal((await post('/api/sera/payment/verify', verify)).body.ok, true)
  assert.equal((await readOrder(order.orderId)).used, true, 'the replayed verify left it used')
})

test('login after the interview started opens THAT interview (refresh, lost tab, other device)', async () => {
  const id = await readyStudent('resume-me@example.com')
  assert.equal((await post('/api/sera/start-call', { sessionId: id })).status, 200)
  const again = await login('resume-me@example.com', { route: 'visitor' })
  assert.equal(again.body.ok, true)
  assert.equal(again.body.resumed, true)
  assert.equal(again.body.login.sessionId, id, 'the same session, even from the other tab')
})

// Without Google: WhatsApp plus a typed name and email (not verified, one interview per email).
const typedLogin = (email, phone = '9123456780', overrides = {}) =>
  post('/api/sera/login', { route: 'visitor', manual: { name: 'Asha Rao', email }, phone, msg91Token: 'otp-token-123', ...overrides }, { 'X-Forwarded-For': ipFor(`typed:${email}`) })

test('WhatsApp login with a typed email: works, checks the input, never grants admin or demo', async () => {
  const ok = await typedLogin('Typed.User@Example.com')
  assert.equal(ok.body.ok, true, ok.body.error)
  assert.equal(ok.body.login.email, 'typed.user@example.com')
  assert.equal(ok.body.login.firstName, 'Asha')
  assert.equal((await readSession(ok.body.login.sessionId)).emailVerified, false)

  assert.match((await typedLogin('not-an-email')).body.error, /valid email/)
  assert.match((await post('/api/sera/login', { route: 'visitor', manual: { name: '  ', email: 'a@example.com' }, phone: '9123456780' }, { 'X-Forwarded-For': '10.9.9.1' })).body.error, /your name/)
  assert.match((await typedLogin('boss@example.com')).body.error, /Google/, 'an admin email needs Google')
  assert.match((await typedLogin('demo-x@demo.yziworks.com')).body.error, /Google/)
  assert.match((await typedLogin('bad-phone@example.com', '12345')).body.error, /WhatsApp number/)
})

test('a typed email reopens its interview only from the same WhatsApp number', async () => {
  const first = (await typedLogin('typed-once@example.com', '9000000001')).body.login
  await patchSession(first.sessionId, ready)
  assert.notEqual((await post('/api/sera/start-call', { sessionId: first.sessionId })).status, 200, 'a New User still has to pay')
  const order = { orderId: 'order_typed', email: 'typed-once@example.com', phone: '9000000001', status: 'verified', used: false, paymentId: 'pay_typed', updatedAt: new Date().toISOString() }
  await fs.mkdir(path.join(dataDir, 'orders'), { recursive: true })
  await fs.writeFile(path.join(dataDir, 'orders', 'order_typed.json'), JSON.stringify(order))
  await patchSession(first.sessionId, { payment: { orderId: 'order_typed', paymentId: 'pay_typed' } })
  assert.equal((await post('/api/sera/start-call', { sessionId: first.sessionId })).status, 200)

  const same = await typedLogin('typed-once@example.com', '9000000001')
  assert.equal(same.body.resumed, true)
  assert.equal(same.body.login.sessionId, first.sessionId)
  const other = await typedLogin('typed-once@example.com', '9000000002')
  assert.equal(other.body.ok, false, 'someone typing this email from another number gets nothing')
  assert.match(other.body.error, /already been used/)
})

test("a typed email never unlocks a payment made from another number", async () => {
  const payer = (await login('paid-by-google@example.com')).body.login
  await patchSession(payer.sessionId, ready)
  const order = (await post('/api/sera/payment/create-order', { sessionId: payer.sessionId })).body
  assert.equal((await post('/api/sera/payment/verify', { orderId: order.orderId, paymentId: 'pay_g', signature: sign(order.orderId, 'pay_g'), sessionId: payer.sessionId })).body.ok, true)

  const thief = (await typedLogin('paid-by-google@example.com', '9000000003')).body.login
  assert.equal(thief.payment?.paymentId ?? null, null)
  assert.equal((await post('/api/sera/payment/create-order', { sessionId: thief.sessionId })).body.alreadyPaid, undefined)
  // the payer's own number still finds it
  const owner = (await typedLogin('paid-by-google@example.com', '9876543210')).body.login
  assert.deepEqual(owner.payment, { orderId: order.orderId, paymentId: 'pay_g' })
})

test('early-stall release ENDS the call (no free talking) and is capped per session', async () => {
  const id = await readyStudent('stall@example.com')
  for (let i = 0; i < 3; i++) {
    const start = await post('/api/sera/start-call', { sessionId: id })
    assert.equal(start.status, 200)
    assert.equal((await post('/api/sera/release-reservation', { sessionId: id })).body.released, true)
    assert.ok(controlCalls.some((c) => c.callId === start.body.callId && c.body.type === 'end-call'), 'the released call was ended')
  }
  await post('/api/sera/start-call', { sessionId: id })
  assert.equal((await post('/api/sera/release-reservation', { sessionId: id })).body.released, false, 'the 4th stall is not forgiven')
  assert.equal((await readSession(id)).status, 'live')
})

test('report: a failed run is retried once automatically; the page waits instead of showing "incomplete"', async () => {
  const id = await readyStudent('retry-ok@example.com')
  const callId = (await post('/api/sera/start-call', { sessionId: id })).body.callId
  const before = llmCalls
  llmFailures = 1
  await endOfCall(callId, id, messagesFor(['screening', 'hr', 'final']), 'assistant-ended-call')
  await waitFor(async () => (await readSession(id)).reportState === 'retry_pending' || (await readSession(id)).report)
  if (!(await readSession(id)).report) assert.equal((await post('/api/sera/get-report', { sessionId: id })).body.ready, false)
  await waitFor(async () => (await readSession(id)).report)
  const s = await readSession(id)
  assert.equal(s.reportAttempts, 2)
  assert.ok(llmCalls - before >= 2)
})

test('report: two failed runs stop there (at most two runs per interview)', async () => {
  const id = await readyStudent('retry-fail@example.com')
  const callId = (await post('/api/sera/start-call', { sessionId: id })).body.callId
  llmFailures = 100
  await endOfCall(callId, id, messagesFor(['screening', 'hr', 'final']), 'assistant-ended-call')
  await waitFor(async () => (await readSession(id)).status === 'report_failed')
  await new Promise((r) => setTimeout(r, 800)) // no third run
  const s = await readSession(id)
  llmFailures = 0
  assert.equal(s.reportAttempts, 2)
  assert.deepEqual((await post('/api/sera/get-report', { sessionId: id })).body, { ready: true, incomplete: true, reason: 'failed' })
})

test('a drop AFTER the offers is no longer a dead end: the one report is built on what was said', async () => {
  const id = await readyStudent('late-drop@example.com')
  const callId = (await post('/api/sera/start-call', { sessionId: id })).body.callId
  assert.equal((await post('/api/sera/offers/choose', { sessionId: id, offerId: SAMPLE_OFFERS[1].id })).status, 200)
  await endOfCall(callId, id, messagesFor(['screening', 'hr']), 'pipeline-error-deepgram-transcriber-failed')
  await waitFor(async () => (await readSession(id)).report)
  assert.equal((await readSession(id)).rounds.hr.status, 'dropped', 'the round is still marked as cut by the drop')
})

test('a refresh or closed tab during screening (customer-ended-call, End not pressed) gets the free restart; pressing End does not', async () => {
  const id = await readyStudent('refresh@example.com')
  const callId = (await post('/api/sera/start-call', { sessionId: id })).body.callId
  await endOfCall(callId, id, messagesFor(['screening']).slice(0, 3), 'customer-ended-call')
  await waitFor(async () => (await readSession(id)).status === 'restart_available')
  assert.equal((await post('/api/sera/extract-resume', { sessionId: id, objectKey: 'sera-interviews/x.pdf' })).status, 409, 'no new résumé read on a restart')
  assert.equal((await post('/api/sera/payment/create-order', { sessionId: id })).status, 400, 'students never pay; nobody pays for a restart')

  const ended = await readyStudent('pressed-end@example.com')
  const call2 = (await post('/api/sera/start-call', { sessionId: ended })).body.callId
  await post('/api/sera/session/end', { sessionId: ended })
  await endOfCall(call2, ended, messagesFor(['screening']), 'customer-ended-call')
  await waitFor(async () => (await readSession(ended)).report)
})

test('the last student seat goes to exactly one of two candidates starting at the same moment', async () => {
  const a = await readyStudent('seat-a@example.com', 'YZI-ONE-SEAT')
  const b = await readyStudent('seat-b@example.com', 'YZI-ONE-SEAT')
  const results = await Promise.all([post('/api/sera/start-call', { sessionId: a }), post('/api/sera/start-call', { sessionId: b })])
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 403])
  assert.equal((await post('/api/sera/student-code/check', { code: 'YZI-ONE-SEAT' })).body.seatsLeft, 0)
})

test('download: a report whose PDF failed earlier is rendered on demand (no language model call)', async () => {
  const id = await readyStudent('pdf-later@example.com')
  const callId = (await post('/api/sera/start-call', { sessionId: id })).body.callId
  await endOfCall(callId, id, messagesFor(['screening', 'hr', 'final']), 'assistant-ended-call')
  await waitFor(async () => (await readSession(id)).report)
  await patchSession(id, { reportPdfKey: null })
  const before = llmCalls
  const puts = r2Puts.length
  const res = await post('/api/sera/report/download', { sessionId: id })
  assert.equal(res.status, 200)
  assert.ok(res.body.url.includes(`sera-reports/${id}.pdf`))
  assert.equal(r2Puts.length, puts + 1)
  assert.equal(llmCalls, before)
  assert.equal((await readSession(id)).reportPdfKey, `sera-reports/${id}.pdf`)
})

test('résumé reads are capped per session before any OpenAI call', async () => {
  const id = await readyStudent('many-cvs@example.com')
  await patchSession(id, { resumeReads: 6 })
  const before = llmCalls
  assert.equal((await post('/api/sera/extract-resume', { sessionId: id, objectKey: 'sera-interviews/x.pdf' })).status, 429)
  assert.equal(llmCalls, before)
})

test('a page reporting "connection lost" no longer changes the interview or issues a rejoin code', async () => {
  const id = await readyStudent('lost-note@example.com')
  await post('/api/sera/start-call', { sessionId: id })
  const res = await post('/api/sera/session/lost', { sessionId: id, round: 'screening' })
  assert.deepEqual(res.body, { ok: true, rejoinIssued: false })
  const s = await readSession(id)
  assert.equal(s.status, 'live')
  assert.equal(s.rejoinCode, undefined)
})
