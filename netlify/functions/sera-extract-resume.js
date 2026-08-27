import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { generateJson } from '../lib/openai.js'

const BUCKET_NAME = 'yzi-application-files'
const MAX_TEXT_LENGTH = 12000

// pdfjs-dist's legacy build is genuinely ESM-only (.mjs, no CJS fallback).
// Calling it directly (no unpdf wrapper — that had its own separate,
// unrelated bug) is correct; what actually broke this in production was
// Netlify's bundler rewriting the import into a require() call, fixed via
// external_node_modules in netlify.toml, not anything in this file.
async function extractPdfText(buffer) {
  const loadingTask = getDocument({ data: new Uint8Array(buffer) })
  const pdf = await loadingTask.promise
  let fullText = ''
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    fullText += content.items.map((item) => item.str).join(' ') + '\n'
  }
  return fullText.trim()
}

function getS3Client() {
  const accountId = process.env.R2_ACCOUNT_ID
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('R2 environment variables are not configured')
  }

  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  })
}

async function streamToBuffer(stream) {
  const chunks = []
  for await (const chunk of stream) {
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

const RESUME_CHECK_SCHEMA = {
  type: 'object',
  properties: {
    isResume: { type: 'boolean' },
    reason: { type: 'string' },
    candidateFirstName: { type: 'string' },
    highlight: { type: 'string' },
    field: { type: 'string' },
  },
  required: ['isResume', 'reason', 'candidateFirstName', 'highlight', 'field'],
  additionalProperties: false,
}

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  try {
    const { objectKey } = JSON.parse(event.body || '{}')

    if (typeof objectKey !== 'string' || !objectKey.startsWith('sera-interviews/')) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid attachment location' }) }
    }

    const s3 = getS3Client()
    const object = await s3.send(new GetObjectCommand({ Bucket: BUCKET_NAME, Key: objectKey }))
    const buffer = await streamToBuffer(object.Body)

    let extractedText = ''
    try {
      extractedText = await extractPdfText(buffer)
    } catch (err) {
      console.error('Sera extract-resume: PDF parse failed', {
        objectKey,
        bufferBytes: buffer.length,
        error: err?.stack || err?.message || err,
      })
      return {
        statusCode: 200,
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          valid: false,
          reason: "That file doesn't look like a readable PDF — mind double-checking it?",
        }),
      }
    }

    if (extractedText.length < 80) {
      return {
        statusCode: 200,
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          valid: false,
          reason: "This PDF doesn't have enough readable text — please upload your actual résumé.",
        }),
      }
    }

    const safeText = extractedText.slice(0, MAX_TEXT_LENGTH)

    const check = await generateJson({
      schema: RESUME_CHECK_SCHEMA,
      prompt: `You are checking an uploaded PDF before a job-interview product lets someone start a voice interview.

Below is the raw text extracted from the PDF. Decide if this is genuinely a résumé/CV (a real person's work history, education, or skills) — not a random document, invoice, article, or corrupted text.

If it IS a résumé, also extract:
- candidateFirstName: their first name if visible in the text, else an empty string
- highlight: one natural sentence a friendly interviewer could say out loud to prove she read it — reference something SPECIFIC and real from the text (an actual role, project, skill, or achievement). Do not write a generic sentence.
- field: their general field/domain in 2-4 words (e.g. "backend engineering", "graphic design", "sales")

If it is NOT a résumé, fill candidateFirstName, highlight, and field with empty strings.

Résumé text:
"""
${safeText}
"""`,
    })

    if (!check.isResume) {
      return {
        statusCode: 200,
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          valid: false,
          reason: "This doesn't look like a résumé — mind uploading your actual CV?",
        }),
      }
    }

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        valid: true,
        resumeText: safeText,
        highlight: check.highlight,
        field: check.field,
        candidateFirstName: check.candidateFirstName || null,
      }),
    }
  } catch (error) {
    console.error('Sera extract resume error:', error)
    return { statusCode: 500, body: JSON.stringify({ error: 'Unable to read that résumé' }) }
  }
}
