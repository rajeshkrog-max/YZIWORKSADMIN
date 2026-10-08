// The website form endpoints (send-otp, verify-otp, send-contact, r2-create-upload) running on
// the REAL server process. Every case here is decided before any outside call, so no network and
// no real keys are needed. Run: npm test
import test, { after, before } from 'node:test'
import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs/promises'
import http from 'node:http'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { authorizeUpload, prepareUploads } from './applicationUploads.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const SENSITIVE = /^(VAPI_|OPENAI_|R2_|RAZORPAY_|RESEND_|MSG91_|WHATSAPP_|SERA_|RETELL_|NETLIFY_)/
const cleanEnv = () => Object.fromEntries(Object.entries(process.env).filter(([key]) => !SENSITIVE.test(key)))

let dataDir
const apps = []

async function startApp(extraEnv = {}) {
  const port = 41000 + Math.floor(Math.random() * 8000)
  const proc = spawn(process.execPath, [path.join(here, 'index.js')], {
    env: { ...cleanEnv(), SERA_SKIP_DOTENV: '1', SERA_PORT: String(port), SERA_DATA_DIR: dataDir, ...extraEnv },
    stdio: process.env.SERA_TEST_LOGS ? 'inherit' : 'ignore',
  })
  const app = { port, proc }
  apps.push(app)
  for (let i = 0; i < 80; i++) {
    try {
      if ((await fetch(`http://127.0.0.1:${port}/health`)).ok) return app
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 100))
  }
  throw new Error('server did not start')
}

const call = async (app, route, { method = 'POST', body, headers = {} } = {}) => {
  const res = await fetch(`http://127.0.0.1:${app.port}${route}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  })
  const text = await res.text()
  let json = null
  try { json = JSON.parse(text) } catch { /* not json */ }
  return { status: res.status, headers: res.headers, body: json }
}

const FULL_ENV = {
  MSG91_AUTH_KEY: 'test-msg91',
  MSG91_WIDGET_ID: 'test-widget',
  RESEND_API_KEY: 'test-resend',
  R2_ACCOUNT_ID: 'testaccount',
  R2_ACCESS_KEY_ID: 'test-access',
  R2_SECRET_ACCESS_KEY: 'test-secret',
}

let shared
let fakeStorage
const stored = [] // what the fake R2 received: { method, url, bytes }

before(async () => {
  dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sera-forms-'))
  // A fake R2: records every object the server stores, so no real bucket is ever touched.
  fakeStorage = http.createServer((req, res) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => {
      stored.push({ method: req.method, url: req.url, bytes: Buffer.concat(chunks).length, contentType: req.headers['content-type'] })
      res.writeHead(200, { ETag: '"fake"' })
      res.end()
    })
  })
  await new Promise((resolve) => fakeStorage.listen(0, '127.0.0.1', resolve))
  // One server for every case that needs no special setup.
  shared = await startApp({ ...FULL_ENV, R2_ENDPOINT: `http://127.0.0.1:${fakeStorage.address().port}`, R2_BUCKET_NAME: 'test-bucket' })
})

after(async () => {
  fakeStorage.close()
  for (const { proc } of apps) proc.kill()
  await fs.rm(dataDir, { recursive: true, force: true })
})

test('forms: an endpoint whose keys are not configured answers 503, never calls the provider', async () => {
  const app = await startApp()
  for (const name of ['send-otp', 'verify-otp', 'send-contact', 'r2-create-upload']) {
    const res = await call(app, `/.netlify/functions/${name}`, { body: {} })
    assert.equal(res.status, 503, name)
    assert.match(res.body.error, /temporarily unavailable/i)
  }
})

test('forms: unknown names and look alike paths are 404, and only POST is accepted', async () => {
  const app = shared
  assert.equal((await call(app, '/.netlify/functions/sera-start-call2', { body: {} })).status, 404)
  assert.equal((await call(app, '/.netlify/functions/constructor', { body: {} })).status, 404)
  assert.equal((await call(app, '/.netlify/functions/send-contact', { method: 'GET' })).status, 405)
  assert.equal((await call(app, '/.netlify/functions/verify-otp', { method: 'GET' })).status, 405)
})

