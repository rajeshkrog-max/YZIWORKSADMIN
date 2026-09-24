import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const BUCKET_NAME = process.env.R2_BUCKET_NAME || 'yzi-sera-storage'
const MAX_SIZE = 10 * 1024 * 1024

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
    body: JSON.stringify(body),
  }
}

function getS3Client() {
  const accountId = process.env.R2_ACCOUNT_ID || '28a24ac59a3cf4d9eb3f47d741bec429'
  const accessKeyId = process.env.R2_ACCESS_KEY_ID || 'ad51014b2e839d3e83b9bd531f4a1835'
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || '263f026c058249c2f4b6b0c9a73f70d7dd451230c5416ad9eb0d2383dd29a0eb'
  const endpoint = process.env.R2_ENDPOINT || `https://${accountId}.r2.cloudflarestorage.com`

  return new S3Client({
    region: 'auto',
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
  })
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return jsonResponse(204, {})
  }

  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' })
  }

  try {
    const body = JSON.parse(event.body || '{}')
    const { filename, contentType, size } = body

    if (typeof filename !== 'string' || !filename.trim()) {
      return jsonResponse(400, { error: 'filename is required' })
    }

    if (contentType !== 'application/pdf' && !/\.pdf$/i.test(filename)) {
      return jsonResponse(400, { error: 'Only PDF résumés are accepted' })
    }

    if (!Number.isInteger(size) || size <= 0 || size > MAX_SIZE) {
      return jsonResponse(400, { error: 'File must be a PDF up to 10 MB' })
    }

    const s3 = getS3Client()
    const objectKey = `sera-interviews/${crypto.randomUUID()}.pdf`

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: objectKey,
      ContentType: 'application/pdf',
    })

    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 })

    return jsonResponse(200, {
      success: true,
      uploadUrl,
      objectKey,
      expiresIn: 300,
    })
  } catch (error) {
    console.error('Sera create upload error:', error)
    return jsonResponse(500, { error: 'Unable to prepare the upload' })
  }
}
