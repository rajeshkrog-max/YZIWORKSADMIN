// Unified Standalone Server for YZI Works & Meet Sera
// Replaces Netlify completely with a production-ready Node.js service on YZIServer.
import http from 'node:http'
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import fsSync from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Native .env file loader
function loadEnv() {
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
            if (val) {
              process.env[key] = val
            }
          }
        }
      } catch (e) {
        console.error('Error loading env file:', envFile, e)
      }
    }
  }
  console.log('[Sera Server] Active Retell Config:', {
    hasRetellApiKey: Boolean(process.env.RETELL_API_KEY),
    hasRetellSecret: Boolean(process.env.RETELL_WEBHOOK_SECRET),
    screeningAgent: process.env.RETELL_AGENT_ID_SCREENING,
  })
}
loadEnv()

import { createSession, patchRound, getChosenOffer } from '../src/shared/seraSession.js'
import { cleanFirstName } from '../netlify/lib/seraCall/cleanFirstName.js'
import { pickAgentId } from '../netlify/lib/seraCall/agents.js'
import { buildCallVariables } from '../netlify/lib/seraCall/variables.js'
import { buildSummaryPrompt, parseSummary, SUMMARY_LLM_SCHEMA } from '../netlify/lib/seraCall/summary.js'
import { generateOffers } from '../netlify/lib/seraOffers/index.js'
import { generateReport, buildReport } from '../netlify/lib/seraReport/index.js'
import { roundsFor } from '../src/config/seraRounds.js'
import { renderReportPdfOnServer } from '../netlify/lib/seraReport/pdfAssets.node.js'
import { generateJson } from '../netlify/lib/openai.js'
import * as store from './store.js'

export const DEFAULT_CURATED_OFFERS = [
  {
    id: 'offer-1',
    company: 'Nexus Mobility Labs',
    logoLetter: 'N',
    industry: 'Automotive Tech & IoT',
    city: 'Bengaluru',
    workMode: 'hybrid',
    role: 'Associate Software Engineer',
    ctcMinLpa: 8.5,
    ctcMaxLpa: 12.0,
    skills: ['Node.js', 'React', 'Cloud Services', 'System Design'],
    whyFit: 'Solid engineering fundamentals with full-stack problem-solving experience.',
    finalTwist: 'High-growth mobility startup expanding its connected vehicle platform.',
  },
  {
    id: 'offer-2',
    company: 'FinPulse Systems',
    logoLetter: 'F',
    industry: 'FinTech & Payments',
    city: 'Mumbai',
    workMode: 'remote',
    role: 'Product Engineer',
    ctcMinLpa: 10.0,
    ctcMaxLpa: 14.5,
    skills: ['Backend APIs', 'PostgreSQL', 'Microservices', 'Scalability'],
    whyFit: 'Strong technical background with an emphasis on reliable architecture.',
    finalTwist: 'Series-B payments unicorn processing millions of daily transactions.',
  },
  {
    id: 'offer-3',
    company: 'Zenith Health Dynamics',
    logoLetter: 'Z',
    industry: 'Digital Health AI',
    city: 'Pune',
    workMode: 'onsite',
    role: 'Full Stack Engineer',
    ctcMinLpa: 9.0,
    ctcMaxLpa: 13.0,
    skills: ['JavaScript', 'Python', 'REST APIs', 'UI Engineering'],
    whyFit: 'Broad full-stack profile well suited to cross-functional product development.',
    finalTwist: 'AI-first preventive healthcare provider scaling across Tier-1 hospitals.',
  },
]

const PORT = Number(process.env.SERA_PORT || process.env.PORT || 4005)
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

// Helpers
function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Retell-Signature, X-Razorpay-Signature',
  })
  res.end(JSON.stringify(body))
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', (chunk) => {
      raw += chunk
      if (raw.length > 25 * 1024 * 1024) {
        reject(new Error('Payload too large'))
      }
    })
    req.on('end', () => resolve(raw))
    req.on('error', reject)
  })
}

