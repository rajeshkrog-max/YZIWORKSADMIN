import crypto from 'node:crypto'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { getEligibilityStore } from '../lib/eligibilityStore.js'
import { generateJson } from '../lib/openai.js'
import { REPORT_SCHEMA, buildReportPrompt } from '../lib/seraReport.js'

const BUCKET_NAME = 'yzi-application-files'
const RESUME_LINK_EXPIRY = 7 * 24 * 60 * 60

function escapeHtml(value) {
  if (value === null || value === undefined) return ''
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

// Per docs.retellai.com/features/secure-webhook: header is
// "X-Retell-Signature: v={timestamp},d={hex}", digest is
// HMAC-SHA256(raw_body + timestamp) keyed with the webhook-badged API key —
// Retell doesn't issue a separate webhook secret, it's the account's own
// RETELL_API_KEY (confirmed via live docs; using a made-up RETELL_WEBHOOK_SECRET
// here was why every real webhook was failing verification with 401).
const SIGNATURE_MAX_AGE_MS = 5 * 60 * 1000

function verifySignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader || !secret) return false

  const parts = Object.fromEntries(
    signatureHeader.split(',').map((part) => part.trim().split('='))
  )
  const timestamp = parts.v
  const digest = parts.d

  if (!timestamp || !digest) return false

  if (Math.abs(Date.now() - Number(timestamp)) > SIGNATURE_MAX_AGE_MS) return false

  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody + timestamp)
    .digest('hex')

  const expectedBuffer = Buffer.from(expected, 'hex')
  const digestBuffer = Buffer.from(digest, 'hex')

  if (expectedBuffer.length !== digestBuffer.length) return false
  return crypto.timingSafeEqual(expectedBuffer, digestBuffer)
}

function getS3Client() {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  })
}

