// Re-renders the PDF of every finished report from its stored report JSON and
// overwrites the same R2 object, so reports built before a PDF layout change
// pick it up. No language model call: only the PDF render runs again.
//
// Run on the backend host, from the app directory, after deploying:
//   node scripts/rerender-report-pdfs.mjs           # dry run: counts only
//   node scripts/rerender-report-pdfs.mjs --apply   # re-render and upload
// Prints counts only, never names, emails or report contents.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const apply = process.argv.includes('--apply')

// Same .env rules as server/index.js: the real environment wins.
const envFile = path.join(root, '.env')
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const trimmed = line.trim()
    const eq = trimmed.indexOf('=')
    if (!trimmed || trimmed.startsWith('#') || eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
    if (val && process.env[key] === undefined) process.env[key] = val
  }
}

// Imported after the .env is read: the store resolves its data dir on load.
const { listSessions } = await import('../server/store.js')
const { renderReportPdfOnServer } = await import('../netlify/lib/seraReport/pdfAssets.node.js')

const sessions = (await listSessions()).filter((s) => s.report && s.reportPdfKey)
console.log(`${sessions.length} report PDF(s) to re-render${apply ? '' : ' (dry run, add --apply to upload)'}`)
if (!apply || !sessions.length) process.exit(0)

const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env
if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
  console.error('R2 environment variables are not configured')
  process.exit(1)
}
const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT || `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
})
const bucket = process.env.R2_BUCKET_NAME || 'yzi-application-files'

let done = 0
let failed = 0
for (const session of sessions) {
  try {
    const pdfBytes = await renderReportPdfOnServer(session.report)
    await s3.send(new PutObjectCommand({ Bucket: bucket, Key: session.reportPdfKey, Body: Buffer.from(pdfBytes), ContentType: 'application/pdf' }))
    done++
  } catch (err) {
    failed++
    console.error(`  failed: ${err.message}`)
  }
}
console.log(`re-rendered ${done}, failed ${failed}`)
process.exit(failed ? 1 : 0)
