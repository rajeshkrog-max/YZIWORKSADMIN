// A restart in the middle of an interview (spec 0001: AC-8 to AC-11): the REAL server process against a fake
// Vapi and a fake OpenAI, each scenario with its own data folder. No network, no secrets, no real data.
// Run: npm test
import test, { after, before } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { SAMPLE_OFFERS } from '../netlify/lib/fixtures/seraOffers.js'
import { SAMPLE_LLM_OUTPUT, SAMPLE_TRANSCRIPT } from '../netlify/lib/fixtures/seraInterview.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const SECRET = 'test-webhook-secret'
const NAMES = { screening: 'Sera – Screening', hr: 'Vinit – HR Round', final: 'sonia-final round' }
const OFFSETS = { screening: 0, hr: 300, final: 500 }
const SENSITIVE = /^(VAPI_|OPENAI_|R2_|RAZORPAY_|RESEND_|MSG91_|WHATSAPP_|SERA_|RETELL_|NETLIFY_)/
const cleanEnv = () => Object.fromEntries(Object.entries(process.env).filter(([key]) => !SENSITIVE.test(key)))
const ago = (seconds) => new Date(Date.now() - seconds * 1000).toISOString()
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let vapi
let openai
let llmCalls = 0
let controlCalls = []
const fakeCalls = new Map() // call id -> the Call object the fake Vapi returns, or a status number
const dirs = []
const procs = []

const listen = (handler) =>
  new Promise((resolve) => {
    const srv = http.createServer(handler)
    srv.listen(0, '127.0.0.1', () => resolve({ srv, port: srv.address().port }))
  })
const readJson = (req) =>
  new Promise((resolve) => {
    let raw = ''
    req.on('data', (c) => (raw += c))
    req.on('end', () => resolve(raw ? JSON.parse(raw) : {}))
  })

before(async () => {
  vapi = await listen(async (req, res) => {
    const body = await readJson(req)
    res.setHeader('Content-Type', 'application/json')
    if (req.url.startsWith('/control/')) {
      controlCalls.push({ callId: req.url.split('/').pop(), body })
      return res.end('{}')
    }
    if (req.method === 'GET' && req.url.startsWith('/call/')) {
      if (req.headers.authorization !== 'Bearer test-private') {
        res.statusCode = 401
        return res.end('{}')
      }
      const found = fakeCalls.get(decodeURIComponent(req.url.split('/').pop()))
      if (typeof found === 'number') {
        res.statusCode = found
        return res.end('{}')
      }
      if (found) return res.end(JSON.stringify(found))
      res.statusCode = 404
      return res.end('{}')
    }
    res.statusCode = 404
    res.end('{}')
  })
  openai = await listen(async (req, res) => {
    await readJson(req)
    llmCalls += 1
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ status: 'completed', output: [{ type: 'reasoning', content: [] }, { type: 'message', content: [{ type: 'output_text', text: JSON.stringify(SAMPLE_LLM_OUTPUT) }] }] }))
  })
})

after(async () => {
  for (const p of procs) p.kill()
  vapi?.srv.close()
  openai?.srv.close()
  for (const d of dirs) await fs.rm(d, { recursive: true, force: true })
})

async function newDir() {
  const d = await fs.mkdtemp(path.join(os.tmpdir(), 'sera-restart-'))
  dirs.push(d)
  return d
}

async function startApp(dataDir, extraEnv = {}) {
  const port = 49000 + Math.floor(Math.random() * 1000)
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
      VAPI_PUBLIC_KEY: 'test-pub',
      VAPI_SQUAD_ID: 'squad',
      VAPI_WEBHOOK_SECRET: SECRET,
      ...extraEnv,
    },
    stdio: process.env.SERA_TEST_LOGS ? 'inherit' : 'ignore',
  })
  procs.push(proc)
  for (let i = 0; i < 80; i++) {
    try {
      if ((await fetch(`http://127.0.0.1:${port}/health`)).ok) return { port, proc }
    } catch {
      /* not up yet */
    }
    await sleep(100)
  }
  throw new Error('server did not start')
}

// "Restart": the process dies without warning (as a crash or a host kill would), then a new one starts on the same data.
async function crash(app) {
  const gone = new Promise((resolve) => app.proc.once('exit', resolve))
  app.proc.kill('SIGKILL')
  await gone
}

