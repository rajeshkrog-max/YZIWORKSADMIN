import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const BUCKET_NAME = 'yzi-application-files'
const MAX_SIZE = 10 * 1024 * 1024

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': 'https://yziworks.netlify.app',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
    body: JSON.stringify(body),
  }
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
