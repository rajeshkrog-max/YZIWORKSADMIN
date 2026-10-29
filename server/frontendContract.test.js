// The contract between the browser and the backend: every endpoint the frontend calls
// (found by scanning src/) must have a route in the server. Fails the moment someone adds a
// fetch to a path the backend does not serve. Run: npm test
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { frontendEndpoints } from '../scripts/frontendEndpoints.mjs'
import { matchFormRoute } from './formEndpoints.js'

const serverSource = await fs.readFile(fileURLToPath(new URL('./index.js', import.meta.url)), 'utf8')

test('contract: the scan finds the frontend endpoints', async () => {
  const endpoints = await frontendEndpoints()
  assert.ok(endpoints.length >= 15, `expected the Sera and form endpoints, found ${endpoints.length}`)
})

test('contract: every endpoint the frontend calls is served by the backend', async () => {
  const missing = []
  for (const { path: endpoint, files } of await frontendEndpoints()) {
    const served = matchFormRoute(endpoint) !== null || serverSource.includes(`pathname === '${endpoint}'`)
    if (!served) missing.push(`${endpoint} (called from ${files.join(', ')})`)
  }
  assert.deepEqual(missing, [], 'the frontend calls endpoints the backend does not serve')
})