test('forms: send-contact validates before sending any email', async () => {
  const app = shared
  const valid = { name: 'Asha', email: 'asha@example.com', phone: '9876543210', subject: 'Hello', message: 'Hi' }
  assert.equal((await call(app, '/.netlify/functions/send-contact', { body: { ...valid, name: '' } })).status, 400)
  assert.equal((await call(app, '/.netlify/functions/send-contact', { body: { ...valid, email: 'nope' } })).status, 400)
  assert.equal((await call(app, '/.netlify/functions/send-contact', { body: { ...valid, phone: '12345' } })).status, 400)
  const long = await call(app, '/.netlify/functions/send-contact', { body: { ...valid, message: 'x'.repeat(3001) } })
  assert.equal(long.status, 400)
  assert.match(long.body.error, /too long/i)
})

test('forms: send-otp rejects a bad phone number before calling MSG91', async () => {
  const app = shared
  const res = await call(app, '/.netlify/functions/send-otp', { body: { phone: '12345' } })
  assert.equal(res.status, 400)
  assert.equal(res.body.error, 'Invalid phone number')
})

test('forms: verify-otp (application) needs a known form type and the privacy consent', async () => {
  const app = shared
  const url = '/.netlify/functions/verify-otp'
  assert.equal((await call(app, url, { body: {} })).status, 400)
  assert.equal((await call(app, url, { body: { formType: 'admin', formData: {} } })).status, 400)
  const noConsent = await call(app, url, { body: { formType: 'builder', formData: { consent: false, consentVersion: 'v1' } } })
  assert.equal(noConsent.status, 400)
  assert.match(noConsent.body.error, /consent/i)
  const noTime = await call(app, url, { body: { formType: 'partner', formData: { consent: true, consentVersion: 'v1' } } })
  assert.match(noTime.body.error, /timestamp/i)
})

test('forms: r2-create-upload validates the request and returns signed upload URLs on this server', async () => {
  const app = shared
  const url = '/.netlify/functions/r2-create-upload'
  assert.equal((await call(app, url, { body: { files: [], applicationType: 'builder' } })).status, 400)
  assert.equal((await call(app, url, { body: { files: [{ filename: 'a.pdf', contentType: 'application/pdf', size: 10 }], applicationType: 'other' } })).status, 400)
  const tooBig = await call(app, url, { body: { files: [{ filename: 'a.pdf', contentType: 'application/pdf', size: 21 * 1024 * 1024 }], applicationType: 'builder' } })
  assert.equal(tooBig.status, 400)

  const ok = await call(app, url, { body: { files: [{ filename: 'My CV.PDF', contentType: 'application/pdf', size: 2048 }], applicationType: 'partner' } })
  assert.equal(ok.status, 200)
  assert.equal(ok.body.success, true)
  assert.equal(ok.body.uploads.length, 1)
  assert.match(ok.body.uploads[0].objectKey, /^applications\/partners\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.pdf$/)
  assert.match(ok.body.uploads[0].uploadUrl, /^\/\.netlify\/functions\/r2-upload\?key=/, 'the browser uploads to this server, not to R2')
})

const put = (app, uploadUrl, body, headers = {}) =>
  fetch(`http://127.0.0.1:${app.port}${uploadUrl}`, { method: 'PUT', headers: { 'Content-Type': 'application/octet-stream', ...headers }, body })
    .then(async (res) => ({ status: res.status, body: await res.json().catch(() => null) }))

test('uploads: a file sent to its signed URL is stored under the announced key', async () => {
  const file = Buffer.from('%PDF-1.4 test résumé'.repeat(50))
  const prep = await call(shared, '/.netlify/functions/r2-create-upload', { body: { files: [{ filename: 'cv.pdf', contentType: 'application/pdf', size: file.length }], applicationType: 'builder' } })
  const { uploadUrl, objectKey } = prep.body.uploads[0]
  const before = stored.length
  const res = await put(shared, uploadUrl, file)
  assert.equal(res.status, 200)
  assert.equal(res.body.success, true)
  const seen = stored.at(-1)
  assert.equal(stored.length, before + 1)
  assert.equal(seen.method, 'PUT')
  assert.ok(seen.url.includes('test-bucket') && seen.url.includes(objectKey.split('/')[2]), `stored in the configured bucket under the announced key (${seen.url})`)
  assert.ok(seen.bytes >= file.length)
  assert.equal(seen.contentType, 'application/pdf', 'stored under its real type even though the browser sent octet-stream')
})

