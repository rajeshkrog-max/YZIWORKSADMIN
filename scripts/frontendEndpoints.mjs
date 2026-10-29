// Every backend endpoint the frontend calls, found by reading src/. Shared by the contract test
// (server/frontendContract.test.js) and the live smoke check (scripts/smoke-live.mjs), so the
// browser and the backend cannot drift apart unnoticed.
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ENDPOINT = /['"`](\/api\/[A-Za-z0-9/_-]+|\/\.netlify\/functions\/[A-Za-z0-9-]+)['"`]/g

async function* sourceFiles(dir) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) yield* sourceFiles(full)
    else if (/\.(js|jsx)$/.test(entry.name)) yield full
  }
}

// → [{ path, files: ['src/services/seraAuthService.js', ...] }], sorted by path.
export async function frontendEndpoints() {
  const found = new Map()
  for await (const file of sourceFiles(path.join(root, 'src'))) {
    const text = await fs.readFile(file, 'utf8')
    for (const [, endpoint] of text.matchAll(ENDPOINT)) {
      const rel = path.relative(root, file).split(path.sep).join('/')
      found.set(endpoint, [...new Set([...(found.get(endpoint) ?? []), rel])])
    }
  }
  return [...found].map(([p, files]) => ({ path: p, files })).sort((a, b) => a.path.localeCompare(b.path))
}