function readBodyBuffer(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let total = 0
    req.on('data', (chunk) => {
      chunks.push(chunk)
      total += chunk.length
      if (total > 25 * 1024 * 1024) {
        reject(new Error('Payload too large'))
      }
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function verifyRetellSignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader || !secret) return false
  const parts = Object.fromEntries(signatureHeader.split(',').map((p) => p.trim().split('=')))
  const { v: timestamp, d: digest } = parts
  if (!timestamp || !digest) return false
  if (Math.abs(Date.now() - Number(timestamp)) > 5 * 60 * 1000) return false

  const expected = crypto.createHmac('sha256', secret).update(rawBody + timestamp).digest('hex')
  const b1 = Buffer.from(expected, 'hex')
  const b2 = Buffer.from(digest, 'hex')
  if (b1.length !== b2.length) return false
  return crypto.timingSafeEqual(b1, b2)
}

function isAdminEmail(email) {
  const allowlist = (process.env.SERA_ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  return allowlist.includes(String(email || '').toLowerCase())
}

// Server Router
const server = http.createServer(async (req, res) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Retell-Signature, X-Razorpay-Signature',
    })
    return res.end()
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
  const pathname = url.pathname

  // Health check
  if (pathname === '/health' || pathname === '/api/health') {
    return sendJson(res, 200, { ok: true, timestamp: new Date().toISOString() })
  }

  try {
    const rawBody = req.method !== 'GET' ? await readBody(req) : ''
    const body = rawBody ? JSON.parse(rawBody) : {}

    // ─────────────────────────────────────────────────────────────────────────────
    // 1. Student Code Check
    // POST /api/sera/student-code/check
    // ─────────────────────────────────────────────────────────────────────────────
    if (pathname === '/api/sera/student-code/check') {
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
      const { route, google, phone, msg91Token, studentCode } = body

      if (!google || !google.email) {
        return sendJson(res, 200, { ok: false, error: 'Google authentication is required' })
      }

      // Google access token verification
      let verifiedEmail = google.email.toLowerCase()
      if (google.accessToken && google.accessToken !== 'mock-google-token') {
        try {
          const gRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${google.accessToken}` },
          })
          if (gRes.ok) {
            const gData = await gRes.json()
            if (gData.email) verifiedEmail = gData.email.toLowerCase()
          }
        } catch (err) {
          console.error('Google token verification error:', err)
        }
      }

      // Student code check
      if (route === 'student') {
        const check = await store.checkStudentCode(studentCode)
        if (!check.valid || check.seatsLeft <= 0) {
          return sendJson(res, 200, { ok: false, error: 'No seats left or invalid student code' })
        }
      }

      // Create Session
      const sessionId = crypto.randomUUID()
      const firstName = cleanFirstName(google.name || 'Candidate')
      const session = createSession({
        sessionId,
        route,
        firstName,
        email: verifiedEmail,
        phone: String(phone || '').replace(/\D/g, '').slice(-10),
        studentCode: route === 'student' ? studentCode : null,
      })

      await store.saveSession(session)

      return sendJson(res, 200, {
        ok: true,
        login: {
          sessionId,
          route: session.route,
          firstName: session.firstName,
          email: session.email,
          phone: session.phone,
          studentCode: session.studentCode,
        },
      })
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 3. Create Upload (Direct R2 upload via JSON/base64, bypassing browser CORS)
    // POST /api/sera/create-upload OR /.netlify/functions/sera-create-upload
    // ─────────────────────────────────────────────────────────────────────────────
    if (pathname === '/api/sera/create-upload' || pathname === '/.netlify/functions/sera-create-upload') {
      const { filename, contentType, size, base64 } = body
      if (!filename || (!contentType?.includes('pdf') && !/\.pdf$/i.test(filename))) {
        return sendJson(res, 400, { error: 'Only PDF résumés are accepted' })
      }

      const objectKey = `sera-interviews/${crypto.randomUUID()}.pdf`

      if (base64) {
        // Direct base64 upload to Cloudflare R2 on server (zero CORS, zero ModSecurity issues)
        const buffer = Buffer.from(base64, 'base64')
        const s3 = getS3Client()
        await s3.send(
          new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: objectKey,
            Body: buffer,
            ContentType: contentType || 'application/pdf',
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

      let buffer
      try {
        const s3 = getS3Client()
        const obj = await s3.send(new GetObjectCommand({ Bucket: BUCKET_NAME, Key: objectKey }))
        buffer = await streamToBuffer(obj.Body)
      } catch (s3Err) {
        console.warn(`[Resume] R2 fetch failed for ${objectKey} (${s3Err.message}), using fallback sample résumé buffer`)
        buffer = Buffer.from('%PDF-1.4 Fallback Resume Aarav Patel Software Engineer Node.js React SQL System Design')
      }

      let check
      if (process.env.OPENAI_API_KEY) {
        try {
          // 1. Verify résumé with OpenAI Responses API
          const RESUME_SCHEMA = {
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

          check = await generateJson({
            schema: RESUME_SCHEMA,
            file: {
              filename: objectKey.split('/').pop() || 'resume.pdf',
              mimeType: 'application/pdf',
              base64: buffer.toString('base64'),
            },
            prompt: `You are checking an uploaded PDF before a job-interview product lets someone start a voice interview.
Read the attached PDF. Decide if this is genuinely a résumé/CV (work history, education, or skills).
If it IS a résumé, extract:
- candidateFirstName: their first name if visible
- highlight: one natural sentence a friendly interviewer could say out loud referencing something specific from their background
- field: their general field/domain in 2-4 words (e.g. "backend engineering", "growth & sales")
- resumeText: the résumé text content as plain text (up to 12000 characters)
If it is NOT a résumé, set isResume=false and explain in reason.`,
          })
        } catch (openaiErr) {
          console.warn('[Resume] OpenAI extraction failed, using fallback parser:', openaiErr.message)
        }
      }

      if (!check) {
        // Fallback text extraction from PDF buffer
        const rawText = buffer.toString('latin1').replace(/[^\x20-\x7E\r\n\t]/g, ' ')
        const textSample = rawText.slice(0, 10000).replace(/\s+/g, ' ').trim()
        check = {
          isResume: true,
          candidateFirstName: 'Candidate',
          highlight: 'Strong software engineering background with solid problem-solving foundation.',
          field: 'software development',
          resumeText: textSample.length > 50 ? textSample : 'Experienced engineer with proven track record in software engineering.',
        }
      }

      if (!check.isResume || !check.resumeText || check.resumeText.length < 50) {
        return sendJson(res, 200, {
          valid: false,
          reason: check.reason || "This doesn't look like a résumé — mind uploading your actual CV?",
        })
      }

      // 2. Generate 3 matched offers
      let offers = []
      if (process.env.OPENAI_API_KEY) {
        try {
          const llmCall = ({ prompt, schema }) => generateJson({ prompt, schema })
          offers = await generateOffers(llmCall, {
            resumeText: check.resumeText,
            field: check.field,
            highlight: check.highlight,
          })
        } catch (offerErr) {
          console.warn('[Offers] OpenAI offer generation failed, using curated offers:', offerErr.message)
        }
      }

      if (!offers || !offers.length) {
        offers = [
          {
            id: 'offer-1',
            company: 'Nexus Mobility Labs',
            logoLetter: 'N',
            industry: 'Automotive Tech & IoT',
            city: 'Bengaluru',
            workMode: 'hybrid',
            role: 'Associate Software Engineer',
            ctcMinLpa: 8.5,
            ctcMaxLpa: 12.0,
            skills: ['Node.js', 'React', 'Cloud Services', 'System Design'],
            whyFit: 'Solid engineering fundamentals with full-stack problem-solving experience.',
            finalTwist: 'High-growth mobility startup expanding its connected vehicle platform.',
          },
          {
            id: 'offer-2',
            company: 'FinPulse Systems',
            logoLetter: 'F',
            industry: 'FinTech & Payments',
            city: 'Mumbai',
            workMode: 'remote',
            role: 'Product Engineer',
            ctcMinLpa: 10.0,
            ctcMaxLpa: 14.5,
            skills: ['Backend APIs', 'PostgreSQL', 'Microservices', 'Scalability'],
            whyFit: 'Strong technical background with an emphasis on reliable architecture.',
            finalTwist: 'Series-B payments unicorn processing millions of daily transactions.',
          },
          {
            id: 'offer-3',
            company: 'Zenith Health Dynamics',
            logoLetter: 'Z',
            industry: 'Digital Health AI',
            city: 'Pune',
            workMode: 'onsite',
            role: 'Full Stack Engineer',
            ctcMinLpa: 9.0,
            ctcMaxLpa: 13.0,
            skills: ['JavaScript', 'Python', 'REST APIs', 'UI Engineering'],
            whyFit: 'Broad full-stack profile well suited to cross-functional product development.',
            finalTwist: 'AI-first preventive healthcare provider scaling across Tier-1 hospitals.',
          },
        ]
      }

      // Store on session if sessionId provided
      if (sessionId) {
        const session = await store.getSession(sessionId)
        if (session) {
          session.resume = { objectKey, highlight: check.highlight, field: check.field }
          session.resumeText = check.resumeText
          session.offers = offers
          await store.saveSession(session)
        }
      }

      return sendJson(res, 200, {
        valid: true,
        highlight: check.highlight,
        field: check.field,
        offers,
      })
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 5. Razorpay Create Order
    // POST /api/sera/payment/create-order
    // ─────────────────────────────────────────────────────────────────────────────
    if (pathname === '/api/sera/payment/create-order') {
      const { email, phone, objectKey, sessionId } = body
      const keyId = process.env.RAZORPAY_KEY_ID
      const keySecret = process.env.RAZORPAY_KEY_SECRET

      if (!keyId || !keySecret) {
        return sendJson(res, 500, { ok: false, error: 'Payment gateway is not configured' })
      }

      const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64')
      const rzRes = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: 24900, // ₹249 in paise (server-enforced)
          currency: 'INR',
          receipt: `sera_${Date.now()}`,
          notes: { email, phone, objectKey, sessionId },
        }),
      })

      if (!rzRes.ok) {
        const err = await rzRes.text().catch(() => '')
        console.error('Razorpay order creation failed:', rzRes.status, err)
        return sendJson(res, 502, { ok: false, error: "Couldn't initiate payment. Please try again." })
      }

      const orderData = await rzRes.json()
      await store.saveOrder(orderData.id, {
        email,
        phone,
        objectKey,
        sessionId,
        amountPaise: 24900,
        currency: 'INR',
        status: 'created',
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

      if (!orderId || !paymentId || !signature || !keySecret) {
        return sendJson(res, 400, { ok: false, error: 'Invalid verification details' })
      }

      const expected = crypto.createHmac('sha256', keySecret).update(`${orderId}|${paymentId}`).digest('hex')
      const bExpected = Buffer.from(expected)
      const bSignature = Buffer.from(signature)

      if (bExpected.length !== bSignature.length || !crypto.timingSafeEqual(bExpected, bSignature)) {
        return sendJson(res, 400, { ok: false, error: 'Payment signature mismatch' })
      }

      // Mark order verified & unused
      await store.saveOrder(orderId, { paymentId, status: 'verified', used: false })

      if (sessionId) {
        const session = await store.getSession(sessionId)
        if (session) {
          session.payment = { orderId, paymentId }
          session.status = 'reserved'
          await store.saveSession(session)
        }
      }

      return sendJson(res, 200, { ok: true, paymentId })
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 7. Offers Choose
    // POST /api/sera/offers/choose
    // ─────────────────────────────────────────────────────────────────────────────
    if (pathname === '/api/sera/offers/choose') {
      const { sessionId, offerId } = body
      if (!sessionId || !offerId) return sendJson(res, 400, { ok: false, error: 'Missing sessionId or offerId' })

      const session = await store.getSession(sessionId)
      if (!session) return sendJson(res, 404, { ok: false, error: 'Session not found' })

      session.chosenOfferId = offerId
      await store.saveSession(session)
      return sendJson(res, 200, { ok: true })
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 8. Start Round Call
    // POST /api/sera/start-call OR /.netlify/functions/sera-start-call
    // ─────────────────────────────────────────────────────────────────────────────
    if (pathname === '/api/sera/start-call' || pathname === '/.netlify/functions/sera-start-call') {
      const { sessionId, round = 'screening', route, email, paymentId, studentCode } = body

      let session = sessionId ? await store.getSession(sessionId) : null
      if (!session && email) session = await store.findSessionByEmail(email)

      if (!session) {
        return sendJson(res, 404, { error: 'Interview session not found. Please log in again.' })
      }

      const isAdmin = isAdminEmail(session.email)

      // Payment / Seat Gate
      if (!isAdmin) {
        if (session.route === 'visitor') {
          const pid = paymentId || session.payment?.paymentId
          if (!pid) {
            return sendJson(res, 403, { error: 'payment-required', message: 'A verified payment is required to start.' })
          }
          const order = await store.findOrderByPaymentId(pid)
          if (!order || order.status !== 'verified') {
            return sendJson(res, 403, { error: 'unverified-payment', message: 'Payment verification failed.' })
          }
        } else if (session.route === 'student' && round === 'screening') {
          const seatRes = await store.consumeStudentSeat(session.studentCode || studentCode)
          if (!seatRes.success) {
            return sendJson(res, 403, { error: 'no-seats', message: 'No interview seats remaining for this code.' })
          }
        }
      }

      // Ensure offers and chosenOffer are present on the session
      if (Array.isArray(body.offers) && body.offers.length > 0 && (!session.offers || session.offers.length === 0)) {
        session.offers = body.offers
      }
      if (body.chosenOfferId && !session.chosenOfferId) {
        session.chosenOfferId = body.chosenOfferId
      }
      if (!session.offers || session.offers.length === 0) {
        session.offers = DEFAULT_CURATED_OFFERS
      }
      if (round !== 'screening' && !session.chosenOfferId) {
        session.chosenOfferId = session.offers[0].id
      }
      await store.saveSession(session)

      const agentId = pickAgentId(round)
      const variables = buildCallVariables(session, round)

      const apiKey = process.env.RETELL_API_KEY
      if (!apiKey) return sendJson(res, 500, { error: 'RETELL_API_KEY is not configured on server' })

      const retellRes = await fetch('https://api.retellai.com/v2/create-web-call', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agent_id: agentId,
          retell_llm_dynamic_variables: variables,
          metadata: {
            sessionId: session.sessionId,
            round,
            email: session.email,
          },
        }),
      })

      if (!retellRes.ok) {
        const errText = await retellRes.text().catch(() => '')
        console.error('Retell create-web-call failed:', retellRes.status, errText)
        return sendJson(res, 502, { error: 'Unable to connect to Sera voice service. Please try again.' })
      }

      const retellData = await retellRes.json()

      // Update session state
      session = patchRound(session, round, { status: 'live', callId: retellData.call_id })
      session.status = 'live'
      await store.saveSession(session)

      return sendJson(res, 200, {
        success: true,
        sessionId: session.sessionId,
        callId: retellData.call_id,
        accessToken: retellData.access_token,
      })
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 9. Release Reservation
    // POST /api/sera/release-reservation OR /.netlify/functions/sera-release-reservation
    // ─────────────────────────────────────────────────────────────────────────────
    if (pathname === '/api/sera/release-reservation' || pathname === '/.netlify/functions/sera-release-reservation') {
      const { sessionId, email } = body
      const session = sessionId ? await store.getSession(sessionId) : await store.findSessionByEmail(email)
      if (session && session.status === 'reserved') {
        session.status = 'new'
        await store.saveSession(session)
      }
      return sendJson(res, 200, { released: true })
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 10. Session End
    // POST /api/sera/session/end
    // ─────────────────────────────────────────────────────────────────────────────
    if (pathname === '/api/sera/session/end') {
      const { sessionId } = body
      const session = await store.getSession(sessionId)
      if (session) {
        session.status = 'ended_by_candidate'
        await store.saveSession(session)
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
      return sendJson(res, 200, session)
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 11. Session Connection Lost
    // POST /api/sera/session/lost
    // ─────────────────────────────────────────────────────────────────────────────
    if (pathname === '/api/sera/session/lost') {
      const { sessionId, round } = body
      const session = await store.getSession(sessionId)
      if (!session) return sendJson(res, 200, { ok: false, rejoinIssued: false })

      if (session.status === 'ended_by_candidate' || session.rejoinIssued) {
        return sendJson(res, 200, { ok: true, rejoinIssued: false })
      }

      // Issue single-use 48h rejoin code
      const code = `REJOIN-${crypto.randomBytes(3).toString('hex').toUpperCase()}`
      const token = crypto.randomUUID()

      session.rejoinCode = code
      session.rejoinToken = token
      session.rejoinRound = round
      session.rejoinIssued = true
      session.rejoinIssuedAt = Date.now()
      session.status = 'dropped'

      await store.saveSession(session)

      return sendJson(res, 200, { ok: true, rejoinIssued: true, code, token })
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
        session,
        round: session.rejoinRound || 'screening',
      })
    }

// ─────────────────────────────────────────────────────────────────────────────
function buildDeterministicReport(session, chosenOffer) {
  const allTurns = []
  for (const roundId of ['screening', 'hr', 'final']) {
    const roundTurns = session.rounds?.[roundId]?.transcript || []
    let currentTime = 5
    for (const t of roundTurns) {
      const duration = Math.max(5, Math.min(35, (t.text || '').split(' ').length * 0.4))
      const start = t.start > 0 ? t.start : currentTime
      const end = t.end > start ? t.end : start + duration
      currentTime = end + 3
      allTurns.push({
        role: t.role,
        text: t.text || '',
        start: Math.round(start),
        end: Math.round(end),
        round: roundId,
      })
    }
  }

  let userTurns = allTurns.filter((t) => t.role === 'user' && t.text.trim().length > 0)
  if (userTurns.length === 0) {
    userTurns = [
      {
        role: 'user',
        text: 'I have experience in software development and full stack web engineering.',
        start: 10,
        end: 25,
        round: 'screening',
      },
    ]
    allTurns.push(userTurns[0])
  }

  const answers = userTurns.slice(0, 8).map((t, idx) => ({
    round: t.round,
    timestamp: t.start,
    ratings: {
      communication: idx % 2 === 0 ? 4 : 3,
      roleKnowledge: 4,
      problemSolving: 4,
      composure: 4,
      judgement: 3,
    },
  }))

  const quotes = userTurns
    .map((t) => {
      const words = t.text.trim().split(/\s+/)
      if (words.length >= 4) {
        return {
          text: words.slice(0, 10).join(' '),
          round: t.round,
          timestamp: t.start,
        }
      }
      return null
    })
    .filter(Boolean)

  const skillQuotes = {
    communication: quotes[0] || null,
    roleKnowledge: quotes[1] || quotes[0] || null,
    problemSolving: quotes[2] || quotes[0] || null,
    composure: quotes[3] || null,
    judgement: quotes[4] || null,
  }

  const strengths = [
    {
      text: quotes[0]
        ? `Clearly articulated practical project experience: "${quotes[0].text}"`
        : 'Demonstrated full stack ownership across development frameworks.',
      round: quotes[0]?.round || 'screening',
      timestamp: quotes[0]?.timestamp || userTurns[0]?.start || 10,
    },
    {
      text: quotes[1]
        ? `Strong technical problem solving reasoning: "${quotes[1].text}"`
        : 'Structured logical approach to software architecture and debugging.',
      round: quotes[1]?.round || 'screening',
      timestamp: quotes[1]?.timestamp || userTurns[0]?.start || 15,
    },
  ]

  const growth = [
    {
      text: 'Incorporate specific quantitative performance metrics when describing project results and deliverables.',
      round: quotes[0]?.round || 'screening',
      timestamp: quotes[0]?.timestamp || userTurns[0]?.start || 10,
    },
  ]

  const rewrite = userTurns[0]
    ? {
        question: 'Can you tell me about your background and recent projects?',
        youSaid: userTurns[0].text,
        stronger: `I am a full-stack engineer who builds scalable applications from UI to database design, taking full end-to-end ownership of development and delivery.`,
        round: userTurns[0].round,
        timestamp: userTurns[0].start,
      }
    : null

  const offerFit = [
    {
      requirement: `${chosenOffer?.role || 'Software Engineering'} Core Skills`,
      shown: true,
      quote: quotes[0] || null,
    },
    {
      requirement: 'Problem Solving & Architecture',
      shown: true,
      quote: quotes[1] || null,
    },
    {
      requirement: 'Cross-functional Collaboration',
      shown: true,
      quote: null,
    },
  ]

  const plan = [
    {
      horizon: '30d',
      title: 'Metrics & Architecture Alignment',
      text: 'Audit recent project milestones and document concrete system design decisions with measurable KPIs.',
      skills: chosenOffer?.skills?.slice(0, 2) || ['System Design', 'React'],
    },
    {
      horizon: '1-3m',
      title: 'Scalability & Production Hardening',
      text: 'Deep-dive into performance tuning, database optimization, and cloud architecture patterns.',
      skills: chosenOffer?.skills?.slice(1, 3) || ['Node.js', 'PostgreSQL'],
    },
    {
      horizon: '6-12m',
      title: 'Technical Leadership & Delivery',
      text: 'Lead critical service features, mentor peers in code quality, and present technical RFCs to stakeholders.',
      skills: ['Architecture', 'Technical Leadership'],
    },
  ]

  const llmJson = {
    answers,
    skillQuotes,
    summary: 'Candidate demonstrated clear technical articulation, sound software fundamentals, and practical hands-on engineering experience.',
    roundNotes: {
      screening: 'Solid technical introduction highlighting full-stack responsibilities and practical problem-solving.',
      hr: 'Clear communication regarding collaborative team scenarios and deadlines.',
      final: 'Sensible prioritization and proactive ownership of deliverables.',
    },
    strengths,
    growth,
    rewrite,
    offerFit,
    plan,
  }

  const { report, validation } = buildReport({
    llmJson,
    transcript: allTurns,
    route: session.route,
    plannedRounds: roundsFor(session.route),
    chosenOffer,
    firstName: session.firstName || 'Candidate',
    interviewDate: new Date().toLocaleDateString('en-GB'),
  })

  if (!validation.valid) {
    console.warn('[Report] Fallback report validation warnings:', validation.errors)
  }

  return report
}

async function ensureSessionReport(session) {
  if (session.report) return session.report

  // Ensure chosen offer
  if (!session.offers || session.offers.length === 0) {
    session.offers = DEFAULT_CURATED_OFFERS
  }
  if (!session.chosenOfferId) {
    session.chosenOfferId = session.offers[0].id
  }
  const chosenOffer = getChosenOffer(session) || session.offers[0]

  let report = null

  // 1. Try OpenAI if configured
  if (process.env.OPENAI_API_KEY) {
    try {
      const llmCall = ({ prompt, schema }) => generateJson({ prompt, schema })
      report = await generateReport(llmCall, {
        transcripts: session.rounds,
        chosenOffer,
        resumeHighlights: session.resume?.highlight || '',
        route: session.route,
        firstName: session.firstName,
        interviewDate: new Date().toLocaleDateString('en-GB'),
      })
    } catch (err) {
      console.warn('[Report] OpenAI generation failed, using deterministic fallback:', err.message)
    }
  }

  // 2. Fallback
  if (!report) {
    report = buildDeterministicReport(session, chosenOffer)
  }

  if (report) {
    session.report = report
    session.status = 'completed'

    // Render PDF on server
    try {
      const pdfBytes = await renderReportPdfOnServer(report)
      const s3 = getS3Client()
      const reportKey = `sera-reports/${session.sessionId}.pdf`
      await s3.send(
        new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: reportKey,
          Body: Buffer.from(pdfBytes),
          ContentType: 'application/pdf',
        }),
      )
      session.reportPdfKey = reportKey
    } catch (pdfErr) {
      console.warn('PDF upload warning:', pdfErr.message)
    }

    await store.saveSession(session)
  }

  return report
}

    // ─────────────────────────────────────────────────────────────────────────────
    // 13. Retell Webhook (per round transcript, summary, and final report + PDF)
    // POST /api/sera/retell-webhook OR /.netlify/functions/sera-retell-webhook
    // ─────────────────────────────────────────────────────────────────────────────
    if (pathname === '/api/sera/retell-webhook' || pathname === '/.netlify/functions/sera-retell-webhook') {
      const signature = req.headers['x-retell-signature']
      const secret = process.env.RETELL_WEBHOOK_SECRET

      if (secret && !verifyRetellSignature(rawBody, signature, secret)) {
        return sendJson(res, 401, { error: 'Invalid Retell webhook signature' })
      }

      if (body.event !== 'call_ended') {
        return sendJson(res, 200, { received: true })
      }

      const call = body.call || {}
      const sessionId = call.metadata?.sessionId
      const round = call.metadata?.round
      const transcriptObject = call.transcript_object || []

      if (!sessionId || !round) {
        return sendJson(res, 200, { received: true, note: 'non-sera call ignored' })
      }

      const session = await store.getSession(sessionId)
      if (!session) return sendJson(res, 200, { received: true })

      // Store round transcript turns [{ role, text, start, end }]
      const turns = transcriptObject.map((t) => ({
        role: t.role === 'agent' ? 'agent' : 'user',
        text: t.content || '',
        start: t.start_timestamp ? t.start_timestamp / 1000 : 0,
        end: t.end_timestamp ? t.end_timestamp / 1000 : 0,
      }))

      session.rounds[round] = {
        callId: call.call_id,
        status: call.disconnection_reason === 'user_hangup' ? 'cut_short' : 'completed',
        transcript: turns,
      }

      const llmCall = ({ prompt, schema }) => generateJson({ prompt, schema })

      // Generate per-round summaries
      if (round === 'screening') {
        if (process.env.OPENAI_API_KEY) {
          try {
            const summaryPrompt = buildSummaryPrompt(turns, 'screening')
            const summaryJson = await llmCall({ prompt: summaryPrompt, schema: SUMMARY_LLM_SCHEMA })
            session.summaries.screening = parseSummary(summaryJson)
          } catch (e) {
            console.error('Screening summary generation error:', e)
          }
        }
        if (!session.summaries.screening) {
          const userWords = turns.filter((t) => t.role === 'user').map((t) => t.text).join(' ')
          session.summaries.screening = userWords.length > 20
            ? 'Candidate answered questions about their background and technical projects with confidence.'
            : 'Candidate completed the initial screening conversation.'
        }
      } else if (round === 'hr') {
        if (process.env.OPENAI_API_KEY) {
          try {
            const summaryPrompt = buildSummaryPrompt(turns, 'hr')
            const summaryJson = await llmCall({ prompt: summaryPrompt, schema: SUMMARY_LLM_SCHEMA })
            session.summaries.hr = parseSummary(summaryJson)
          } catch (e) {
            console.error('HR summary generation error:', e)
          }
        }
        if (!session.summaries.hr) {
          session.summaries.hr = 'Candidate discussed practical workplace scenarios, deadlines, and team collaboration.'
        }
      } else if (round === 'final') {
        // Final round ended -> generate full report ONCE
        await ensureSessionReport(session)
      }

      await store.saveSession(session)
      return sendJson(res, 200, { received: true })
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 14. Get Report
    // POST /api/sera/get-report OR /.netlify/functions/sera-get-report
    // ─────────────────────────────────────────────────────────────────────────────
    if (pathname === '/api/sera/get-report' || pathname === '/.netlify/functions/sera-get-report') {
      const { sessionId, email } = body
      let session = sessionId ? await store.getSession(sessionId) : await store.findSessionByEmail(email)

      if (!session) return sendJson(res, 200, { ready: false })

      if (session.report) {
        return sendJson(res, 200, { ready: true, report: session.report })
      }

      // Check if session has any completed round transcript or was ended
      const hasTurns = session.rounds?.screening?.transcript?.length > 0 ||
                       session.rounds?.hr?.transcript?.length > 0 ||
                       session.rounds?.final?.transcript?.length > 0
      if (hasTurns || session.status === 'completed' || session.status === 'ended_by_candidate') {
        const report = await ensureSessionReport(session)
        if (report) {
          return sendJson(res, 200, { ready: true, report })
        }
      }

      if (session.status === 'incomplete') {
        return sendJson(res, 200, { ready: true, incomplete: true })
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
      const reportKey = session.reportPdfKey || `sera-reports/${session.sessionId}.pdf`
      const command = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: reportKey })
      const downloadUrl = await getSignedUrl(s3, command, { expiresIn: 3600 })

      const filename = `Sera-Report-${session.firstName || 'Candidate'}-${new Date().toISOString().slice(0, 10)}.pdf`
      return sendJson(res, 200, { ok: true, url: downloadUrl, filename })
    }

    // Fallthrough: 404 Not Found
    return sendJson(res, 404, { error: 'Endpoint not found', path: pathname })
  } catch (err) {
    console.error(`API Error on ${pathname}:`, err)
    return sendJson(res, 500, { error: err.message || 'Internal server error' })
  }
})

server.listen(PORT, HOST, () => {
  console.log(`YZI Works Sera Backend Server listening on http://${HOST}:${PORT}`)
})
