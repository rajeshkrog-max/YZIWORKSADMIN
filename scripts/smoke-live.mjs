// Checks a running site against what the frontend needs. Usage:
//   node scripts/smoke-live.mjs [baseUrl] [--dist]      (default https://yziworks.com)
// 1. every endpoint the frontend calls answers with something other than "not found"
//    (an empty POST is rejected by validation, which is exactly what proves the route exists);
// 2. with --dist, the live index.html loads the same JS and CSS files as the local dist/ build.
// Exits 1 on any failure, so a deploy script can stop on it.
import fs from 'node:fs/promises'
import { frontendEndpoints } from './frontendEndpoints.mjs'

const args = process.argv.slice(2)
const base = (args.find((a) => /^https?:/.test(a)) ?? 'https://yziworks.com').replace(/\/$/, '')
const checkDist = args.includes('--dist')
let failures = 0
const fail = (message) => { failures++; console.log(`  FAIL  ${message}`) }
const pass = (message) => console.log(`  ok    ${message}`)

console.log(`Endpoints the frontend calls, against ${base}`)
for (const { path, files } of await frontendEndpoints()) {
  try {
    const res = await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(20000) })
    const type = res.headers.get('content-type') ?? ''
    const text = await res.text()
    if (type.includes('text/html')) fail(`${path} returned a web page (HTTP ${res.status}), so the route is not reaching the backend`)
    else if (res.status === 404 && /Endpoint not found/.test(text)) fail(`${path} is not implemented by the backend (used by ${files.join(', ')})`)
    else if (res.status >= 500 && res.status !== 503) fail(`${path} answered HTTP ${res.status}`)
    else pass(`${path} -> HTTP ${res.status}${res.status === 503 ? ' (not configured on the server yet)' : ''}`)
  } catch (err) {
    fail(`${path} could not be reached: ${err.message}`)
  }
}

// Endpoints the server hands to the browser itself (so no source file names them). An unsigned
// request must be refused (403), which also proves a PUT survives Apache all the way to the backend.
console.log('Endpoints the backend gives the browser')
try {
  const res = await fetch(base + '/.netlify/functions/r2-upload', { method: 'PUT', headers: { 'Content-Type': 'application/octet-stream' }, body: '%PDF-', signal: AbortSignal.timeout(20000) })
  if (res.status === 403) pass('PUT /.netlify/functions/r2-upload without a signature -> HTTP 403')
  else fail(`PUT /.netlify/functions/r2-upload answered HTTP ${res.status}, expected 403 (the application file upload would fail)`)
} catch (err) {
  fail(`PUT /.netlify/functions/r2-upload could not be reached: ${err.message}`)
}

try {
  const res = await fetch(base + '/api/sera/admin/restart', { method: 'POST', signal: AbortSignal.timeout(20000) })
  if (res.status === 401) pass('POST /api/sera/admin/restart without the credential -> HTTP 401')
  else fail(`POST /api/sera/admin/restart answered HTTP ${res.status}, expected 401 (the deploy could not restart the server)`)
} catch (err) {
  fail(`POST /api/sera/admin/restart could not be reached: ${err.message}`)
}

if (checkDist) {
  console.log('Frontend files')
  const assets = (html) => [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]).sort()
  try {
    const local = assets(await fs.readFile(new URL('../dist/index.html', import.meta.url), 'utf8'))
    const live = assets(await (await fetch(base + '/', { signal: AbortSignal.timeout(20000) })).text())
    if (JSON.stringify(local) === JSON.stringify(live)) pass(`live index.html loads the same ${local.length} files as dist/`)
    else fail(`live index.html differs from dist/ (live: ${live.join(', ')}; local: ${local.join(', ')})`)
    for (const asset of local) {
      const res = await fetch(base + asset, { method: 'HEAD', signal: AbortSignal.timeout(20000) })
      if (res.ok) pass(`${asset} -> HTTP ${res.status}`)
      else fail(`${asset} -> HTTP ${res.status}`)
    }
  } catch (err) {
    fail(`could not compare the frontend: ${err.message}`)
  }
}

console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed')
process.exit(failures ? 1 : 0)
