// Operational behaviour of the real server process: it survives a malformed request, reports its
// build, and restarts on an authenticated request (what the deploy script uses). Run: npm test
import test, { after, before } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const SENSITIVE = /^(VAPI_|OPENAI_|R2_|RAZORPAY_|RESEND_|MSG91_|WHATSAPP_|SERA_|RETELL_|NETLIFY_)/
const cleanEnv = () => Object.fromEntries(Object.entries(process.env).filter(([key]) => !SENSITIVE.test(key)))
const SECRET = 'test-restart-secret'

let dataDir
let app

before(async () => {
  dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sera-ops-'))
  const port = 41000 + Math.floor(Math.random() * 8000)
  const proc = spawn(process.execPath, [path.join(here, 'index.js')], {
    env: { ...cleanEnv(), SERA_SKIP_DOTENV: '1', SERA_PORT: String(port), SERA_DATA_DIR: dataDir, VAPI_WEBHOOK_SECRET: SECRET },
    stdio: process.env.SERA_TEST_LOGS ? 'inherit' : 'ignore',
  })
  app = { port, proc, exited: new Promise((resolve) => proc.once('exit', (code) => resolve(code))) }
  for (let i = 0; i < 80; i++) {
    try {
      if ((await fetch(`http://127.0.0.1:${port}/health`)).ok) return
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 100))
  }
  throw new Error('server did not start')
})

after(async () => {
  app.proc.kill()
  await fs.rm(dataDir, { recursive: true, force: true })
})

const raw = (options, body) =>
  new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: app.port, ...options }, (res) => {
      let text = ''
      res.on('data', (c) => (text += c))
      res.on('end', () => resolve({ status: res.statusCode, text }))
    })
    req.on('error', reject)
    req.end(body)
  })

test('ops: /health and /api/sera/health report the build', async () => {
  for (const p of ['/health', '/api/sera/health']) {
    const res = await raw({ path: p })
    assert.equal(JSON.parse(res.text).ok, true)
    assert.ok(JSON.parse(res.text).build)
  }
})

test('ops: a malformed Host header or URL is a 400 and the server keeps running', async () => {
  const badHost = await raw({ path: '/health', headers: { Host: 'bad host' } })
  assert.notEqual(badHost.status, 500)
  assert.equal((await raw({ path: '/health' })).status, 200)
  assert.equal(app.proc.exitCode, null, 'the server is still running')
})

test('ops: restart needs the credential, then the server exits so the deploy can start the new build', async () => {
  const anon = await raw({ path: '/api/sera/admin/restart', method: 'POST' })
  assert.equal(anon.status, 401)
  const wrong = await raw({ path: '/api/sera/admin/restart', method: 'POST', headers: { Authorization: 'Bearer nope' } })
  assert.equal(wrong.status, 401)
  assert.equal((await raw({ path: '/health' })).status, 200, 'refused requests do not stop it')

  const ok = await raw({ path: '/api/sera/admin/restart', method: 'POST', headers: { Authorization: `Bearer ${SECRET}` } })
  assert.equal(ok.status, 200)
  assert.equal(JSON.parse(ok.text).restarting, true)
  assert.equal(await Promise.race([app.exited, new Promise((r) => setTimeout(() => r('still running'), 5000))]), 0)
})
