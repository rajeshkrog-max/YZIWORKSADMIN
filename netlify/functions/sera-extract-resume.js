import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { generateJson } from '../lib/openai.js'

const BUCKET_NAME = 'yzi-application-files'
const MAX_TEXT_LENGTH = 12000

// Every local PDF-parsing path tried here — pdf-parse v2 (DOMMatrix is not
// defined), unpdf (module is not defined), pdfjs-dist legacy build (module
// is not defined inside pdf.mjs itself), pdfjs-dist non-legacy build
// (DOMMatrix is not defined, and pdfjs-dist explicitly warns against using
// it outside a real browser DOM) — has hit a confirmed crash in this exact
// Netlify Lambda runtime (Node 24). All of those libraries wrap pdf.js
// internally, which assumes browser globals (DOMMatrix, Canvas) that don't
// exist here. pdf-parse@1.1.1, the one path that avoids pdf.js entirely,
// was already tested against this project's real résumé file and failed
// separately with "bad XRef entry" — a parsing bug in its old bundled
// pdf.js, unrelated to the runtime issue.
//
// Rather than keep betting on that same failing library class, this sends
// the PDF's raw bytes straight to OpenAI as a file input on the Responses
// API, in the same call that already checks whether it's a résumé. No PDF
// library runs in this function anymore, so none of the above failure
// modes apply. The model is asked to return the résumé's text itself
// (truncated to MAX_TEXT_LENGTH) since nothing here extracts it locally
// any more, and downstream code still expects a resumeText value back.

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
    resumeText: { type: 'string' },
  },
  required: ['isResume', 'reason', 'candidateFirstName', 'highlight', 'field', 'resumeText'],
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

    let check
    try {
      check = await generateJson({
        schema: RESUME_CHECK_SCHEMA,
        file: {
          filename: objectKey.split('/').pop() || 'resume.pdf',
          mimeType: 'application/pdf',
          base64: buffer.toString('base64'),
        },
        prompt: `You are checking an uploaded PDF before a job-interview product lets someone start a voice interview.

Read the attached PDF. Decide if this is genuinely a résumé/CV (a real person's work history, education, or skills) — not a random document, invoice, article, a scanned page with no extractable text, or a corrupted/unreadable file.

If it IS a résumé, also extract:
- candidateFirstName: their first name if visible in the text, else an empty string
- highlight: one natural sentence a friendly interviewer could say out loud to prove she read it — reference something SPECIFIC and real from the text (an actual role, project, skill, or achievement). Do not write a generic sentence.
- field: their general field/domain in 2-4 words (e.g. "backend engineering", "graphic design", "sales")
- resumeText: the résumé's text content, as plain text (up to roughly ${MAX_TEXT_LENGTH} characters)

If it is NOT a résumé, fill candidateFirstName, highlight, field, and resumeText with empty strings, and explain briefly in reason why (e.g. not a résumé, unreadable, no extractable text).`,
      })
    } catch (err) {
      console.error('Sera extract-resume: OpenAI file read failed', {
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

    if (!check.resumeText || check.resumeText.length < 80) {
      return {
        statusCode: 200,
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          valid: false,
          reason: "This PDF doesn't have enough readable text — please upload your actual résumé.",
        }),
      }
    }

    const safeText = check.resumeText.slice(0, MAX_TEXT_LENGTH)

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