const sessionFile = (dir, id) => path.join(dir, 'sessions', `${id}.json`)
const readSession = async (dir, id) => JSON.parse(await fs.readFile(sessionFile(dir, id), 'utf8'))
async function seedSession(dir, id, patch = {}) {
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
    chosenOfferId: SAMPLE_OFFERS[0]?.id ?? null,
    rounds: {
      screening: { callId: null, status: 'pending', transcript: null },
      hr: { callId: null, status: 'pending', transcript: null },
      final: { callId: null, status: 'pending', transcript: null },
    },
    summaries: { screening: null, hr: null },
    payment: { orderId: null, paymentId: null },
    report: null,
    status: 'live',
    ...patch,
  }
  await fs.mkdir(path.join(dir, 'sessions'), { recursive: true })
  await fs.writeFile(sessionFile(dir, id), JSON.stringify(session))
  return session
}

const messages = () =>
  ['screening', 'hr', 'final'].flatMap((round) =>
    SAMPLE_TRANSCRIPT.filter((t) => t.round === round).map((t) => ({
      role: t.role === 'agent' ? 'assistant' : 'user',
      message: t.text,
      secondsFromStart: OFFSETS[round] + t.start,
      duration: (t.end - t.start) * 1000,
      ...(t.role === 'agent' ? { name: NAMES[round] } : {}),
    }))
  )
const transcripts = () => {
  const out = {}
  for (const round of ['screening', 'hr', 'final']) {
    out[round] = { callId: 'c', status: 'completed', transcript: SAMPLE_TRANSCRIPT.filter((t) => t.round === round).map((t) => ({ role: t.role, text: t.text, start: t.start, end: t.end })) }
  }
  return out
}

async function waitFor(fn, ms = 20000) {
  const end = Date.now() + ms
  for (;;) {
    const v = await fn()
    if (v) return v
    if (Date.now() > end) throw new Error('timed out waiting')
    await sleep(100)
  }
}

test('AC-9: a call that ended while the server was down gets its ONE report after the restart, and never a second', async () => {
  const dir = await newDir()
  await seedSession(dir, 'missed-1', { vapi: { callId: 'call-missed', controlUrl: `http://127.0.0.1:${vapi.port}/control/call-missed`, startedAt: ago(900), round: 'final' } })
  fakeCalls.set('call-missed', {
    id: 'call-missed',
    status: 'ended',
    endedAt: ago(300),
    endedReason: 'assistant-ended-call',
    metadata: { sessionId: 'missed-1' },
    artifact: { messages: messages() },
  })
  const before = llmCalls
  const first = await startApp(dir, { VAPI_PRIVATE_KEY: 'test-private' })
  const done = await waitFor(async () => {
    const s = await readSession(dir, 'missed-1')
    return s.report ? s : null
  })
  assert.equal(done.vapi.endHandled, true)
  assert.equal(done.status, 'completed')
  assert.equal(done.reportAttempts, 1)
  assert.equal(llmCalls - before, 1, 'exactly one report')

  await crash(first)
  await startApp(dir, { VAPI_PRIVATE_KEY: 'test-private' })
  await sleep(1500)
  assert.equal(llmCalls - before, 1, 'a restart never makes a second report')
})

test('AC-9: a call Vapi does not know (404) becomes incomplete: no report, no LLM cost', async () => {
  const dir = await newDir()
  await seedSession(dir, 'gone-1', { vapi: { callId: 'call-unknown', controlUrl: `http://127.0.0.1:${vapi.port}/control/x`, startedAt: ago(600), round: 'screening' } })
  const before = llmCalls
  await startApp(dir, { VAPI_PRIVATE_KEY: 'test-private' })
  const s = await waitFor(async () => {
    const x = await readSession(dir, 'gone-1')
    return x.vapi.endHandled ? x : null
  })
  assert.equal(s.status, 'incomplete')
  assert.equal(s.vapi.endedReason, 'call-not-found')
  assert.equal(llmCalls, before)
})

test('AC-10: a report cut short by a restart is retried once; a second crash is not retried again', async () => {
  const dir = await newDir()
  const ended = { callId: 'call-cut', endHandled: true, endedReason: 'assistant-ended-call', startedAt: ago(900), round: 'final' }
  await seedSession(dir, 'cut-1', { vapi: ended, rounds: transcripts(), reportState: 'running', reportStartedAt: ago(600), reportAttempts: 1 })
  await seedSession(dir, 'cut-2', { vapi: { ...ended, callId: 'call-cut2' }, rounds: transcripts(), reportState: 'running', reportStartedAt: ago(600), reportAttempts: 2 })
  const before = llmCalls
  await startApp(dir)
  const s = await waitFor(async () => {
    const x = await readSession(dir, 'cut-1')
    return x.report ? x : null
  })
  assert.equal(s.reportAttempts, 2)
  await sleep(1000)
  assert.equal(llmCalls - before, 1, 'only the first was retried')
  const exhausted = await readSession(dir, 'cut-2')
  assert.equal(exhausted.report, null, 'two attempts already: no third run')
})