test('uploads: a changed link, a wrong size or a file larger than announced is refused and nothing is stored', async () => {
  const file = Buffer.from('%PDF-1.4 small')
  const prep = await call(shared, '/.netlify/functions/r2-create-upload', { body: { files: [{ filename: 'cv.pdf', contentType: 'application/pdf', size: file.length }], applicationType: 'builder' } })
  const { uploadUrl } = prep.body.uploads[0]
  const before = stored.length

  const tampered = uploadUrl.replace(/sig=[0-9a-f]/, 'sig=0')
  assert.equal((await put(shared, uploadUrl.replace('ct=application%2Fpdf', 'ct=text%2Fhtml'), file)).status, 403, 'the stored type cannot be changed')
  assert.equal((await put(shared, tampered, file)).status, 403)
  const otherKey = uploadUrl.replace('applications%2Fbuilders', 'applications%2Fpartners')
  assert.equal((await put(shared, otherKey, file)).status, 403)
  assert.equal((await put(shared, '/.netlify/functions/r2-upload', file)).status, 403, 'no signature at all')
  assert.equal((await put(shared, uploadUrl, Buffer.from('%PDF-1.4 sma'))).status, 400, 'fewer bytes than announced')
  assert.equal((await put(shared, uploadUrl, Buffer.concat([file, Buffer.alloc(500)]))).status, 413, 'more bytes than announced')
  assert.equal(stored.length, before)
})

test('uploads: links expire and are tied to the secret', () => {
  const secret = 'test-secret'
  const request = { files: [{ filename: 'a.pdf', contentType: 'application/pdf', size: 100 }], applicationType: 'partner' }
  const { body } = prepareUploads(request, { secret, now: 1_000_000 })
  const params = new URL(body.uploads[0].uploadUrl, 'http://x').searchParams
  assert.equal(authorizeUpload(params, { secret, now: 1_000_001 }).ok, true)
  const late = authorizeUpload(params, { secret, now: 1_000_000 + 16 * 60 * 1000 })
  assert.equal(late.ok, false)
  assert.match(late.error, /expired/)
  assert.equal(authorizeUpload(params, { secret: 'another-secret', now: 1_000_001 }).ok, false)
})

test('forms: /api/forms/<name> is an alias of the Netlify path', async () => {
  const app = shared
  const res = await call(app, '/api/forms/send-otp', { body: { phone: '1' } })
  assert.equal(res.status, 400)
  assert.equal(res.body.error, 'Invalid phone number')
})

test('forms: the per client rate limit answers 429 with Retry-After', async () => {
  const app = await startApp(FULL_ENV)
  let last
  for (let i = 0; i < 7; i++) last = await call(app, '/.netlify/functions/send-otp', { body: { phone: '1' } })
  assert.equal(last.status, 429)
  assert.ok(Number(last.headers.get('retry-after')) > 0)
})

test('cors: only the site origins are echoed back, never a wildcard', async () => {
  const app = shared
  const ok = await call(app, '/health', { method: 'GET', headers: { Origin: 'https://yziworks.com' } })
  assert.equal(ok.headers.get('access-control-allow-origin'), 'https://yziworks.com')
  const other = await call(app, '/health', { method: 'GET', headers: { Origin: 'https://evil.example' } })
  assert.equal(other.headers.get('access-control-allow-origin'), null)
  const none = await call(app, '/health', { method: 'GET' })
  assert.equal(none.headers.get('access-control-allow-origin'), null)
  const form = await call(app, '/.netlify/functions/send-otp', { body: { phone: '1' }, headers: { Origin: 'https://evil.example' } })
  assert.equal(form.headers.get('access-control-allow-origin'), null)
})

test('body limit: an oversized request is refused with 413 and the server stays up', async () => {
  const app = await startApp({ ...FULL_ENV, SERA_MAX_BODY_BYTES: '1024' })
  const res = await call(app, '/.netlify/functions/send-contact', { body: 'x'.repeat(4096) })
  assert.equal(res.status, 413)
  assert.equal((await call(app, '/health', { method: 'GET' })).status, 200)
})
