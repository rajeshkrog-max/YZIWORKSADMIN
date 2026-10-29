// File uploads for the Early Builder / Early Partner application forms.
//
// The forms ask for upload URLs and then PUT each file to the URL they were given. The old URLs
// pointed straight at a Cloudflare R2 bucket, which needs bucket CORS and a bucket this account
// no longer has. These URLs point back at this server instead (same origin, no CORS): the server
// checks a signature it issued, then stores the file in the configured R2 bucket. The forms do
// not change.
import crypto from 'node:crypto'
import { PutObjectCommand } from '@aws-sdk/client-s3'

export const UPLOAD_PATH = '/.netlify/functions/r2-upload'
export const MAX_FILES = 5
export const MAX_TOTAL_SIZE = 20 * 1024 * 1024
export const URL_LIFETIME_MS = 15 * 60 * 1000

const FOLDERS = { builder: 'applications/builders', partner: 'applications/partners' }

const sign = (secret, key, exp, size, contentType) =>
  crypto.createHmac('sha256', secret).update(`application-upload|${key}|${exp}|${size}|${contentType}`).digest('hex')

// The file's real type is kept in the signed link and applied when it is stored. The browser sends the
// bytes as application/octet-stream, because the host's firewall refuses application/pdf and msword uploads.
const cleanContentType = (value) => (/^[\w.+-]{1,60}\/[\w.+-]{1,100}$/.test(value) ? value : 'application/octet-stream')

function safeFilename(filename) {
  const parts = String(filename).split('.')
  const extension = parts.length > 1 ? parts.pop().toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10) : ''
  return extension ? `${crypto.randomUUID()}.${extension}` : crypto.randomUUID()
}

// Request: { files: [{ filename, contentType, size }], applicationType: 'builder' | 'partner' }
// → { status, body }; body.uploads[i].uploadUrl is a signed URL on this server.
export function prepareUploads(request, { secret, now = Date.now() }) {
  const { files, applicationType } = request ?? {}
  const bad = (error) => ({ status: 400, body: { error } })

  if (!Array.isArray(files) || !applicationType) return bad('files and applicationType are required')
  if (!Object.hasOwn(FOLDERS, applicationType)) return bad('Invalid application type')
  if (files.length < 1 || files.length > MAX_FILES) return bad(`You can upload between 1 and ${MAX_FILES} files`)

  const valid = files.every(
    (file) =>
      file &&
      typeof file.filename === 'string' && file.filename.trim() &&
      typeof file.contentType === 'string' &&
      Number.isInteger(file.size) && file.size > 0,
  )
  if (!valid) return bad('Invalid file information')

  const total = files.reduce((sum, file) => sum + file.size, 0)
  if (total > MAX_TOTAL_SIZE) return bad('Total file size must be 20 MB or smaller')

  const exp = now + URL_LIFETIME_MS
  const uploads = files.map((file) => {
    const objectKey = `${FOLDERS[applicationType]}/${crypto.randomUUID()}/${safeFilename(file.filename)}`
    const contentType = cleanContentType(file.contentType)
    const query = new URLSearchParams({ key: objectKey, exp: String(exp), size: String(file.size), ct: contentType, sig: sign(secret, objectKey, exp, file.size, contentType) })
    return {
      uploadUrl: `${UPLOAD_PATH}?${query}`,
      objectKey,
      originalFilename: file.filename,
      contentType: file.contentType,
      size: file.size,
    }
  })
  return { status: 200, body: { success: true, uploads, expiresIn: Math.round(URL_LIFETIME_MS / 1000) } }
}

// Checks the signature on an upload request's query string.
// → { ok: true, key, size, contentType } | { ok: false, status, error }
export function authorizeUpload(searchParams, { secret, now = Date.now() }) {
  const key = searchParams.get('key') ?? ''
  const exp = Number(searchParams.get('exp'))
  const size = Number(searchParams.get('size'))
  const sig = searchParams.get('sig') ?? ''
  const contentType = searchParams.get('ct') ?? ''

  if (!key || !Number.isFinite(exp) || !Number.isInteger(size) || size <= 0 || size > MAX_TOTAL_SIZE) {
    return { ok: false, status: 403, error: 'Invalid upload link' }
  }
  const expected = Buffer.from(sign(secret, key, exp, size, contentType), 'hex')
  const given = Buffer.from(sig, 'hex')
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) {
    return { ok: false, status: 403, error: 'Invalid upload link' }
  }
  if (now > exp) return { ok: false, status: 403, error: 'This upload link has expired. Please try again.' }
  return { ok: true, key, size, contentType: cleanContentType(contentType) }
}

export async function storeUpload({ s3, bucket, key, buffer, contentType }) {
  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: buffer, ContentType: contentType || 'application/octet-stream' }))
}