test('AC-10: a failed report (a language model error) is not retried by a restart', async () => {
  const dir = await newDir()
  await seedSession(dir, 'failed-1', {
    vapi: { callId: 'call-f', endHandled: true, endedReason: 'assistant-ended-call', startedAt: ago(900), round: 'final' },
    rounds: transcripts(),
    reportState: 'failed',
    status: 'report_failed',
    reportAttempts: 1,
  })
  const before = llmCalls
  await startApp(dir)
  await sleep(1500)
  assert.equal(llmCalls, before)
})

test('AC-8: after a restart in the middle of a round the timers resume: due notes go once, recorded ones never again', async () => {
  const dir = await newDir()
  const callId = 'call-timers'
  const base = { callId, controlUrl: `http://127.0.0.1:${vapi.port}/control/${callId}`, startedAt: ago(700), round: 'hr', handoffAt: ago(250), roundStartedAt: { hr: ago(250) }, sawSignals: true, timerSteps: { hr: { nearly: ago(50) } } }
  await seedSession(dir, 'timers-1', { vapi: base })
  controlCalls = []
  // 250 s into a 240 s round: "up" is due now; the handoff backstop is due at 265 s (15 s * scale later)
  const first = await startApp(dir, { SERA_ROUND_TIME_SCALE: '0.01' })
  await waitFor(() => controlCalls.some((c) => c.body.type === 'handoff'))
  const notes = () => controlCalls.filter((c) => c.body.type === 'add-message').map((c) => c.body.message.content)
  assert.deepEqual(notes(), ['Interview system note: time is up.'], 'nearly was already recorded; up goes once')
  const recorded = (await readSession(dir, 'timers-1')).vapi.timerSteps.hr
  assert.deepEqual(Object.keys(recorded).sort(), ['force-handoff', 'nearly', 'up'])

  await crash(first)
  controlCalls = []
  await startApp(dir, { SERA_ROUND_TIME_SCALE: '0.01' })
  await sleep(1500)
  assert.deepEqual(controlCalls, [], 'a step already recorded is never sent again')
})

test('AC-11: a slot reserved just before a crash is released after 5 minutes and its seat given back; a live one is kept', async () => {
  const dir = await newDir()
  const keyOf = (email) => crypto.createHash('sha256').update(email.toLowerCase()).digest('hex')
  await seedSession(dir, 'orphan-1', { status: 'new' })
  await seedSession(dir, 'real-1', { vapi: { callId: 'call-real', controlUrl: 'http://127.0.0.1:1/x', startedAt: ago(60), round: 'screening' } })
  await fs.mkdir(path.join(dir, 'reservations'), { recursive: true })
  const write = (email, data) => fs.writeFile(path.join(dir, 'reservations', `${keyOf(email)}.json`), JSON.stringify(data))
  await write('orphan-1@example.com', { sessionId: 'orphan-1', status: 'reserved', reservedAt: ago(600), seatConsumedFor: 'YZI-PUNE-OCT26' })
  await write('real-1@example.com', { sessionId: 'real-1', status: 'reserved', reservedAt: ago(600) })
  await write('young@example.com', { sessionId: 'young', status: 'reserved', reservedAt: ago(30) })
  await startApp(dir)
  const exists = (email) => fs.access(path.join(dir, 'reservations', `${keyOf(email)}.json`)).then(() => true, () => false)
  await waitFor(async () => !(await exists('orphan-1@example.com')))
  assert.equal(await exists('real-1@example.com'), true, 'a call exists for it')
  assert.equal(await exists('young@example.com'), true, 'too young to judge')
  const codes = JSON.parse(await fs.readFile(path.join(dir, 'student_codes.json'), 'utf8'))
  assert.equal(codes['YZI-PUNE-OCT26'].seatsLeft, 43, 'the consumed seat came back (42 + 1)')
})

test('a graceful stop (SIGTERM) exits with code 0', { skip: process.platform === 'win32' && 'Windows cannot deliver SIGTERM to a handler; the Linux host can' }, async () => {
  const dir = await newDir()
  const app = await startApp(dir)
  const exited = new Promise((resolve) => app.proc.once('exit', (code, signal) => resolve({ code, signal })))
  app.proc.kill('SIGTERM')
  const result = await Promise.race([exited, sleep(10000).then(() => 'timeout')])
  assert.deepEqual(result, { code: 0, signal: null })
})