function buildEmailHtml({ candidateName, email, transcript, report, resumeUrl }) {
  const strengthItems = (report.strengths || [])
    .map((s) => `<li style="margin:6px 0;">${escapeHtml(s)}</li>`)
    .join('')
  const growthItems = (report.growthAreas || [])
    .map((s) => `<li style="margin:6px 0;">${escapeHtml(s)}</li>`)
    .join('')
  const roadmapRows = (report.roadmap || [])
    .map(
      (tier) => `
        <tr>
          <td style="padding:10px 0; color:#A1A1AA; vertical-align:top; width:110px;">${escapeHtml(tier.tier)}</td>
          <td style="padding:10px 0; color:#ffffff;">
            <strong>${escapeHtml(tier.role)}</strong><br/>
            <span style="color:#A1A1AA; font-size:13px;">${escapeHtml(tier.description)}</span><br/>
            <span style="color:#71717A; font-size:12px;">${(tier.skills || []).map(escapeHtml).join(', ')}</span>
          </td>
        </tr>`
    )
    .join('')

  return `
    <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; background: #0B0B14; color: #ffffff; padding: 30px; border-radius: 12px;">
      <p style="font-size: 16px; margin-top: 0;">Hii Team,</p>
      <p style="color: #A1A1AA; margin: 15px 0 25px;">A Meet Ai Sera interview just finished.</p>

      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr>
          <td style="padding: 8px 0; color: #A1A1AA; width: 140px;">Candidate</td>
          <td style="color:#ffffff;">${escapeHtml(candidateName)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #A1A1AA;">Email</td>
          <td><a href="mailto:${escapeHtml(email)}" style="color:#FF7A45; text-decoration:none;">${escapeHtml(email)}</a></td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #A1A1AA; vertical-align: top;">Résumé</td>
          <td><a href="${escapeHtml(resumeUrl)}" style="color:#60A5FA; text-decoration:none;">Download (link expires in 7 days)</a></td>
        </tr>
      </table>

      <div style="margin-top: 20px; padding: 20px; background: #11111D; border: 1px solid #272733; border-radius: 10px;">
        <p style="margin:0 0 12px; color:#4ADE80; font-weight:bold; font-size:14px;">Strengths</p>
        <ul style="margin:0; padding-left:18px; color:#ffffff; font-size:14px;">${strengthItems}</ul>
        <p style="margin:18px 0 12px; color:#FBBF24; font-weight:bold; font-size:14px;">Growth areas</p>
        <ul style="margin:0; padding-left:18px; color:#ffffff; font-size:14px;">${growthItems}</ul>
        <p style="margin:18px 0 0; color:#A1A1AA; font-style:italic; font-size:13px;">"${escapeHtml(report.seraNote)}"</p>
      </div>

      <div style="margin-top: 20px; padding: 20px; background: #11111D; border: 1px solid #272733; border-radius: 10px;">
        <p style="margin:0 0 14px; color:#ffffff; font-weight:bold; font-size:14px;">Roadmap</p>
        <table style="width:100%; border-collapse:collapse;">${roadmapRows}</table>
      </div>

      <div style="margin-top: 20px; padding: 20px; background: #11111D; border: 1px solid #272733; border-radius: 10px;">
        <p style="margin:0 0 12px; color:#ffffff; font-weight:bold; font-size:14px;">Transcript</p>
        <p style="margin:0; color:#A1A1AA; font-size:13px; line-height:1.6; white-space:pre-wrap;">${escapeHtml(transcript)}</p>
      </div>

      <p style="margin-top: 30px;">
        Thank you<br/>
        <strong style="color: #FF5E00;">SERA</strong><br/>
        <span style="color: #A1A1AA; font-size: 13px;">Young Zone India Works</span>
      </p>
    </div>
  `
}

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  const rawBody = event.body || ''

  const signatureHeader = event.headers['x-retell-signature'] || event.headers['X-Retell-Signature']
  const isValid = verifySignature(rawBody, signatureHeader, process.env.RETELL_API_KEY)

  if (!isValid) {
    console.error('Sera webhook: invalid signature')
    return { statusCode: 401, body: JSON.stringify({ error: 'Invalid signature' }) }
  }

  try {
    const payload = JSON.parse(rawBody)

    if (payload.event !== 'call_ended') {
      return { statusCode: 200, body: JSON.stringify({ received: true }) }
    }

    const call = payload.call || {}
    const email = call.metadata?.email
    const objectKey = call.metadata?.objectKey
    const transcript = call.transcript || ''

    if (!email) {
      console.error('Sera webhook: call_ended with no email in metadata')
      return { statusCode: 200, body: JSON.stringify({ received: true }) }
    }

    const store = getEligibilityStore()
    const record = (await store.get(email.toLowerCase(), { type: 'json' })) || {}
    const candidateName = record.name || 'Candidate'
    const resumeText = record.resumeText || ''
    const resolvedObjectKey = objectKey || record.objectKey

    const report = await generateJson({
      schema: REPORT_SCHEMA,
      prompt: buildReportPrompt({ candidateName, resumeText, transcript }),
    })

    let resumeUrl = '#'
    if (resolvedObjectKey) {
      const s3 = getS3Client()
      resumeUrl = await getSignedUrl(
        s3,
        new GetObjectCommand({
          Bucket: BUCKET_NAME,
          Key: resolvedObjectKey,
          ResponseContentDisposition: 'inline; filename="resume.pdf"',
        }),
        { expiresIn: RESUME_LINK_EXPIRY }
      )
    }

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'YZI Works <onboarding@resend.dev>',
        to: ['admin@youngzoneindia.com'],
        subject: `Sera Interview: ${candidateName}`,
        html: buildEmailHtml({ candidateName, email, transcript, report, resumeUrl }),
      }),
    })

    if (!emailResponse.ok) {
      const errorBody = await emailResponse.text().catch(() => '')
      console.error('Sera webhook: Resend error', errorBody)
    }

    // Store the report itself (not just a "completed" flag) so the browser
    // can read back this exact result instead of paying for a second,
    // duplicate analysis call of its own.
    await store.setJSON(email.toLowerCase(), {
      ...record,
      status: 'completed',
      report,
      completedAt: new Date().toISOString(),
    })

    return { statusCode: 200, body: JSON.stringify({ received: true }) }
  } catch (error) {
    console.error('Sera webhook error:', error)
    return { statusCode: 500, body: JSON.stringify({ error: 'Webhook processing failed' }) }
  }
}
