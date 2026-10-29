// Unified Standalone Server for YZI Works & Meet Sera
// Replaces Netlify completely with a production-ready Node.js service on YZIServer.
import http from 'node:http'
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import fsSync from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Native .env file loader
function loadEnv() {
  // The test harness runs this server against fakes and must never pick up real keys.
  if (process.env.SERA_SKIP_DOTENV) return
  const envCandidates = [
    path.resolve(__dirname, '../.env'),
    path.resolve(__dirname, '.env'),
    path.resolve(process.cwd(), '.env'),
  ]
  for (const envFile of envCandidates) {
    if (fsSync.existsSync(envFile)) {
      try {
        const raw = fsSync.readFileSync(envFile, 'utf8')
        for (const line of raw.split('\n')) {
          const trimmed = line.trim()
          if (!trimmed || trimmed.startsWith('#')) continue
          const eqIdx = trimmed.indexOf('=')
          if (eqIdx !== -1) {
            const key = trimmed.slice(0, eqIdx).trim()
            const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '')
            // The real environment (pm2, a test harness) wins over the .env file.
            if (val && process.env[key] === undefined) {
              process.env[key] = val
            }
          }
        }
      } catch (e) {
        console.error('Error loading env file:', envFile, e)
      }
    }
  }
  console.log('[Sera Server] Vapi config present:', {
    publicKey: Boolean(process.env.VAPI_PUBLIC_KEY),
    squadId: Boolean(process.env.VAPI_SQUAD_ID),
    webhookSecret: Boolean(process.env.VAPI_WEBHOOK_SECRET),
  })
}
loadEnv()

import { createSession, getChosenOffer } from '../src/shared/seraSession.js'
import { sendAlert } from './alert.js'
import { cleanFirstName } from '../netlify/lib/seraCall/cleanFirstName.js'
import { generateOffers } from '../netlify/lib/seraOffers/index.js'
import { generateReport } from '../netlify/lib/seraReport/index.js'
import { renderReportPdfOnServer } from '../netlify/lib/seraReport/pdfAssets.node.js'
import { generateJson } from '../netlify/lib/openai.js'
import {
  clientIp,
  createRateLimiter,
  demoIdentity,
  isValidPhone,
  verifyGoogleLogin,
  typedIdentity,
  verifyMsg91Token,
} from '../netlify/lib/seraLogin/index.js'
import { msg91NumberMatches, pickPhoneSession } from '../netlify/lib/seraLogin/phoneSignIn.js'
import {
  VapiNotConfiguredError,
  buildToolCallResults,
  createVapiCall,
  decideOutcome,
  getVapiConfig,
  parseEndOfCall,
  isShowOffersMessage,
  offerHandoffVariables,
  sendOfferHandoff,
  sessionIdFromCall,
  splitRounds,
  verifyVapiWebhook,
  createRoundTimers,
  isForward,
  roundFromServerMessage,
  sendControlMessage,
  getCall,
  callToEndOfCall,
  decideAfterCall,
  reachedOffers,
  MAX_RESTARTS,
  END_CALL,
} from '../netlify/lib/seraVapi/index.js'
import {
  ORDER_REUSE_MS,
  createRazorpayOrder,
  listOrderPayments,
  ordersToReconcile,
  pickPaidPayment,
  unusedPayment,
} from '../netlify/lib/seraPayment/index.js'
import { createShutdown, installProcessHandlers } from './shutdown.js'
import { MAX_REPORT_ATTEMPTS, canClaimReport, createRecovery } from './recovery.js'
import { roundsFor } from '../src/config/seraRounds.js'
import * as store from './store.js'
import { formsStatus, matchFormRoute, missingEnv, runFormHandler } from './formEndpoints.js'
import { authorizeUpload, storeUpload, UPLOAD_PATH } from './applicationUploads.js'

const PORT = Number(process.env.SERA_PORT || process.env.PORT || 4005)

// Which deploy this is. scripts/deploy-sera-vapi.sh writes the git commit and time into BUILD
// beside this server's folder; /health returns it so a deploy can confirm the new code is the code running.
const BUILD = await fs.readFile(new URL('../BUILD', import.meta.url), 'utf8').then((s) => s.trim(), () => 'dev')
const HOST = '127.0.0.1'

