// End-to-end for the Vapi squad flow: the REAL server process (own temp data dir)
// against a fake Vapi and a fake OpenAI. No network, no secrets, no real data.
// Run: npm test
import test, { after, before } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { SAMPLE_OFFERS } from '../netlify/lib/fixtures/seraOffers.js'
import { SAMPLE_LLM_OUTPUT, SAMPLE_TRANSCRIPT } from '../netlify/lib/fixtures/seraInterview.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const SECRET = 'test-webhook-secret'
const NAMES = { screening: 'Sera – Screening', hr: 'Vinit – HR Round', final: 'sonia-final round' }
const OFFSETS = { screening: 0, hr: 300, final: 500 }

let dataDir
let vapi // fake Vapi
let openai // fake OpenAI
const vapiCalls = []
const controlCalls = []
let llmCalls = 0
let app // { port, proc }
let appFast // same server, round timers 100x faster
let appNoSquad

function listen(handler) {
  return new Promise((resolve) => {
    const srv = http.createServer(handler)
    srv.listen(0, '127.0.0.1', () => resolve({ srv, port: srv.address().port }))
  })
}
const readJson = (req) =>
  new Promise((resolve) => {
    let raw = ''
    req.on('data', (c) => (raw += c))
    req.on('end', () => resolve(raw ? JSON.parse(raw) : {}))
  })

// Hermetic: the child sees none of the developer's real keys (Vapi, OpenAI, R2, Razorpay...),
// neither from this shell nor from the repo's .env, so a test can never reach a real service.
const SENSITIVE = /^(VAPI_|OPENAI_|R2_|RAZORPAY_|RESEND_|MSG91_|WHATSAPP_|SERA_|RETELL_|NETLIFY_)/
const cleanEnv = () => Object.fromEntries(Object.entries(process.env).filter(([key]) => !SENSITIVE.test(key)))

