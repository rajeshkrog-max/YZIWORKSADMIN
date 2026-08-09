import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const BUCKET_NAME = 'yzi-application-files'

const MAX_FILE_SIZE = 5 * 1024 * 1024

const ALLOWED_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png'
])

const ALLOWED_EXTENSIONS = new Set([
  'pdf',
  'doc',
  'docx',
  'jpg',
  'jpeg',
  'png'
])

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': 'https://yziworks.netlify.app',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    },
    body: JSON.stringify(body)
  }
}

function getExtension(filename) {
  return filename
    .split('.')
    .pop()
    .toLowerCase()
}

function createSafeFilename(filename) {
  const extension = getExtension(filename)

  return `${crypto.randomUUID()}.${extension}`
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
    credentials: {
      accessKeyId,
      secretAccessKey
    }
  })
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return jsonResponse(204, {})
  }

  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, {
      error: 'Method not allowed'
    })
  }

  try {
    const body = JSON.parse(event.body || '{}')

    const {
      filename,
      contentType,
      size,
      applicationType
    } = body

    if (!filename || !contentType || !size || !applicationType) {
      return jsonResponse(400, {
        error: 'filename, contentType, size and applicationType are required'
      })
    }

    if (!['builder', 'partner'].includes(applicationType)) {
      return jsonResponse(400, {
        error: 'Invalid application type'
      })
    }

    if (!Number.isInteger(size) || size <= 0 || size > MAX_FILE_SIZE) {
      return jsonResponse(400, {
        error: 'File must be 5 MB or smaller'
      })
    }

    if (!ALLOWED_TYPES.has(contentType)) {
      return jsonResponse(400, {
        error: 'File type is not supported'
      })
    }

    const extension = getExtension(filename)

    if (!ALLOWED_EXTENSIONS.has(extension)) {
      return jsonResponse(400, {
        error: 'File extension is not supported'
      })
    }

    const safeFilename = createSafeFilename(filename)

    const folder =
      applicationType === 'builder'
        ? 'applications/builders'
        : 'applications/partners'

    const objectKey = `${folder}/${crypto.randomUUID()}/${safeFilename}`

    const s3 = getS3Client()

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: objectKey,
      ContentType: contentType
    })

    const uploadUrl = await getSignedUrl(s3, command, {
      expiresIn: 300
    })

    return jsonResponse(200, {
      success: true,
      uploadUrl,
      objectKey,
      expiresIn: 300
    })
  } catch (error) {
    console.error('R2 create upload error:', error)

    return jsonResponse(500, {
      error: 'Unable to prepare file upload'
    })
  }
}