// --- Cloudflare R2 Client ---
function getS3Client() {
  const accountId = process.env.R2_ACCOUNT_ID
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('R2 environment variables are not configured')
  }

  return new S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT || `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  })
}

const BUCKET_NAME = process.env.R2_BUCKET_NAME || 'yzi-application-files'

async function streamToBuffer(stream) {
  const chunks = []
  for await (const chunk of stream) chunks.push(chunk)
  return Buffer.concat(chunks)
}

// --- CORS ---
// The site and this API share one origin behind Apache, so browsers normally send no CORS
// request at all. A cross origin browser call is answered only for the origins below
// (SERA_ALLOWED_ORIGINS, comma separated, replaces the defaults). Webhooks are server to
// server and need no CORS.
const ALLOWED_ORIGINS = new Set(
  (process.env.SERA_ALLOWED_ORIGINS || 'https://yziworks.com,https://www.yziworks.com')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
)

function corsHeaders(origin) {
  const headers = { Vary: 'Origin' }
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers['Access-Control-Allow-Origin'] = origin
    headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
    headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Vapi-Secret, X-Razorpay-Signature'
  }
  return headers
}

// Helpers
function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json', ...corsHeaders(res.requestOrigin) })
  res.end(JSON.stringify(body))
}

const MAX_BODY_BYTES = Number(process.env.SERA_MAX_BODY_BYTES) || 25 * 1024 * 1024

// Reads the body as text. Past the limit it stops collecting, drains the rest of the upload
// without keeping it, and rejects once with a 413 so the caller can answer.
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let total = 0
    let tooLarge = false
    req.on('data', (chunk) => {
      if (tooLarge) return
      total += chunk.length
      if (total > MAX_BODY_BYTES) {
        tooLarge = true
        chunks.length = 0
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (!tooLarge) return resolve(Buffer.concat(chunks).toString('utf8'))
      reject(Object.assign(new Error('Payload too large'), { statusCode: 413 }))
    })
    req.on('error', reject)
  })
}

// Reads a raw body. Past `limit` it stops collecting, drains the rest, and rejects once with a 413.
function readBodyBuffer(req, limit = MAX_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let total = 0
    let tooLarge = false
    req.on('data', (chunk) => {
      if (tooLarge) return
      total += chunk.length
      if (total > limit) {
        tooLarge = true
        chunks.length = 0
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (!tooLarge) return resolve(Buffer.concat(chunks))
      reject(Object.assign(new Error('Payload too large'), { statusCode: 413 }))
    })
    req.on('error', reject)
  })
}


function isAdminEmail(email) {
  const allowlist = (process.env.SERA_ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  return allowlist.includes(String(email || '').toLowerCase())
}

// Public view of a session. The Vapi controlUrl (a capability to steer the live call)
// and the résumé text stay on the server.
function toPublicSession(session) {
  const { vapi, resumeText, ...rest } = session
  return { ...rest, offersShown: Boolean(vapi?.offersShownAt), callRound: vapi?.round ?? null }
}

// Read-modify-write one session at a time. A report takes ~30 s to build; without
// this, a late save could overwrite a newer one (e.g. "candidate ended").
const sessionLocks = new Map()
function mutateSession(sessionId, fn) {
  const run = (sessionLocks.get(sessionId) ?? Promise.resolve()).then(async () => {
    const session = await store.getSession(sessionId)
    if (!session) return null
    const result = await fn(session)
    await store.saveSession(session)
    return result
  })
  sessionLocks.set(sessionId, run.catch(() => {}))
  return run
}

// Brute-force and cost protection on the public login endpoints (per client IP).
const loginLimiter = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 15 })
const demoLimiter = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 10 })
const codeLimiter = createRateLimiter({ windowMs: 5 * 60 * 1000, max: 60 })
const uploadLimiter = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 60 })
// Each résumé read is two OpenAI calls; each order is a Razorpay request. Per client IP.
const resumeLimiter = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 20 })
const payLimiter = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 20 })
const MAX_RESUME_READS_PER_SESSION = 6
const MAX_FORGIVEN_STARTS = 3 // early-stall forgiveness per session; past this a stall is a normal end
let warnedNoMsg91 = false

// What the browser gets back from a login. `payment` is a verified payment this email has not used
// yet (a refresh or a lost tab after paying), so the page never asks to pay twice.
const publicLogin = (session) => ({
  sessionId: session.sessionId,
  route: session.route,
  firstName: session.firstName,
  email: session.email,
  phone: session.phone,
  studentCode: session.studentCode,
  payment: session.payment ?? { orderId: null, paymentId: null },
})

const isRazorpayConfigured = () => Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET)

// A verified, unused payment for this email, after asking Razorpay about orders that were paid but never
// verified by the browser. Never throws: a Razorpay outage only means nothing new is found.
// `phone` narrows it to orders paid from that number: a typed (unverified) email must not unlock someone else's payment.
async function findPaymentCredit(email, phone = null) {
  if (typeof email !== 'string' || !email.includes('@')) return null
  const orders = (await store.listOrders()).filter((o) => !phone || o.phone === phone)
  if (isRazorpayConfigured()) {
    for (const order of ordersToReconcile(orders, email)) {
      try {
        const paid = pickPaidPayment(
          await listOrderPayments(order.orderId, { keyId: process.env.RAZORPAY_KEY_ID, keySecret: process.env.RAZORPAY_KEY_SECRET }),
        )
        if (!paid) continue
        await store.saveOrder(order.orderId, { paymentId: paid.id, status: 'verified', used: false, reconciled: true })
        Object.assign(order, { paymentId: paid.id, status: 'verified', used: false })
        console.log(`[Payment] order ${order.orderId} was paid (${paid.status}) but never verified by the page: recovered`)
      } catch (err) {
        console.warn(`[Payment] could not check order ${order.orderId} with Razorpay: ${err.status ?? err.name}`)
      }
    }
  }
  const credit = unusedPayment(orders, email)
  return credit ? { orderId: credit.orderId, paymentId: credit.paymentId } : null
}
const paymentCreditFor = (session) => findPaymentCredit(session.email, session.emailVerified === false ? session.phone : null)

// The round timers: "time is nearly up" / "time is up" notes into the live call (Vinit's and Sonia's
// prompts expect them), plus backstops. SERA_ROUND_TIME_SCALE only shrinks the delays in tests.
const ROUND_SECONDS = Object.fromEntries(roundsFor().filter((r) => r.seconds).map((r) => [r.id, r.seconds]))
const callSessions = new Map() // Vapi call id -> session id (the webhook's fast path)

const roundTimers = createRoundTimers({
  scale: Number(process.env.SERA_ROUND_TIME_SCALE) || 1,
  send: (controlUrl, message) => sendControlMessage(controlUrl, message),
  isCurrent: async (sessionId, round, step) => {
    const s = await store.getSession(sessionId)
    const v = s?.vapi
    if (!v || v.endHandled) return false
    if (step === 'force-handoff') return v.round === 'hr' && v.sawSignals === true // Vinit still talking, per Vapi's own signals
    if (step === 'assume-final') return v.round === 'hr' && !v.sawSignals // blind: assume Vinit handed off on schedule
    return v.round === round
  },
  // Recorded BEFORE the note is sent: a crash can lose one note but never send it twice after a restart.
  record: (sessionId, round, step) =>
    mutateSession(sessionId, (s) => {
      if (!s.vapi) return
      const steps = s.vapi.timerSteps ?? {}
      s.vapi.timerSteps = { ...steps, [round]: { ...(steps[round] ?? {}), [step]: new Date().toISOString() } }
    }),
  onEvent: ({ sessionId, round, step, ok, error }) => {
    console.log(`[Vapi] session ${sessionId.slice(0, 8)} ${round} timer ${step}: ${ok ? 'ok' : `FAILED ${error}`}`)
    if (ok && step === 'assume-final') void enterRound(sessionId, 'final', { blind: true }).catch((e) => console.error('[Vapi] assume-final failed:', e))
  },
})

// Move a call forward to `round` (never backwards) and start that round's timers.
async function enterRound(sessionId, round, { blind = false } = {}) {
  const started = await mutateSession(sessionId, (s) => {
    const v = s.vapi
    if (!v || v.endHandled || !isForward(v.round, round)) return null
    v.round = round
    v.roundStartedAt = { ...(v.roundStartedAt ?? {}), [round]: new Date().toISOString() }
    return { controlUrl: v.controlUrl }
  })
  if (!started) return false
  console.log(`[Vapi] session ${sessionId.slice(0, 8)} -> ${round}${blind ? ' (assumed: no Vapi signals seen)' : ''}`)
  if (ROUND_SECONDS[round]) roundTimers.start({ sessionId, round, seconds: ROUND_SECONDS[round], controlUrl: started.controlUrl })
  return true
}

// Any Vapi server message that says which assistant is speaking. Never throws, never slow.
async function noteRoundSignal(message) {
  const round = roundFromServerMessage(message)
  if (!round) return
  const call = message.call ?? {}
  const sessionId = sessionIdFromCall(call) ?? callSessions.get(call.id)
  if (!sessionId) return
  await mutateSession(sessionId, (s) => {
    if (s.vapi && !s.vapi.sawSignals) s.vapi.sawSignals = true
  })
  await enterRound(sessionId, round)
}

// Double-clicks / two tabs: one start-call and one choose per session at a time.
const inFlight = new Set()

const ALREADY_USED_MESSAGE = "You've already completed your interview with Sera — thanks for stopping by!"
const FORGIVENESS_WINDOW_MS = 90 * 1000
const REPORT_STALE_MS = 5 * 60 * 1000

// A call that stalled right at the start doesn't use up the interview: give back the
// slot, the payment and the seat. Enforced on the server (not just the client timer).
// The forgiven call is ENDED here: before, it stayed open, so a page could release and keep talking,
// over and over, on one payment. A session gets MAX_FORGIVEN_STARTS of these.
async function forgiveEarlyStall(session) {
  const v = session.vapi
  if (!v?.callId || session.report || v.endHandled || Date.now() - Date.parse(v.startedAt) > FORGIVENESS_WINDOW_MS) return false
  if ((session.forgivenStarts ?? 0) >= MAX_FORGIVEN_STARTS) return false
  session.forgivenStarts = (session.forgivenStarts ?? 0) + 1
  if (v.controlUrl) {
    await sendControlMessage(v.controlUrl, END_CALL).catch((err) => console.warn('[Vapi] could not end a forgiven call:', err.message))
  }
  callSessions.delete(v.callId)
  if (!v.admin && !v.restart) {
    await store.releaseReservation(session.email)
    if (v.paymentOrderId) await store.saveOrder(v.paymentOrderId, { used: false, usedBySessionId: null })
    if (v.seatConsumedFor) await store.refundStudentSeat(v.seatConsumedFor)
  }
  // A restarted interview keeps its slot, payment and seat (they belong to the first call), and may start again.
  session.status = v.restart ? 'restart_available' : 'new'
  if (v.restart) session.restartsUsed = Math.max(0, (session.restartsUsed ?? 1) - 1)
  session.vapi = null
  session.rounds.screening = { callId: null, status: 'pending', transcript: null }
  return true
}

const REPORT_RETRY_DELAY_MS = Number(process.env.SERA_REPORT_RETRY_MS) || 20 * 1000

// The one report (and its PDF) for an interview. Runs only from the Vapi
// end-of-call webhook; the browser just polls get-report.
const PROCESS_STARTED_MS = Date.now()
let workInProgress = 0 // reports being built; a graceful stop waits for these

// `stale` is only passed by the restart recovery (server/recovery.js): it may take over a report that was
// running when the previous process stopped, once. Every claim counts in `reportAttempts`, so one interview
// can never cost more than two report runs.
async function finalizeReport(sessionId, { stale = false } = {}) {
  const claimed = await mutateSession(sessionId, (s) => {
    if (!canClaimReport(s, { stale, processStartedMs: PROCESS_STARTED_MS })) return null
    s.reportState = 'running'
    s.reportStartedAt = new Date().toISOString()
    s.reportAttempts = (s.reportAttempts ?? 0) + 1
    return structuredClone(s)
  })
  if (!claimed) return

  workInProgress += 1
  try {
    const transcripts = Object.fromEntries(['screening', 'hr', 'final'].map((r) => [r, claimed.rounds?.[r]?.transcript ?? []]))
    const llmCall = ({ prompt, schema }) => generateJson({ prompt, schema })
    const { report, validation } = await generateReport(llmCall, {
      transcripts,
      chosenOffer: getChosenOffer(claimed),
      resumeHighlights: claimed.resume?.highlight || '',
      route: claimed.route,
      firstName: claimed.firstName,
      interviewDate: new Date().toISOString().slice(0, 10),
    })
    if (!validation.valid) throw new Error(`report failed validation: ${validation.errors.join('; ')}`)

    let reportPdfKey = null
    try {
      const pdfBytes = await renderReportPdfOnServer(report)
      reportPdfKey = `sera-reports/${sessionId}.pdf`
      await getS3Client().send(
        new PutObjectCommand({ Bucket: BUCKET_NAME, Key: reportPdfKey, Body: Buffer.from(pdfBytes), ContentType: 'application/pdf' })
      )
    } catch (pdfErr) {
      reportPdfKey = null
      console.error('[Report] PDF render/upload failed:', pdfErr.message)
    }

    await mutateSession(sessionId, (s) => {
      s.report = report
      s.reportPdfKey = reportPdfKey
      s.reportState = 'done'
      s.status = 'completed'
    })
  } catch (err) {
    console.error('[Report] generation failed:', err)
    // One automatic retry (confirmed 2026-10-26, spec 0002): at most MAX_REPORT_ATTEMPTS runs per interview.
    const retry = (claimed.reportAttempts ?? 1) < MAX_REPORT_ATTEMPTS
    await mutateSession(sessionId, (s) => {
      s.reportState = retry ? 'retry_pending' : 'failed'
      s.status = retry ? 'report_retrying' : 'report_failed'
      if (retry) s.reportRetryAt = new Date(Date.now() + REPORT_RETRY_DELAY_MS).toISOString()
    })
    if (retry) {
      console.log(`[Report] session ${sessionId.slice(0, 8)}: retrying once in ${Math.round(REPORT_RETRY_DELAY_MS / 1000)} s`)
      setTimeout(() => void finalizeReport(sessionId).catch((e) => console.error('[Report] retry failed:', e)), REPORT_RETRY_DELAY_MS).unref?.()
    } else {
      void sendAlert(`Report failed for session ${sessionId.slice(0, 8)}`, [
        'A Sera report failed twice and will not be retried. The candidate was told to use the Contact form.',
        '',
        `Session: ${sessionId}`,
        `Candidate: ${claimed.firstName ?? ''} <${claimed.email ?? ''}> (${claimed.route})`,
        `Error: ${err?.message ?? err}`,
        '',
        'Per the Refund Policy, offer a refund or a new interview.',
      ])
    }
  } finally {
    workInProgress -= 1
  }
}

// What the Vapi end-of-call report means for the session. Idempotent per call.
async function processEndOfCall({ callId, sessionId: metadataSessionId, endedReason, messages }) {
  const sessionId = metadataSessionId ?? callSessions.get(callId) ?? (await store.findSessionByVapiCallId(callId))?.sessionId
  if (!sessionId) return
  roundTimers.clear(sessionId)
  const outcome = await mutateSession(sessionId, (s) => {
    if (!s.vapi || (callId && s.vapi.callId !== callId) || s.vapi.endHandled) return null // stale call / webhook retry
    s.vapi.endHandled = true
    s.vapi.endedReason = endedReason

    const handoffAfter = s.vapi.handoffAt ? (Date.parse(s.vapi.handoffAt) - Date.parse(s.vapi.startedAt)) / 1000 : null
    const { transcripts, attributedByName } = splitRounds(messages, { hrStartSeconds: handoffAfter })
    if (!attributedByName) console.warn(`[Vapi] session ${sessionId}: no assistant names on messages — rounds split by time marks only`)

    for (const round of ['screening', 'hr', 'final']) {
      if (transcripts[round].length) s.rounds[round] = { callId, status: 'completed', transcript: transcripts[round] }
    }
    const candidateEnded = s.status === 'ended_by_candidate' || s.candidateEnded === true
    // Spec 0002: a call lost before the offers gets one free restart; anything else is reported on what was said.
    const result = decideAfterCall({ endedReason, transcripts, candidateEnded, offersReached: reachedOffers(s.vapi), restartsUsed: s.restartsUsed ?? 0 })
    s.vapi.outcome = result
    if (decideOutcome({ endedReason, transcripts, candidateEnded }) === 'dropped') {
      const last = ['final', 'hr', 'screening'].find((r) => transcripts[r].length)
      if (last) s.rounds[last].status = 'dropped'
    }
    if (result === 'incomplete') s.status = 'incomplete'
    if (result === 'restart') {
      s.status = 'restart_available'
      s.previousCalls = [...(s.previousCalls ?? []), { callId, endedReason, endedAt: new Date().toISOString() }]
      console.log(`[Vapi] session ${sessionId.slice(0, 8)}: call ended before the offers (${endedReason}); one free restart offered`)
    }
    return result
  })
  if (outcome === 'report') await finalizeReport(sessionId)
}

const MAX_RESUME_TEXT = 12000
// Two calls (check, then offers) while the candidate waits; together they must finish inside Apache's 120 s.
const RESUME_LLM_TIMEOUT_MS = 50 * 1000
const RESUME_CHECK_SCHEMA = {
  type: 'object',
  properties: {
    isResume: { type: 'boolean' },
    reason: { type: 'string' },
    candidateFirstName: { type: 'string' },
    highlight: { type: 'string' },
    field: { type: 'string' },
    resumeText: { type: 'string' },
  },
  required: ['isResume', 'reason', 'candidateFirstName', 'highlight', 'field', 'resumeText'],
  additionalProperties: false,
}


// Server Router
// A background task that fails must not stop the server (Node would exit on an unhandled rejection).
process.on('unhandledRejection', (reason) => {
  console.error('[server] unhandled rejection:', reason)
})

const server = http.createServer(async (req, res) => {
  // CORS Preflight
  res.requestOrigin = req.headers.origin
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders(req.headers.origin))
    return res.end()
  }

  // A malformed URL or Host header is a 400, never an unhandled error (that would stop the whole server).
  let url
  try {
    url = new URL(req.url, 'http://localhost')
  } catch {
    return sendJson(res, 400, { error: 'Bad request' })
  }
  const pathname = url.pathname

  // Restart on request (deploys). Each ssh session on the host has its own process id space, so a
  // deploy cannot kill a server another session started. The server exits itself instead, and the
  // deploy then starts the new one. Same credential as the Vapi webhook; scripts/deploy-sera-vapi.sh
  // calls it from the server itself and refuses while an interview is live.
  if (pathname === '/api/sera/admin/restart' && req.method === 'POST') {
    if (!verifyVapiWebhook(req.headers, process.env.VAPI_WEBHOOK_SECRET)) return sendJson(res, 401, { error: 'Unauthorized' })
    console.log('[admin] restart requested')
    // Let the answer go out, then stop gracefully: requests and a report in progress finish first.
    res.once('close', () => void gracefulStop.shutdown('admin restart'))
    sendJson(res, 200, { restarting: true, build: BUILD })
    return
  }

  // Health check
  if (pathname === '/health' || pathname === '/api/health' || pathname === '/api/sera/health') {
    return sendJson(res, 200, { ok: true, build: BUILD, timestamp: new Date().toISOString() })
  }

  // Application form file upload: PUT <signed url> with the raw file as the body (see applicationUploads.js).
  if (pathname === UPLOAD_PATH && req.method === 'PUT') {
    try {
      const limited = uploadLimiter.hit(clientIp(req.headers, req.socket.remoteAddress))
      if (!limited.allowed) return sendJson(res, 429, { error: 'Too many uploads. Please wait a few minutes and try again.' })
      if (!process.env.R2_SECRET_ACCESS_KEY || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_ACCOUNT_ID) {
        console.error('[forms] r2-upload is not configured, missing R2 keys')
        return sendJson(res, 503, { error: 'This service is temporarily unavailable. Please try again later.' })
      }
      const auth = authorizeUpload(url.searchParams, { secret: process.env.R2_SECRET_ACCESS_KEY })
      if (!auth.ok) return sendJson(res, auth.status, { error: auth.error })
      const buffer = await readBodyBuffer(req, auth.size)
      if (buffer.length !== auth.size) return sendJson(res, 400, { error: 'The file did not match what was announced. Please try again.' })
      await storeUpload({ s3: getS3Client(), bucket: BUCKET_NAME, key: auth.key, buffer, contentType: auth.contentType })
      return sendJson(res, 200, { success: true })
    } catch (err) {
      if (err?.statusCode === 413) return sendJson(res, 413, { error: 'The file is larger than announced' })
      console.error('[forms] upload failed:', err)
      return sendJson(res, 500, { error: 'Upload failed. Please try again.' })
    }
  }

  try {
    const hasBody = ['POST', 'PUT', 'PATCH'].includes(req.method)
    const rawBody = hasBody ? await readBody(req) : ''
    let body = {}
    if (rawBody) {
      try { body = JSON.parse(rawBody) } catch { body = {} }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 0. Website forms: Early Builder / Early Partner applications, contact form, phone OTP,
    // application file uploads. Same handlers as the old Netlify Functions (see formEndpoints.js).
    // POST /.netlify/functions/<send-otp|verify-otp|send-contact|r2-create-upload> or /api/forms/<name>
    // ─────────────────────────────────────────────────────────────────────────────
    const formRoute = matchFormRoute(pathname)
    if (formRoute) {
      const limited = formRoute.limiter.hit(clientIp(req.headers, req.socket.remoteAddress))
      if (!limited.allowed) {
        res.setHeader('Retry-After', String(limited.retryAfterSeconds))
        return sendJson(res, 429, { error: 'Too many requests. Please wait a few minutes and try again.' })
      }
      const missing = missingEnv(formRoute)
      if (missing.length) {
        console.error(`[forms] ${formRoute.name} is not configured, missing: ${missing.join(', ')}`)
        return sendJson(res, 503, { error: 'This service is temporarily unavailable. Please try again later.' })
      }
      const out = await runFormHandler(formRoute, { method: req.method, path: pathname, headers: req.headers, rawBody })
      // The handlers set their own CORS headers for Netlify; this server's policy replaces them.
      const headers = Object.fromEntries(Object.entries(out.headers).filter(([k]) => !k.toLowerCase().startsWith('access-control-')))
      res.writeHead(out.statusCode, { ...headers, ...corsHeaders(req.headers.origin) })
      return res.end(out.body)
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 1. Student Code Check
    // POST /api/sera/student-code/check
    // ─────────────────────────────────────────────────────────────────────────────
    if (pathname === '/api/sera/student-code/check') {
      const limited = codeLimiter.hit(clientIp(req.headers, req.socket.remoteAddress))
      if (!limited.allowed) return sendJson(res, 429, { valid: false, reason: 'unavailable' })
      const code = String(body.code || '').trim().toUpperCase()
      if (!code) return sendJson(res, 200, { valid: false, reason: 'not_found' })

      // Check if it's a rejoin code
      if (code.startsWith('REJOIN-')) {
        const session = await store.findSessionByRejoin({ code })
        if (!session) return sendJson(res, 200, { valid: false, reason: 'not_found' })
        if (session.rejoinUsed) return sendJson(res, 200, { valid: false, reason: 'used' })
        if (Date.now() - (session.rejoinIssuedAt || 0) > 48 * 3600 * 1000) {
          return sendJson(res, 200, { valid: false, reason: 'expired' })
        }
        return sendJson(res, 200, { valid: true, kind: 'rejoin' })
      }

      // Campus Student Code
      const result = await store.checkStudentCode(code)
      return sendJson(res, 200, result)
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 2. Login
    // POST /api/sera/login
    // ─────────────────────────────────────────────────────────────────────────────
    if (pathname === '/api/sera/login') {
      const limited = loginLimiter.hit(clientIp(req.headers, req.socket.remoteAddress))
      if (!limited.allowed) return sendJson(res, 429, { ok: false, error: 'Too many attempts. Please wait a few minutes and try again.' })

      const { route, google, manual, phone, msg91Token, studentCode } = body
      if (route !== 'visitor' && route !== 'student') {
        return sendJson(res, 200, { ok: false, error: 'Please choose New User or Student.' })
      }

      // Identity comes from Google; without Google (`manual`), from a typed name and email that are not verified.
      const typed = !google && manual != null
      const verified = typed
        ? typedIdentity(manual, { isAdminEmail })
        : await verifyGoogleLogin(google, {
            clientId: process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || '',
            allowMock: process.env.SERA_ALLOW_MOCK_LOGIN === '1', // developer machines only
            urls: { tokeninfo: process.env.GOOGLE_TOKENINFO_URL, userinfo: process.env.GOOGLE_USERINFO_URL },
          })
      if (!verified.ok) return sendJson(res, 200, { ok: false, error: verified.error })

      const cleanPhone = String(phone ?? '').replace(/\D/g, '').slice(-10)
      if (!isValidPhone(cleanPhone)) {
        return sendJson(res, 200, { ok: false, error: 'Please enter a valid 10-digit WhatsApp number.' })
      }
      // The WhatsApp OTP token is verified with MSG91 once its auth key is configured.
      const msg91Key = process.env.MSG91_AUTH_KEY
      if (msg91Key) {
        const otp = await verifyMsg91Token({ token: msg91Token, authKey: msg91Key })
        if (!otp.ok) return sendJson(res, 200, { ok: false, error: otp.error })
      } else if (!warnedNoMsg91) {
        warnedNoMsg91 = true
        console.warn('[Login] MSG91_AUTH_KEY is not set: the WhatsApp OTP token is NOT verified server-side')
      }

      // This email already has an interview (started, finished, or waiting for its restart): open THAT one,
      // so a refresh, a lost tab or a second device shows the report or the restart instead of a dead end.
      const email = verified.identity.email
      if (!isAdminEmail(email)) {
        const reservation = await store.getReservation(email)
        const existing = reservation?.sessionId ? await store.getSession(reservation.sessionId) : null
        if (existing && existing.email?.toLowerCase() === email.toLowerCase()) {
          // A typed email proves nothing, so it reopens an interview only from the number that took it.
          if (typed && existing.phone !== cleanPhone) {
            return sendJson(res, 200, { ok: false, error: 'This email has already been used for an interview. Use the WhatsApp number you used then, or sign in with Google.' })
          }
          return sendJson(res, 200, { ok: true, resumed: true, login: publicLogin(existing) })
        }
      } else if (typed) {
        return sendJson(res, 200, { ok: false, error: 'Please sign in with Google to use this email.' })
      }

      if (route === 'student') {
        const check = await store.checkStudentCode(studentCode)
        if (!check.valid) {
          return sendJson(res, 200, { ok: false, error: check.reason === 'expired' ? 'This student code has expired.' : 'No seats left or invalid student code' })
        }
        if (check.seatsLeft <= 0) return sendJson(res, 200, { ok: false, error: 'No seats left or invalid student code' })
      }

      const sessionId = crypto.randomUUID()
      const session = createSession({
        sessionId,
        route,
        firstName: cleanFirstName(verified.identity.name || google?.name || 'Candidate'),
        email: verified.identity.email,
        phone: cleanPhone,
        studentCode: route === 'student' ? String(studentCode).trim().toUpperCase() : null,
      })
      session.phoneVerified = Boolean(msg91Key)
      session.emailVerified = !typed
      if (route === 'visitor') {
        const credit = await paymentCreditFor(session)
        if (credit) {
          session.payment = credit
          session.status = 'reserved'
        }
      }
      await store.saveSession(session)

      return sendJson(res, 200, { ok: true, login: publicLogin(session) })
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 2a. Sign in with only a WhatsApp number + OTP (same MSG91 widget and key as the login)
    // POST /api/sera/phone-login { phone, msg91Token }
    // Reopens the interview this number already has; never creates one. MSG91 must name this
    // exact number as the one it verified, so it refuses to run without the MSG91 key.
    // ─────────────────────────────────────────────────────────────────────────────
    if (pathname === '/api/sera/phone-login') {
      const limited = loginLimiter.hit(clientIp(req.headers, req.socket.remoteAddress))
      if (!limited.allowed) return sendJson(res, 429, { ok: false, error: 'Too many attempts. Please wait a few minutes and try again.' })

      const cleanPhone = String(body.phone ?? '').replace(/\D/g, '').slice(-10)
      if (!isValidPhone(cleanPhone)) {
        return sendJson(res, 200, { ok: false, error: 'Please enter a valid 10-digit WhatsApp number.' })
      }
      const msg91Key = process.env.MSG91_AUTH_KEY
      if (!msg91Key) {
        console.error('[PhoneLogin] MSG91_AUTH_KEY is not set: sign in with a number is off')
        return sendJson(res, 200, { ok: false, error: 'Sign in with WhatsApp is unavailable right now. Please try again later.' })
      }
      const otp = await verifyMsg91Token({ token: body.msg91Token, authKey: msg91Key, url: process.env.MSG91_VERIFY_URL || undefined })
      if (!otp.ok) return sendJson(res, 200, { ok: false, error: otp.error })
      if (!msg91NumberMatches(otp.identifier, cleanPhone)) {
        // Shape only, never the number: tells a format change (no digits) apart from a real mismatch.
        const digits = String(otp.identifier ?? '').replace(/\D/g, '').length
        console.warn(`[PhoneLogin] MSG91 verified a different identifier than the number sent (${digits} digits in it)`)
        return sendJson(res, 200, { ok: false, error: "We couldn't verify this WhatsApp number. Please try again." })
      }

      const existing = await pickPhoneSession(await store.listSessions(), cleanPhone, (email) => store.getReservation(email))
      if (!existing) {
        return sendJson(res, 200, { ok: false, error: 'No interview found for this number. Choose New User or Student to start one.' })
      }
      return sendJson(res, 200, { ok: true, resumed: true, login: publicLogin(existing) })
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 2b. Demo login — a showcase credential (no Google, no WhatsApp, no payment)
    // POST /api/sera/demo-login { code, name? }
    // Only works for a code flagged `demo` (SERA_DEMO_CODE). Each use is a real interview
    // that costs real money, so it is capped by that code's seats and by a rate limit.
    // ─────────────────────────────────────────────────────────────────────────────
    if (pathname === '/api/sera/demo-login') {
      const limited = demoLimiter.hit(clientIp(req.headers, req.socket.remoteAddress))
      if (!limited.allowed) return sendJson(res, 429, { ok: false, error: 'Too many attempts. Please wait a few minutes and try again.' })

      const code = String(body.code ?? '').trim().toUpperCase()
      const entry = await store.getDemoCode(code)
      if (!entry) return sendJson(res, 200, { ok: false, error: "That demo code isn't valid." })
      if (entry.expired) return sendJson(res, 200, { ok: false, error: 'This demo code has expired.' })
      if (entry.seatsLeft <= 0) return sendJson(res, 200, { ok: false, error: 'This demo code has no interviews left.' })

      const identity = demoIdentity(body.name, crypto.randomBytes(6).toString('hex'))
      const session = createSession({
        sessionId: crypto.randomUUID(),
        route: 'student',
        firstName: cleanFirstName(identity.name) || 'Demo',
        email: identity.email,
        phone: '',
        studentCode: code,
      })
      session.demo = true
      await store.saveSession(session)
      return sendJson(res, 200, { ok: true, login: publicLogin(session) })
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 3. Create Upload (Direct R2 upload via JSON/base64, bypassing browser CORS)
    // POST /api/sera/create-upload OR /.netlify/functions/sera-create-upload
    // ─────────────────────────────────────────────────────────────────────────────
    if (pathname === '/api/sera/create-upload' || pathname === '/.netlify/functions/sera-create-upload') {
      if (!resumeLimiter.hit(`upload:${clientIp(req.headers, req.socket.remoteAddress)}`).allowed) {
        return sendJson(res, 429, { error: 'Too many uploads. Please wait a few minutes and try again.' })
      }
      const { filename, contentType, size, base64 } = body

      // A PDF is judged by its content (it starts with "%PDF-"), not by the name or the
      // browser's content type: real PDFs arrive as "Resume", "cv.pdf (1)" or octet-stream.
      // The stored key is a random UUID, so the name never matters.
      const buffer = typeof base64 === 'string' ? Buffer.from(base64, 'base64') : null
      if (buffer) {
        if (buffer.length > 10 * 1024 * 1024) return sendJson(res, 400, { error: 'That file is over 10 MB' })
        if (buffer.subarray(0, 5).toString('latin1') !== '%PDF-') {
          return sendJson(res, 400, { error: 'Only PDF résumés are accepted' })
        }
      } else if (!filename || (!contentType?.includes('pdf') && !/\.pdf$/i.test(filename))) {
        return sendJson(res, 400, { error: 'Only PDF résumés are accepted' })
      }

      const objectKey = `sera-interviews/${crypto.randomUUID()}.pdf`

      if (buffer) {
        // Direct base64 upload to Cloudflare R2 on server (zero CORS, zero ModSecurity issues)
        const s3 = getS3Client()
        await s3.send(
          new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: objectKey,
            Body: buffer,
            ContentType: 'application/pdf',
          })
        )
        return sendJson(res, 200, { success: true, objectKey, expiresIn: 300 })
      }

      // Presigned PUT URL fallback
      const s3 = getS3Client()
      const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: objectKey,
        ContentType: 'application/pdf',
      })
      const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 })
      return sendJson(res, 200, { success: true, uploadUrl, objectKey, expiresIn: 300 })
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 3b. Direct Upload Proxy (Streams PDF to Cloudflare R2 on server)
    // PUT /api/sera/direct-upload OR /.netlify/functions/sera-direct-upload
    // ─────────────────────────────────────────────────────────────────────────────
    if (pathname === '/api/sera/direct-upload' || pathname === '/.netlify/functions/sera-direct-upload') {
      const key = url.searchParams.get('key')
      if (!key || !key.startsWith('sera-interviews/')) {
        return sendJson(res, 400, { error: 'Invalid attachment location' })
      }

      const buffer = await readBodyBuffer(req)
      if (!buffer || buffer.length === 0) {
        return sendJson(res, 400, { error: 'Empty file payload' })
      }

      const s3 = getS3Client()
      await s3.send(
        new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: key,
          Body: buffer,
          ContentType: req.headers['content-type'] || 'application/pdf',
        }),
      )

      return sendJson(res, 200, { success: true, objectKey: key })
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 4. Extract Resume + Generate Offers
    // POST /api/sera/extract-resume OR /.netlify/functions/sera-extract-resume
    // ─────────────────────────────────────────────────────────────────────────────
    if (pathname === '/api/sera/extract-resume' || pathname === '/.netlify/functions/sera-extract-resume') {
      const { objectKey, sessionId } = body
      if (!objectKey || !objectKey.startsWith('sera-interviews/')) {
        return sendJson(res, 400, { error: 'Invalid attachment location' })
      }
      const session = sessionId ? await store.getSession(sessionId) : null
      if (!session) return sendJson(res, 404, { error: 'Interview session not found. Please sign in again.' })
      if (session.vapi?.callId) return sendJson(res, 409, { error: 'Your interview has already started.' })
      if (session.status === 'restart_available') return sendJson(res, 409, { error: 'Your interview is ready to restart — no new résumé is needed.' })
      if (!process.env.OPENAI_API_KEY) {
        console.error('[Resume] OPENAI_API_KEY is not configured')
        return sendJson(res, 500, { error: 'Unable to read that résumé' })
      }
      if (!resumeLimiter.hit(`read:${clientIp(req.headers, req.socket.remoteAddress)}`).allowed) {
        return sendJson(res, 429, { error: 'Too many attempts. Please wait a few minutes and try again.' })
      }
      // Each read is two OpenAI calls: cap them per session, and one at a time (a double click or two tabs).
      if ((session.resumeReads ?? 0) >= MAX_RESUME_READS_PER_SESSION) {
        return sendJson(res, 429, { error: "You've tried several résumés already. Please sign in again to start over." })
      }
      const readLock = `resume:${session.sessionId}`
      if (inFlight.has(readLock)) return sendJson(res, 409, { error: 'Sera is already reading your résumé — one moment.' })
      inFlight.add(readLock)
      try {
        await mutateSession(session.sessionId, (s) => {
          s.resumeReads = (s.resumeReads ?? 0) + 1
        })

        let buffer
        try {
          const obj = await getS3Client().send(new GetObjectCommand({ Bucket: BUCKET_NAME, Key: objectKey }))
          buffer = await streamToBuffer(obj.Body)
        } catch (s3Err) {
          console.error(`[Resume] R2 fetch failed for ${objectKey}:`, s3Err.message)
          return sendJson(res, 500, { error: 'Unable to read that résumé' })
        }

        // 1. One OpenAI read: is it a résumé, plus the highlight, field and text.
        let check
        try {
          check = await generateJson({
            timeoutMs: RESUME_LLM_TIMEOUT_MS,
            schema: RESUME_CHECK_SCHEMA,
            file: { filename: objectKey.split('/').pop() || 'resume.pdf', mimeType: 'application/pdf', base64: buffer.toString('base64') },
            prompt: `You are checking an uploaded PDF before a job-interview product lets someone start a voice interview.

  Read the attached PDF. Decide if this is genuinely a résumé/CV (a real person's work history, education, or skills) — not a random document, invoice, article, a scanned page with no extractable text, or a corrupted/unreadable file.

  If it IS a résumé, also extract:
  - candidateFirstName: their first name if visible in the text, else an empty string
  - highlight: one natural sentence a friendly interviewer could say out loud to prove she read it — reference something SPECIFIC and real from the text (an actual role, project, skill, or achievement). Do not write a generic sentence.
  - field: their general field/domain in 2-4 words (e.g. "backend engineering", "graphic design", "sales")
  - resumeText: the résumé's text content, as plain text (up to roughly ${MAX_RESUME_TEXT} characters)

  If it is NOT a résumé, fill candidateFirstName, highlight, field, and resumeText with empty strings, and explain briefly in reason why (e.g. not a résumé, unreadable, no extractable text).`,
          })
        } catch (err) {
          console.error('[Resume] OpenAI file read failed:', err.message)
          // Only a 400 means OpenAI could not read THIS file. A bad key, quota, outage or network
          // error is ours: say so, instead of telling the candidate to re-check a good PDF.
          if (err.status === 400) {
            return sendJson(res, 200, { valid: false, reason: "That file doesn't look like a readable PDF — mind double-checking it?" })
          }
          return sendJson(res, 500, { error: 'Sera is having a problem reading résumés right now. Please try again in a few minutes.' })
        }

        if (!check.isResume) {
          // Tell the candidate WHY (the model's first sentence), e.g. "this is a company profile",
          // instead of a bare "not a résumé" they cannot act on.
          const why = String(check.reason ?? '').split(/(?<=[.!?])\s/)[0].replace(/[.!?\s]+$/, '').slice(0, 150)
          return sendJson(res, 200, {
            valid: false,
            reason: `This doesn't look like a personal résumé${why ? ` — ${why.charAt(0).toLowerCase()}${why.slice(1)}` : ''}. Please upload your own CV.`,
          })
        }
        if (!check.resumeText || check.resumeText.length < 80) {
          return sendJson(res, 200, { valid: false, reason: "This PDF doesn't have enough readable text — please upload your actual résumé." })
        }
        const resumeText = check.resumeText.slice(0, MAX_RESUME_TEXT)

        // 2. The 3 offers, from THIS résumé, stored before any call exists. No canned fallback.
        let offers
        try {
          offers = await generateOffers(({ prompt, schema }) => generateJson({ prompt, schema, timeoutMs: RESUME_LLM_TIMEOUT_MS }), {
            resumeText,
            field: check.field,
            highlight: check.highlight,
          })
        } catch (offerErr) {
          console.error('[Offers] generation failed:', offerErr.message)
          return sendJson(res, 500, { error: "We couldn't prepare your offers — please try again in a moment." })
        }

        await mutateSession(session.sessionId, (s) => {
          s.resume = { objectKey, highlight: check.highlight, field: check.field }
          s.resumeText = resumeText
          s.offers = offers
          s.chosenOfferId = null
        })

        return sendJson(res, 200, { valid: true, highlight: check.highlight, field: check.field, offers })
      } finally {
        inFlight.delete(readLock)
      }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 5. Razorpay Create Order
    // POST /api/sera/payment/create-order
    // ─────────────────────────────────────────────────────────────────────────────
    if (pathname === '/api/sera/payment/create-order') {
      if (!payLimiter.hit(clientIp(req.headers, req.socket.remoteAddress)).allowed) {
        return sendJson(res, 429, { ok: false, error: 'Too many attempts. Please wait a few minutes and try again.' })
      }
      // The order belongs to a signed-in session: email and phone come from it, never from the request.
      const session = body.sessionId ? await store.getSession(body.sessionId) : null
      if (!session) return sendJson(res, 400, { ok: false, error: 'Your sign-in has expired. Please refresh the page and sign in again.' })
      if (session.route !== 'visitor') return sendJson(res, 400, { ok: false, error: 'Student interviews are not paid.' })
      if (session.vapi?.callId || session.status === 'restart_available') {
        return sendJson(res, 409, { ok: false, error: 'Your interview has already started.' })
      }
      const email = session.email
      // Nobody pays for an interview they can't start (one interview per email).
      if (!isAdminEmail(email) && (await store.getReservation(email))) {
        return sendJson(res, 403, { ok: false, error: ALREADY_USED_MESSAGE })
      }
      if (!isRazorpayConfigured()) {
        return sendJson(res, 500, { ok: false, error: 'Payment gateway is not configured' })
      }
      const keyId = process.env.RAZORPAY_KEY_ID
      const keySecret = process.env.RAZORPAY_KEY_SECRET

      // Already paid (this tab, an earlier tab, or a payment the page never confirmed): never charge twice.
      const credit = session.payment?.paymentId ? session.payment : await paymentCreditFor(session)
      if (credit) {
        await mutateSession(session.sessionId, (s) => {
          s.payment = { orderId: credit.orderId, paymentId: credit.paymentId }
          s.status = 'reserved'
        })
        return sendJson(res, 200, { ok: true, alreadyPaid: true, orderId: credit.orderId, paymentId: credit.paymentId })
      }

      // A recent unpaid order of this session is offered again (Razorpay allows retries on one order).
      const pending = session.pendingOrderId ? await store.getOrder(session.pendingOrderId) : null
      if (pending?.status === 'created' && Date.now() - Date.parse(pending.createdAt ?? 0) < ORDER_REUSE_MS) {
        return sendJson(res, 200, { ok: true, orderId: pending.orderId, amountPaise: pending.amountPaise, currency: pending.currency, keyId })
      }

      let orderData
      try {
        orderData = await createRazorpayOrder({
          keyId,
          keySecret,
          amountPaise: 24900, // ₹249 in paise (server-enforced)
          notes: { email, phone: session.phone, objectKey: session.resume?.objectKey ?? '', sessionId: session.sessionId },
        })
      } catch (err) {
        console.error('Razorpay order creation failed:', err.status ?? err.name, err.message)
        return sendJson(res, 502, { ok: false, error: "Couldn't initiate payment. You haven't been charged — please try again." })
      }

      await store.saveOrder(orderData.id, {
        email,
        phone: session.phone,
        objectKey: session.resume?.objectKey ?? null,
        sessionId: session.sessionId,
        amountPaise: 24900,
        currency: 'INR',
        status: 'created',
      })
      await mutateSession(session.sessionId, (s) => {
        s.pendingOrderId = orderData.id
      })

      return sendJson(res, 200, {
        ok: true,
        orderId: orderData.id,
        amountPaise: 24900,
        currency: 'INR',
        keyId,
      })
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 6. Razorpay Verify Payment
    // POST /api/sera/payment/verify
    // ─────────────────────────────────────────────────────────────────────────────
    if (pathname === '/api/sera/payment/verify') {
      const { orderId, paymentId, signature, sessionId } = body
      const keySecret = process.env.RAZORPAY_KEY_SECRET

      if (typeof orderId !== 'string' || typeof paymentId !== 'string' || typeof signature !== 'string' || !orderId || !paymentId || !keySecret) {
        return sendJson(res, 400, { ok: false, error: 'Invalid verification details' })
      }

      const expected = crypto.createHmac('sha256', keySecret).update(`${orderId}|${paymentId}`).digest('hex')
      const bExpected = Buffer.from(expected)
      const bSignature = Buffer.from(signature)

      if (bExpected.length !== bSignature.length || !crypto.timingSafeEqual(bExpected, bSignature)) {
        return sendJson(res, 400, { ok: false, error: 'Payment signature mismatch' })
      }

      // Only orders this server created; a repeat verify is answered the same way and never resets `used`.
      const order = await store.getOrder(orderId)
      if (!order) return sendJson(res, 400, { ok: false, error: 'Invalid verification details' })
      if (order.status !== 'verified') await store.saveOrder(orderId, { paymentId, status: 'verified', used: false })

      const session = sessionId ? await store.getSession(sessionId) : null
      if (session && order.email && session.email?.toLowerCase() === order.email.toLowerCase()) {
        await mutateSession(session.sessionId, (s) => {
          s.payment = { orderId, paymentId: order.paymentId ?? paymentId }
          if (s.status === 'new') s.status = 'reserved'
        })
      }

      return sendJson(res, 200, { ok: true, paymentId: order.paymentId ?? paymentId })
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 7. Offers Choose — the card the candidate tapped, handed to Vinit in the SAME call
    // POST /api/sera/offers/choose
    // ─────────────────────────────────────────────────────────────────────────────
    if (pathname === '/api/sera/offers/choose') {
      const { sessionId, offerId } = body
      if (!sessionId || !offerId) return sendJson(res, 400, { ok: false, error: 'Missing sessionId or offerId' })

      const session = await store.getSession(sessionId)
      if (!session) return sendJson(res, 404, { ok: false, error: 'Session not found' })

      // Only one of the 3 stored offers; the browser never supplies offer content.
      const offer = session.offers?.find((o) => o.id === offerId)
      if (!offer) return sendJson(res, 400, { ok: false, error: 'That offer is not one of yours' })

      if (session.vapi?.handoffSent) {
        return session.chosenOfferId === offerId
          ? sendJson(res, 200, { ok: true })
          : sendJson(res, 409, { ok: false, error: 'You have already picked an offer' })
      }
      if (!session.vapi?.controlUrl || session.status !== 'live') {
        return sendJson(res, 409, { ok: false, error: 'Your interview is not live' })
      }

      const lockKey = `choose:${session.sessionId}`
      if (inFlight.has(lockKey)) return sendJson(res, 409, { ok: false, error: 'Still connecting — one moment' })
      inFlight.add(lockKey)
      try {
        const { via } = await sendOfferHandoff(session.vapi.controlUrl, offer, {
          variableValues: offerHandoffVariables(session, offer),
        })
        console.log(`[Vapi] session ${session.sessionId}: handed to Vinit via ${via}`)
      } catch (err) {
        console.error('[Vapi] offer handoff failed:', err.message)
        return sendJson(res, 502, { ok: false, error: "We couldn't connect you to the next round. Please try again." })
      } finally {
        inFlight.delete(lockKey)
      }

      await mutateSession(session.sessionId, (s) => {
        s.chosenOfferId = offerId
        s.vapi.handoffSent = true
        s.vapi.handoffAt = new Date().toISOString()
      })
      await enterRound(session.sessionId, 'hr') // Vinit's clock: nearly-up / up notes follow
      return sendJson(res, 200, { ok: true })
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 8. Start Call — ONE Vapi squad call for the whole interview (Sera → Vinit → Sonia)
    // POST /api/sera/start-call OR /.netlify/functions/sera-start-call
    // ─────────────────────────────────────────────────────────────────────────────
    if (pathname === '/api/sera/start-call' || pathname === '/.netlify/functions/sera-start-call') {
      const { sessionId, paymentId } = body

      const session = sessionId ? await store.getSession(sessionId) : null
      if (!session) return sendJson(res, 404, { error: 'Interview session not found. Please log in again.' })

      const email = session.email
      if (typeof email !== 'string' || !email.includes('@')) {
        return sendJson(res, 400, { error: 'A valid Google account is required' })
      }
      // The résumé location and the offers come from the session, saved when the
      // résumé check passed — a bad PDF never gets this far.
      const objectKey = session.resume?.objectKey
      if (typeof objectKey !== 'string' || !objectKey.startsWith('sera-interviews/')) {
        return sendJson(res, 400, { error: 'Invalid attachment location' })
      }
      if (!Array.isArray(session.offers) || session.offers.length !== 3) {
        return sendJson(res, 400, { error: 'Your offers are not ready — please upload your résumé again.' })
      }
      // Spec 0002: the call was lost before the offers, so this interview may start ONE more call. Its
      // slot, payment and seat were taken by the first call and stay taken: nothing is checked or charged again.
      const restart = session.status === 'restart_available' && session.vapi?.endHandled === true && (session.restartsUsed ?? 0) < MAX_RESTARTS
      if (session.vapi?.callId && !restart) return sendJson(res, 409, { error: 'Your interview has already started.' })

      // Nothing is reserved, charged or consumed if the service can't run.
      try {
        getVapiConfig()
      } catch (err) {
        console.error('[Vapi]', err.message)
        return sendJson(res, 500, { error: 'Interview service is not configured' })
      }

      const lockKey = `start:${session.sessionId}`
      if (inFlight.has(lockKey)) return sendJson(res, 409, { error: 'Your interview is already starting.' })
      inFlight.add(lockKey)

      const admin = isAdminEmail(email)
      let reserved = false
      let seatConsumedFor = null
      try {
        let order = null
        if (restart && !admin) {
          const reservation = await store.getReservation(email)
          if (reservation?.sessionId !== session.sessionId) return sendJson(res, 403, { error: 'already-used', message: ALREADY_USED_MESSAGE })
        } else if (!admin) {
          // New User: a verified, unused payment for THIS email. A retry after a failed
          // start reuses the same payment — it is only marked used once the call exists.
          // A payment the page never confirmed (lost tab, refresh) is found by email.
          if (session.route === 'visitor') {
            const pid = paymentId || session.payment?.paymentId || (await paymentCreditFor(session))?.paymentId
            if (!pid) return sendJson(res, 403, { error: 'payment-required', message: 'A verified payment is required to start.' })
            order = await store.findOrderByPaymentId(pid)
            if (!order || order.status !== 'verified' || (order.email && order.email.toLowerCase() !== email.toLowerCase())) {
              return sendJson(res, 403, { error: 'unverified-payment', message: 'Payment verification failed.' })
            }
            if (order.used) return sendJson(res, 403, { error: 'payment-used', message: 'This payment has already been used.' })
          } else {
            const seat = await store.checkStudentCode(session.studentCode)
            if (!seat.valid || seat.seatsLeft <= 0) {
              return sendJson(res, 403, { error: 'no-seats', message: 'No interview seats remaining for this code.' })
            }
          }

          // One interview per email. Reserved BEFORE the call is created.
          reserved = await store.reserveInterview(email, { sessionId: session.sessionId })
          if (!reserved) return sendJson(res, 403, { error: 'already-used', message: ALREADY_USED_MESSAGE })

          if (session.route === 'student') {
            const seatRes = await store.consumeStudentSeat(session.studentCode)
            if (!seatRes.success) {
              await store.releaseReservation(email)
              reserved = false
              return sendJson(res, 403, { error: 'no-seats', message: 'No interview seats remaining for this code.' })
            }
            seatConsumedFor = session.studentCode
            await store.updateReservation(email, { seatConsumedFor }) // lets recovery refund the seat if the server dies before the call exists
          }
        }

        let call
        try {
          call = await createVapiCall(session, { objectKey })
        } catch (err) {
          console.error('[Vapi] call creation failed:', err.message, err.body || '')
          if (reserved) await store.releaseReservation(email)
          if (seatConsumedFor) await store.refundStudentSeat(seatConsumedFor)
          return sendJson(res, err instanceof VapiNotConfiguredError ? 500 : 502, {
            error: err instanceof VapiNotConfiguredError ? 'Interview service is not configured' : 'Unable to start the interview — please try again',
          })
        }

        await mutateSession(session.sessionId, (s) => {
          const previous = s.vapi
          s.vapi = {
            callId: call.callId,
            controlUrl: call.controlUrl, // server only — never sent to the browser
            startedAt: new Date().toISOString(),
            admin,
            paymentOrderId: restart ? (previous?.paymentOrderId ?? null) : (order?.orderId ?? null),
            seatConsumedFor: restart ? (previous?.seatConsumedFor ?? null) : seatConsumedFor,
            handoffSent: false,
            round: 'screening',
            ...(restart ? { restart: true } : {}),
          }
          if (restart) {
            s.restartsUsed = (s.restartsUsed ?? 0) + 1
            s.candidateEnded = false
            s.chosenOfferId = null
            s.rounds.hr = { callId: null, status: 'pending', transcript: null }
            s.rounds.final = { callId: null, status: 'pending', transcript: null }
          }
          s.rounds.screening = { callId: call.callId, status: 'live', transcript: null }
          s.status = 'live'
        })
        if (restart) console.log(`[Vapi] session ${session.sessionId.slice(0, 8)}: restarted after a lost call`)
        callSessions.set(call.callId, session.sessionId)
        if (reserved || (restart && !admin)) await store.updateReservation(email, { status: 'started', callId: call.callId })
        if (order) await store.saveOrder(order.orderId, { used: true, usedBySessionId: session.sessionId, usedAt: new Date().toISOString() })

        return sendJson(res, 200, { success: true, sessionId: session.sessionId, callId: call.callId, webCallUrl: call.webCallUrl })
      } finally {
        inFlight.delete(lockKey)
      }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 9. Release Reservation — a call that stalled in its first 90 s doesn't use up the interview
    // POST /api/sera/release-reservation OR /.netlify/functions/sera-release-reservation
    // ─────────────────────────────────────────────────────────────────────────────
    if (pathname === '/api/sera/release-reservation' || pathname === '/.netlify/functions/sera-release-reservation') {
      const { sessionId } = body
      let released = false
      if (sessionId) {
        released = (await mutateSession(sessionId, (s) => forgiveEarlyStall(s))) === true
        if (released) roundTimers.clear(sessionId)
      }
      return sendJson(res, 200, { released })
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 10. Session End
    // POST /api/sera/session/end
    // ─────────────────────────────────────────────────────────────────────────────
    if (pathname === '/api/sera/session/end') {
      const { sessionId } = body
      const session = await store.getSession(sessionId)
      if (session) {
        roundTimers.clear(session.sessionId)
        await mutateSession(session.sessionId, (s) => {
          if (s.report) return
          s.status = 'ended_by_candidate'
          s.candidateEnded = true
        })
      }
      return sendJson(res, 200, { ok: true })
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 10b. Get Session Details
    // GET /api/sera/session?sessionId=... OR POST /api/sera/session/get
    // ─────────────────────────────────────────────────────────────────────────────
    if (pathname === '/api/sera/session' || pathname === '/api/sera/session/get') {
      const sessionId = url.searchParams.get('sessionId') || body.sessionId
      const session = await store.getSession(sessionId)
      if (!session) return sendJson(res, 404, { error: 'Session not found' })
      return sendJson(res, 200, toPublicSession(session))
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 11. Session Connection Lost
    // POST /api/sera/session/lost
    // ─────────────────────────────────────────────────────────────────────────────
    if (pathname === '/api/sera/session/lost') {
      // Only a note for the logs now. What a lost call means (one free restart, or the report on what was said)
      // is decided from Vapi's end-of-call report (spec 0002); a page saying "lost" must not change the session,
      // and no rejoin code is issued (a squad call cannot be rejoined part way).
      const { sessionId, round } = body
      const session = await store.getSession(sessionId)
      if (!session) return sendJson(res, 200, { ok: false, rejoinIssued: false })
      await mutateSession(session.sessionId, (s) => {
        s.clientLost = { round: typeof round === 'string' ? round.slice(0, 20) : null, at: new Date().toISOString() }
      })
      return sendJson(res, 200, { ok: true, rejoinIssued: false })
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 12. Rejoin
    // POST /api/sera/rejoin
    // ─────────────────────────────────────────────────────────────────────────────
    if (pathname === '/api/sera/rejoin') {
      const { token, code, email, phone } = body
      const session = await store.findSessionByRejoin({ token, code })

      if (!session) return sendJson(res, 200, { ok: false, reason: 'invalid' })
      if (session.rejoinUsed) return sendJson(res, 200, { ok: false, reason: 'used' })
      if (Date.now() - (session.rejoinIssuedAt || 0) > 48 * 3600 * 1000) {
        return sendJson(res, 200, { ok: false, reason: 'expired' })
      }

      if (email && session.email.toLowerCase() !== email.toLowerCase()) {
        return sendJson(res, 200, { ok: false, reason: 'mismatch' })
      }

      session.rejoinUsed = true
      session.status = 'reserved'
      await store.saveSession(session)

      return sendJson(res, 200, {
        ok: true,
        session: toPublicSession(session),
        round: session.rejoinRound || 'screening',
      })
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 12b. Diagnostics — is every dependency of the interview actually reachable?
    // GET|POST /api/sera/diagnostics, with `Authorization: Bearer <VAPI_WEBHOOK_SECRET>`.
    // Config booleans and live checks only; never a key or any candidate data.
    // ─────────────────────────────────────────────────────────────────────────────
    if (pathname === '/api/sera/diagnostics') {
      if (!verifyVapiWebhook(req.headers, process.env.VAPI_WEBHOOK_SECRET)) {
        return sendJson(res, 401, { error: 'Unauthorized' })
      }
      const timed = async (fn) => {
        try {
          return await fn()
        } catch (err) {
          return { ok: false, error: String(err?.status ?? err?.name ?? 'error') }
        }
      }
      const openai = await timed(async () => {
        const key = process.env.OPENAI_API_KEY
        if (!key) return { ok: false, error: 'OPENAI_API_KEY is not set' }
        const r = await fetch(`${process.env.OPENAI_API_BASE || 'https://api.openai.com'}/v1/models`, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(10000) })
        return { ok: r.ok, status: r.status, keyLength: key.length }
      })
      const r2 = await timed(async () => {
        await getS3Client().send(new ListObjectsV2Command({ Bucket: BUCKET_NAME, MaxKeys: 1 }))
        return { ok: true }
      })
      return sendJson(res, 200, {
        ok: openai.ok && r2.ok,
        openai,
        r2,
        vapi: {
          publicKey: Boolean(process.env.VAPI_PUBLIC_KEY),
          squadId: Boolean(process.env.VAPI_SQUAD_ID),
          webhookSecret: Boolean(process.env.VAPI_WEBHOOK_SECRET),
          privateKey: Boolean(process.env.VAPI_PRIVATE_KEY), // read back finished calls after a restart
        },
        razorpay: Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET),
        login: { googleClientId: Boolean(process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID), msg91Verification: Boolean(process.env.MSG91_AUTH_KEY) },
        demoCode: Boolean(process.env.SERA_DEMO_CODE),
        forms: formsStatus(),
      })
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 13. Vapi webhook — the ONLY place the report (and its PDF) is ever generated
    // POST /api/sera/vapi-webhook   (Vapi "Server URL", with VAPI_WEBHOOK_SECRET as the credential)
    // ─────────────────────────────────────────────────────────────────────────────
    if (pathname === '/api/sera/vapi-webhook') {
      if (!verifyVapiWebhook(req.headers, process.env.VAPI_WEBHOOK_SECRET)) {
        // Which way it failed, never the values: a wrong token here means Vapi's Bearer credential
        // differs from VAPI_WEBHOOK_SECRET; "no credential" means it is not attached to this server URL.
        const sent = req.headers.authorization || req.headers['x-vapi-secret']
        console.warn(`[Vapi] webhook refused: ${!process.env.VAPI_WEBHOOK_SECRET ? 'VAPI_WEBHOOK_SECRET is not set' : sent ? 'credential does not match VAPI_WEBHOOK_SECRET' : 'no Authorization header'}`)
        return sendJson(res, 401, { error: 'Invalid webhook credential' })
      }

      // show_offers must be answered (well inside Vapi's 20 s) or Sera hangs on the tool.
      // No handoff here: the page shows the cards, and the handoff follows the card tap.
      if (body?.message?.type === 'tool-calls') {
        const message = body.message
        if (isShowOffersMessage(message)) {
          try {
            const call = message.call ?? {}
            const sessionId = sessionIdFromCall(call) ?? (await store.findSessionByVapiCallId(call.id))?.sessionId
            if (sessionId) {
              await mutateSession(sessionId, (s) => {
                if (s.vapi && !s.vapi.offersShownAt) s.vapi.offersShownAt = new Date().toISOString()
              })
            }
          } catch (err) {
            console.error('[Vapi] could not record show_offers:', err.message)
          }
        }
        return sendJson(res, 200, buildToolCallResults(message) ?? {})
      }

      const ended = parseEndOfCall(body)
      if (!ended) {
        // assistant.started / speech-update / conversation-update: which round is speaking now.
        // Answer first; the work happens in the background.
        void noteRoundSignal(body?.message).catch((err) => console.error('[Vapi] round signal failed:', err.message))
        return sendJson(res, 200, { received: true })
      }

      // Answer at once; the report takes a while and Vapi would retry a slow reply.
      processEndOfCall(ended).catch((err) => console.error('[Vapi] end-of-call processing failed:', err))
      return sendJson(res, 200, { received: true })
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 14. Get Report — read only, no LLM. The browser polls this.
    // POST /api/sera/get-report OR /.netlify/functions/sera-get-report
    // ─────────────────────────────────────────────────────────────────────────────
    if (pathname === '/api/sera/get-report' || pathname === '/.netlify/functions/sera-get-report') {
      const { sessionId } = body
      const session = sessionId ? await store.getSession(sessionId) : null
      if (!session) return sendJson(res, 200, { ready: false })

      if (session.report) return sendJson(res, 200, { ready: true, report: session.report })
      // The call was lost before the offers: the page offers the one free restart (spec 0002).
      if (session.status === 'restart_available') return sendJson(res, 200, { ready: true, restart: true })

      const stuck = session.reportState === 'running' && Date.now() - Date.parse(session.reportStartedAt) > REPORT_STALE_MS
      if (session.status === 'incomplete' || session.status === 'report_failed' || stuck) {
        // `reason` tells the page which honest message to show: the candidate said nothing, or our report failed.
        return sendJson(res, 200, { ready: true, incomplete: true, reason: session.status === 'incomplete' ? 'silent' : 'failed' })
      }
      return sendJson(res, 200, { ready: false })
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 15. Download Report PDF
    // POST /api/sera/report/download
    // ─────────────────────────────────────────────────────────────────────────────
    if (pathname === '/api/sera/report/download') {
      const { sessionId } = body
      const session = await store.getSession(sessionId)

      if (!session || !session.report) {
        return sendJson(res, 404, { ok: false, error: 'Report is not ready yet' })
      }

      const s3 = getS3Client()
      // The PDF render or upload failed when the report was built: render it now from the stored report
      // (no language model call), instead of signing a link to a file that does not exist.
      if (!session.reportPdfKey) {
        try {
          const key = `sera-reports/${session.sessionId}.pdf`
          const pdfBytes = await renderReportPdfOnServer(session.report)
          await s3.send(new PutObjectCommand({ Bucket: BUCKET_NAME, Key: key, Body: Buffer.from(pdfBytes), ContentType: 'application/pdf' }))
          await mutateSession(session.sessionId, (s) => {
            s.reportPdfKey = key
          })
          session.reportPdfKey = key
        } catch (err) {
          console.error('[Report] PDF render on download failed:', err.message)
          return sendJson(res, 503, { ok: false, error: "We couldn't prepare your PDF just now. Your report is safe — please try again in a minute." })
        }
      }
      const reportKey = session.reportPdfKey
      const command = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: reportKey })
      const downloadUrl = await getSignedUrl(s3, command, { expiresIn: 3600 })

      const filename = `Sera-Report-${session.firstName || 'Candidate'}-${new Date().toISOString().slice(0, 10)}.pdf`
      return sendJson(res, 200, { ok: true, url: downloadUrl, filename })
    }

    // Fallthrough: 404 Not Found
    return sendJson(res, 404, { error: 'Endpoint not found', path: pathname })
  } catch (err) {
    console.error(`API Error on ${pathname}:`, err)
    if (err?.statusCode === 413) return sendJson(res, 413, { error: 'Payload too large' })
    return sendJson(res, 500, { error: err.message || 'Internal server error' })
  }
})

// Graceful stop on SIGTERM, SIGINT and the admin restart; an unexpected crash is logged and exits with 1
// so the watchdog (server/supervise.mjs) starts a clean process.
const gracefulStop = createShutdown({ server, isBusy: () => workInProgress > 0 })
installProcessHandlers({ shutdown: gracefulStop.shutdown })

// After any restart: re-arm the round timers, catch up calls that ended while we were down, retry a report
// that was cut short once, and release a slot taken just before a crash (server/recovery.js).
const recovery = createRecovery({
  store,
  roundTimers,
  roundSeconds: ROUND_SECONDS,
  hasVapiKey: () => Boolean(process.env.VAPI_PRIVATE_KEY?.trim()),
  getCall,
  callToEndOfCall,
  processEndOfCall,
  finalizeReport,
  mutateSession,
})

server.listen(PORT, HOST, () => {
  console.log(`YZI Works Sera Backend Server listening on http://${HOST}:${PORT}`)
  recovery.start()
})