async function startApp(extraEnv) {
  const port = 41000 + Math.floor(Math.random() * 8000)
  const proc = spawn(process.execPath, [path.join(here, 'index.js')], {
    env: {
      ...cleanEnv(),
      SERA_SKIP_DOTENV: '1',
      SERA_PORT: String(port),
      SERA_DATA_DIR: dataDir,
      SERA_SEED_SAMPLE_CODES: '1',
      VAPI_API_BASE: `http://127.0.0.1:${vapi.port}`,
      OPENAI_API_BASE: `http://127.0.0.1:${openai.port}`,
      OPENAI_API_KEY: 'test-openai',
      SERA_ADMIN_EMAILS: '',
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

const post = async (a, route, body, headers = {}) => {
  const res = await fetch(`http://127.0.0.1:${a.port}${route}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
  return { status: res.status, body: await res.json() }
}

const sessionFile = (id) => path.join(dataDir, 'sessions', `${id}.json`)
const readSession = async (id) => JSON.parse(await fs.readFile(sessionFile(id), 'utf8'))
async function seedSession(id, patch = {}) {
  const session = {
    sessionId: id,
    route: 'student',
    firstName: 'Priya',
    email: `${id}@example.com`,
    phone: '9876543210',
    studentCode: 'YZI-PUNE-OCT26',
    resume: { objectKey: 'sera-interviews/priya.pdf', highlight: 'Built a Monday sales dashboard', field: 'data analysis' },
    resumeText: 'secret resume text',
    offers: SAMPLE_OFFERS,
    chosenOfferId: null,
    rounds: {
      screening: { callId: null, status: 'pending', transcript: null },
      hr: { callId: null, status: 'pending', transcript: null },
      final: { callId: null, status: 'pending', transcript: null },
    },
    summaries: { screening: null, hr: null },
    payment: { orderId: null, paymentId: null },
    report: null,
    status: 'new',
    ...patch,
  }
  await fs.mkdir(path.join(dataDir, 'sessions'), { recursive: true })
  await fs.writeFile(sessionFile(id), JSON.stringify(session))
  return session
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
const endOfCall = (callId, sessionId, messages, endedReason = 'assistant-ended-call') => ({
  message: { type: 'end-of-call-report', endedReason, call: { id: callId, metadata: { sessionId } }, artifact: { messages } },
})
const auth = { Authorization: `Bearer ${SECRET}` }

async function waitFor(fn, ms = 30000) {
  const end = Date.now() + ms
  for (;;) {
    const v = await fn()
    if (v) return v
    if (Date.now() > end) throw new Error('timed out waiting')
    await new Promise((r) => setTimeout(r, 100))
  }
}

before(async () => {
  dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sera-vapi-'))
  vapi = await listen(async (req, res) => {
    const body = await readJson(req)
    res.setHeader('Content-Type', 'application/json')
    if (req.url === '/call/web') {
      vapiCalls.push({ headers: req.headers, body })
      const id = `call-${vapiCalls.length}`
      return res.end(JSON.stringify({ id, webCallUrl: `https://vapi.daily.co/${id}`, monitor: { controlUrl: `http://127.0.0.1:${vapi.port}/control/${id}` } }))
    }
    if (req.url.startsWith('/control/')) {
      controlCalls.push({ callId: req.url.split('/').pop(), body })
      return res.end('{}')
    }
    res.statusCode = 404
    res.end('{}')
  })
  openai = await listen(async (req, res) => {
    await readJson(req)
    llmCalls += 1
    res.setHeader('Content-Type', 'application/json')
    // the real shape: a reasoning item first, then the message with the answer
    res.end(JSON.stringify({ status: 'completed', output: [{ type: 'reasoning', content: [] }, { type: 'message', content: [{ type: 'output_text', text: JSON.stringify(SAMPLE_LLM_OUTPUT) }] }] }))
  })
  const common = { VAPI_PUBLIC_KEY: 'test-pub', VAPI_WEBHOOK_SECRET: SECRET }
  app = await startApp({ ...common, VAPI_SQUAD_ID: 'squad-from-env' })
  appNoSquad = await startApp({ VAPI_PUBLIC_KEY: 'test-pub' })
  appFast = await startApp({ ...common, VAPI_SQUAD_ID: 'squad-from-env', SERA_ROUND_TIME_SCALE: '0.01' })
})

after(async () => {
  app?.proc.kill()
  appNoSquad?.proc.kill()
  appFast?.proc.kill()
  vapi?.srv.close()
  openai?.srv.close()
  await fs.rm(dataDir, { recursive: true, force: true })
})

test('no squad id: refuses with 500, nothing created, nothing reserved, no seat used', async () => {
  await seedSession('no-squad')
  const before = vapiCalls.length
  const res = await post(appNoSquad, '/api/sera/start-call', { sessionId: 'no-squad' })
  assert.equal(res.status, 500)
  assert.equal(res.body.error, 'Interview service is not configured')
  assert.equal(vapiCalls.length, before)
  assert.deepEqual(await fs.readdir(path.join(dataDir, 'reservations')), [])
})

test('a session without a stored résumé / 3 offers never gets a call', async () => {
  await seedSession('no-offers', { offers: [] })
  await seedSession('no-resume', { resume: { objectKey: null, highlight: '', field: '' } })
  const before = vapiCalls.length
  assert.equal((await post(app, '/api/sera/start-call', { sessionId: 'no-offers' })).status, 400)
  assert.equal((await post(app, '/api/sera/start-call', { sessionId: 'no-resume' })).status, 400)
  assert.equal(vapiCalls.length, before)
})

test('New User without a verified payment is refused', async () => {
  await seedSession('visitor-1', { route: 'visitor', studentCode: null })
  const before = vapiCalls.length
  const res = await post(app, '/api/sera/start-call', { sessionId: 'visitor-1', paymentId: 'pay_unknown' })
  assert.equal(res.status, 403)
  assert.equal(vapiCalls.length, before)
})

test('New User: verified payment starts one call, is marked used, and cannot be reused', async () => {
  await seedSession('visitor-2', { route: 'visitor', studentCode: null })
  await seedSession('visitor-3', { route: 'visitor', studentCode: null })
  await fs.mkdir(path.join(dataDir, 'orders'), { recursive: true })
  await fs.writeFile(
    path.join(dataDir, 'orders', 'order_1.json'),
    JSON.stringify({ orderId: 'order_1', paymentId: 'pay_1', status: 'verified', used: false, email: 'visitor-2@example.com' })
  )
  const res = await post(app, '/api/sera/start-call', { sessionId: 'visitor-2', paymentId: 'pay_1' })
  assert.equal(res.status, 200)
  const order = JSON.parse(await fs.readFile(path.join(dataDir, 'orders', 'order_1.json'), 'utf8'))
  assert.equal(order.used, true)
  // someone else's email cannot spend that payment
  const stolen = await post(app, '/api/sera/start-call', { sessionId: 'visitor-3', paymentId: 'pay_1' })
  assert.equal(stolen.status, 403)
})

test('student: ONE squad call; the browser gets the web url but never the controlUrl', async () => {
  await seedSession('stu-1')
  const before = vapiCalls.length
  const res = await post(app, '/api/sera/start-call', { sessionId: 'stu-1' })
  assert.equal(res.status, 200)
  assert.equal(vapiCalls.length, before + 1)
  const sent = vapiCalls.at(-1)
  assert.equal(sent.headers.authorization, 'Bearer test-pub')
  assert.equal(sent.body.squadId, 'squad-from-env')
  assert.equal(sent.body.squadOverrides.maxDurationSeconds, 900)
  assert.deepEqual(sent.body.squadOverrides.monitorPlan, { controlEnabled: true })
  assert.deepEqual(sent.body.squadOverrides.variableValues, {
    first_name: 'Priya',
    field: 'data analysis',
    resume_highlight: 'Built a Monday sales dashboard',
  })
  assert.equal(sent.body.squadOverrides.metadata.sessionId, 'stu-1')
  assert.equal(sent.body.squadOverrides.metadata.objectKey, 'sera-interviews/priya.pdf')
  assert.deepEqual(Object.keys(res.body).sort(), ['callId', 'sessionId', 'success', 'webCallUrl'])
  assert.match(res.body.webCallUrl, /^https:\/\/vapi\.daily\.co\//)

  const view = await post(app, '/api/sera/session', { sessionId: 'stu-1' })
  assert.ok(!JSON.stringify(view.body).includes('control'))
  assert.equal(view.body.resumeText, undefined)
  assert.ok((await readSession('stu-1')).vapi.controlUrl)
})

test('one interview per email: a second start (same or new session) is refused', async () => {
  const before = vapiCalls.length
  assert.equal((await post(app, '/api/sera/start-call', { sessionId: 'stu-1' })).status, 409)
  await seedSession('stu-1b', { email: 'stu-1@example.com' })
  const other = await post(app, '/api/sera/start-call', { sessionId: 'stu-1b' })
  assert.equal(other.status, 403)
  assert.equal(other.body.error, 'already-used')
  assert.equal(vapiCalls.length, before)
})

test('choose: only one of the 3 stored offers; control messages carry THAT offer, same call', async () => {
  const bad = await post(app, '/api/sera/offers/choose', { sessionId: 'stu-1', offerId: 'offer-99' })
  assert.equal(bad.status, 400)
  assert.equal(controlCalls.length, 0)

  const chosen = SAMPLE_OFFERS[2]
  const ok = await post(app, '/api/sera/offers/choose', { sessionId: 'stu-1', offerId: chosen.id })
  assert.equal(ok.status, 200)
  assert.deepEqual(controlCalls.map((c) => c.body.type), ['add-message', 'handoff'])
  const callId = (await readSession('stu-1')).vapi.callId
  assert.ok(controlCalls.every((c) => c.callId === callId))
  assert.equal(controlCalls[0].body.triggerResponseEnabled, false)
  assert.ok(controlCalls[0].body.message.content.includes(chosen.company))
  assert.ok(controlCalls[0].body.message.content.includes(chosen.finalTwist))
  const destination = controlCalls[1].body.destination
  assert.equal(destination.type, 'assistant')
  assert.equal(destination.assistantName, 'Vinit – HR Round')
  // Vinit's first line ("HR at {{company}}") is filled from the chosen offer, not from a system message
  assert.deepEqual(destination.assistantOverrides.variableValues, {
    first_name: 'Priya',
    company: chosen.company,
    role: chosen.role,
    city: chosen.city,
    work_mode: chosen.workMode,
    ctc_range: `₹${chosen.ctcMinLpa}–${chosen.ctcMaxLpa} LPA`,
    requirements: chosen.skills.join(', '),
    final_twist: chosen.finalTwist,
  })

  // a repeat tap is a no-op; a different card after the handoff is refused
  assert.equal((await post(app, '/api/sera/offers/choose', { sessionId: 'stu-1', offerId: chosen.id })).status, 200)
  assert.equal((await post(app, '/api/sera/offers/choose', { sessionId: 'stu-1', offerId: SAMPLE_OFFERS[0].id })).status, 409)
  assert.equal(controlCalls.length, 2)
  assert.equal(vapiCalls.length > 0 && (await readSession('stu-1')).chosenOfferId, chosen.id)
})

test('webhook: credential required; show_offers tool call is answered', async () => {
  assert.equal((await post(app, '/api/sera/vapi-webhook', {})).status, 401)
  assert.equal((await post(app, '/api/sera/vapi-webhook', {}, { Authorization: 'Bearer nope' })).status, 401)
  assert.equal((await post(appNoSquad, '/api/sera/vapi-webhook', {}, auth)).status, 401) // no secret configured → fails closed
  const out = await post(app, '/api/sera/vapi-webhook', { message: { type: 'tool-calls', toolCallList: [{ id: 'tc1', name: 'show_offers' }] } }, auth)
  assert.equal(out.status, 200)
  assert.equal(out.body.results[0].toolCallId, 'tc1')
})

test('show_offers is answered fast, recorded for the page, and never hands off', async () => {
  const callId = (await readSession('stu-1')).vapi.callId
  const controlBefore = controlCalls.length
  const view = async () => (await post(app, '/api/sera/session/get', { sessionId: 'stu-1' })).body
  assert.equal((await view()).offersShown, false)

  const started = Date.now()
  const out = await post(app, '/api/sera/vapi-webhook', { message: { type: 'tool-calls', call: { id: callId }, toolCallList: [{ id: 'tc9', name: 'show_offers' }] } }, auth)
  assert.equal(out.status, 200)
  assert.ok(Date.now() - started < 2000, "the tool result must come back well inside Vapi's 20 s")
  assert.equal(out.body.results[0].toolCallId, 'tc9')
  assert.equal((await view()).offersShown, true)
  assert.equal(controlCalls.length, controlBefore, 'no handoff from the tool call')
  // an unknown call still gets its answer (Sera must never hang)
  const unknown = await post(app, '/api/sera/vapi-webhook', { message: { type: 'tool-calls', call: { id: 'nope' }, toolCallList: [{ id: 'tc10', name: 'show_offers' }] } }, auth)
  assert.equal(unknown.body.results[0].toolCallId, 'tc10')
})

test('nothing generates a report mid-call: polling returns not-ready and costs no LLM call', async () => {
  const res = await post(app, '/api/sera/get-report', { sessionId: 'stu-1' })
  assert.deepEqual(res.body, { ready: false })
  assert.equal(llmCalls, 0)
})

test('end of call: ONE report, ONE LLM call, even if the webhook is delivered twice', async () => {
  const callId = (await readSession('stu-1')).vapi.callId
  const body = endOfCall(callId, 'stu-1', messagesFor(['screening', 'hr', 'final']))
  assert.equal((await post(app, '/api/sera/vapi-webhook', body, auth)).status, 200)
  assert.equal((await post(app, '/api/sera/vapi-webhook', body, auth)).status, 200)

  const ready = await waitFor(async () => {
    const r = await post(app, '/api/sera/get-report', { sessionId: 'stu-1' })
    return r.body.ready ? r.body : null
  })
  assert.ok(ready.report && !ready.incomplete)
  assert.equal(llmCalls, 1)

  const s = await readSession('stu-1')
  assert.equal(s.status, 'completed')
  assert.deepEqual(['screening', 'hr', 'final'].map((r) => s.rounds[r].transcript.length), [11, 6, 5])
  assert.equal(s.rounds.hr.transcript[0].start, 0) // times rebased to the round

  // later webhook deliveries and polls never re-run it
  await post(app, '/api/sera/vapi-webhook', body, auth)
  await post(app, '/api/sera/get-report', { sessionId: 'stu-1' })
  await new Promise((r) => setTimeout(r, 300))
  assert.equal(llmCalls, 1)
})

test('a webhook for a stale / unknown call is ignored', async () => {
  await seedSession('stu-2')
  await post(app, '/api/sera/start-call', { sessionId: 'stu-2' })
  const before = llmCalls
  await post(app, '/api/sera/vapi-webhook', endOfCall('some-other-call', 'stu-2', messagesFor(['screening'])), auth)
  await post(app, '/api/sera/vapi-webhook', endOfCall('x', 'does-not-exist', messagesFor(['screening'])), auth)
  await new Promise((r) => setTimeout(r, 300))
  assert.equal(llmCalls, before)
  assert.equal((await readSession('stu-2')).status, 'live')
})

test('candidate said nothing: incomplete, no LLM cost', async () => {
  const callId = (await readSession('stu-2')).vapi.callId
  const before = llmCalls
  await post(app, '/api/sera/vapi-webhook', endOfCall(callId, 'stu-2', messagesFor(['screening']).filter((m) => m.role === 'assistant').slice(0, 1), 'customer-ended-call'), auth)
  const res = await waitFor(async () => {
    const r = await post(app, '/api/sera/get-report', { sessionId: 'stu-2' })
    return r.body.ready ? r.body : null
  })
  assert.equal(res.incomplete, true)
  assert.equal(llmCalls, before)
})

const controlsFor = (callId) => controlCalls.filter((c) => c.callId === callId).map((c) => c.body)
const noteText = (m) => m.message?.content ?? ''
const fastCall = async (id) => {
  await seedSession(id)
  await post(appFast, '/api/sera/start-call', { sessionId: id })
  const callId = (await readSession(id)).vapi.callId
  const chosen = SAMPLE_OFFERS[0]
  assert.equal((await post(appFast, '/api/sera/offers/choose', { sessionId: id, offerId: chosen.id })).status, 200)
  return callId
}

test('round timers (no Vapi signals): Vinit then Sonia each get "nearly up" and "time is up"; Sonia\'s call is ended', async () => {
  const callId = await fastCall('timer-blind')
  // 2 offer messages + HR nearly/up + (blind) assume-final -> final nearly/up + end-call
  const all = await waitFor(async () => (controlsFor(callId).some((m) => m.type === 'end-call') ? controlsFor(callId) : null), 20000)
  const notes = all.filter((m) => m.type === 'add-message' && /system note/.test(noteText(m))).map(noteText)
  assert.deepEqual(notes, [
    'Interview system note: time is nearly up.',
    'Interview system note: time is up.',
    'Interview system note: time is nearly up.',
    'Interview system note: time is up.',
  ])
  assert.equal(all.filter((m) => m.type === 'handoff').length, 1, 'only the handoff to Vinit: nothing forces Sonia when no signals were seen')
  assert.equal(all.at(-1).type, 'end-call')
  assert.equal((await post(appFast, '/api/sera/session/get', { sessionId: 'timer-blind' })).body.callRound, 'final')
})

test('round timers (with Vapi signals): a Vinit that does not hand off is moved on; Sonia\'s signal starts her clock and cancels the rest', async () => {
  const callId = await fastCall('timer-signals')
  const signal = (name) =>
    post(appFast, '/api/sera/vapi-webhook', { message: { type: 'assistant.started', call: { id: callId, squadOverrides: { metadata: { sessionId: 'timer-signals' } } }, assistant: { name } } }, auth)
  assert.equal((await signal('Vinit – HR Round')).status, 200) // same round: no restart, but proves Vapi's signals are arriving
  // Vinit ignores "time is up": the server hands the call to Sonia itself
  const forced = await waitFor(async () => controlsFor(callId).filter((m) => m.type === 'handoff').length >= 2, 20000)
  assert.ok(forced)
  const second = controlsFor(callId).filter((m) => m.type === 'handoff')[1]
  assert.equal(second.destination.assistantName, 'sonia-final round')

  await signal('sonia-final round')
  // the server answers the webhook first and moves the round in the background
  await waitFor(async () => (await post(appFast, '/api/sera/session/get', { sessionId: 'timer-signals' })).body.callRound === 'final', 10000)
  const all = await waitFor(async () => (controlsFor(callId).some((m) => m.type === 'end-call') ? controlsFor(callId) : null), 20000)
  const notes = all.filter((m) => m.type === 'add-message' && /system note/.test(noteText(m))).map(noteText)
  assert.equal(notes.length, 4, 'HR nearly + up, then final nearly + up (no duplicates from the cancelled HR timers)')
  assert.equal(all.filter((m) => m.type === 'handoff').length, 2)
  // a late, repeated or backwards signal changes nothing
  await signal('Vinit – HR Round')
  assert.equal((await post(appFast, '/api/sera/session/get', { sessionId: 'timer-signals' })).body.callRound, 'final')
})

test('the webhook finds the session by call id when Vapi sends no metadata back', async () => {
  await seedSession('stu-6')
  await post(app, '/api/sera/start-call', { sessionId: 'stu-6' })
  const callId = (await readSession('stu-6')).vapi.callId
  const body = endOfCall(callId, 'stu-6', messagesFor(['screening']).filter((m) => m.role === 'assistant').slice(0, 1), 'customer-ended-call')
  delete body.message.call.metadata
  await post(app, '/api/sera/vapi-webhook', body, auth)
  await waitFor(async () => (await readSession('stu-6')).status === 'incomplete')
})

test('a real drop mid-interview is "dropped" (lost screen), not a report; hang-up is not a drop', async () => {
  await seedSession('stu-3')
  await post(app, '/api/sera/start-call', { sessionId: 'stu-3' })
  const callId = (await readSession('stu-3')).vapi.callId
  const before = llmCalls
  await post(app, '/api/sera/vapi-webhook', endOfCall(callId, 'stu-3', messagesFor(['screening']), 'pipeline-error-openai-llm-failed'), auth)
  await waitFor(async () => (await readSession('stu-3')).status === 'dropped')
  assert.equal(llmCalls, before)

  await seedSession('stu-4')
  await post(app, '/api/sera/start-call', { sessionId: 'stu-4' })
  await post(app, '/api/sera/session/end', { sessionId: 'stu-4' })
  const call4 = (await readSession('stu-4')).vapi.callId
  await post(app, '/api/sera/vapi-webhook', endOfCall(call4, 'stu-4', messagesFor(['screening']), 'customer-ended-call'), auth)
  await waitFor(async () => (await readSession('stu-4')).report)
})

test('a start that stalls in the first 90 s is forgiven: slot and seat come back, a retry works', async () => {
  await seedSession('stu-5')
  const seatsBefore = (await post(app, '/api/sera/student-code/check', { code: 'YZI-PUNE-OCT26' })).body.seatsLeft
  await post(app, '/api/sera/start-call', { sessionId: 'stu-5' })
  assert.equal((await post(app, '/api/sera/student-code/check', { code: 'YZI-PUNE-OCT26' })).body.seatsLeft, seatsBefore - 1)
  await post(app, '/api/sera/release-reservation', { sessionId: 'stu-5' })
  assert.equal((await post(app, '/api/sera/student-code/check', { code: 'YZI-PUNE-OCT26' })).body.seatsLeft, seatsBefore)
  assert.equal((await post(app, '/api/sera/start-call', { sessionId: 'stu-5' })).status, 200)
})
