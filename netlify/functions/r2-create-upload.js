import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const BUCKET_NAME = 'yzi-application-files'

const MAX_FILES = 5
const MAX_TOTAL_SIZE = 20 * 1024 * 1024

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
  const parts = String(filename).split('.')
  if (parts.length < 2) return ''
  return parts.pop().toLowerCase().replace(/[^a-z0-9]/g, '')
}

function createSafeFilename(filename) {
  const extension = getExtension(filename)

  return extension
    ? `${crypto.randomUUID()}.${extension}`
    : crypto.randomUUID()
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
      files,
      applicationType
    } = body

    if (!Array.isArray(files) || !applicationType) {
      return jsonResponse(400, {
        error: 'files and applicationType are required'
      })
    }

    if (!['builder', 'partner'].includes(applicationType)) {
      return jsonResponse(400, {
        error: 'Invalid application type'
      })
    }

    if (files.length < 1 || files.length > MAX_FILES) {
      return jsonResponse(400, {
        error: `You can upload between 1 and ${MAX_FILES} files`
      })
    }

    const totalSize = files.reduce((total, file) => {
      return total + (Number.isInteger(file?.size) ? file.size : 0)
    }, 0)

    if (totalSize <= 0 || totalSize > MAX_TOTAL_SIZE) {
      return jsonResponse(400, {
        error: 'Total file size must be 20 MB or smaller'
      })
    }

    for (const file of files) {
      if (
        !file ||
        typeof file.filename !== 'string' ||
        !file.filename.trim() ||
        typeof file.contentType !== 'string' ||
        !Number.isInteger(file.size) ||
        file.size <= 0
      ) {
        return jsonResponse(400, {
          error: 'Invalid file information'
        })
      }
    }

    const folder =
      applicationType === 'builder'
        ? 'applications/builders'
        : 'applications/partners'

    const s3 = getS3Client()

    const uploads = await Promise.all(
      files.map(async (file) => {
        const safeFilename = createSafeFilename(file.filename)

        const objectKey =
          `${folder}/${crypto.randomUUID()}/${safeFilename}`

        const command = new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: objectKey,
          ContentType: file.contentType
        })

        const uploadUrl = await getSignedUrl(s3, command, {
          expiresIn: 300
        })

        return {
          uploadUrl,
          objectKey,
          originalFilename: file.filename,
          contentType: file.contentType,
          size: file.size
        }
      })
    )

    return jsonResponse(200, {
      success: true,
      uploads,
      expiresIn: 300
    })
  } catch (error) {
    console.error('R2 create upload error:', error)

    return jsonResponse(500, {
      error: 'Unable to prepare file uploads'
    })
  }
}