// Graceful stop (spec 0001, AC-5/AC-6/AC-10). A real http server, a fake exit. Run: npm test
import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { EventEmitter } from 'node:events'
import { createShutdown, installProcessHandlers } from './shutdown.js'

const listen = (handler) =>
  new Promise((resolve) => {
    const server = http.createServer(handler)
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }))
  })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

test('shutdown lets a request in progress finish, then exits with code 0', async () => {
  const { server, port } = await listen((req, res) => setTimeout(() => res.end('done'), 300))
  const exits = []
  const s = createShutdown({ server, exit: (c) => exits.push(c), log: () => {}, pollMs: 20 })
  const reply = new Promise((resolve) => http.get({ port, host: '127.0.0.1' }, (res) => { let t = ''; res.on('data', (c) => (t += c)); res.on('end', () => resolve(t)) }))
  await sleep(100)
  assert.equal(s.inFlight(), 1)
  const stopped = s.shutdown('test')
  await sleep(50)
  assert.deepEqual(exits, [], 'not exited while a request is running')
  assert.equal(await reply, 'done', 'the request in progress got its answer')
  await stopped
  assert.deepEqual(exits, [0])
  assert.equal(s.isStopping(), true)
})

test('shutdown waits for background work (a report) and no longer than the limit', async () => {
  const { server } = await listen((req, res) => res.end('ok'))
  let busy = true
  const exits = []
  const s = createShutdown({ server, isBusy: () => busy, exit: (c) => exits.push(c), log: () => {}, pollMs: 10, timeoutMs: 400 })
  setTimeout(() => (busy = false), 150)
  const t0 = Date.now()
  await s.shutdown('test')
  assert.ok(Date.now() - t0 >= 140 && Date.now() - t0 < 380, 'waited for the work, not for the limit')

  const { server: server2 } = await listen((req, res) => res.end('ok'))
  const logs = []
  const stuck = createShutdown({ server: server2, isBusy: () => true, exit: (c) => exits.push(c), log: (m) => logs.push(m), pollMs: 10, timeoutMs: 120 })
  const t1 = Date.now()
  await stuck.shutdown('test')
  assert.ok(Date.now() - t1 >= 110 && Date.now() - t1 < 400, 'gave up at the limit')
  assert.match(logs.at(-1), /gave up waiting/)
  assert.deepEqual(exits, [0, 0])
})

test('shutdown closes idle keep alive connections so the server can stop', async () => {
  const { server, port } = await listen((req, res) => res.end('ok'))
  const agent = new http.Agent({ keepAlive: true })
  await new Promise((resolve) => http.get({ port, host: '127.0.0.1', agent }, (res) => { res.resume(); res.on('end', resolve) }))
  const exits = []
  const s = createShutdown({ server, exit: (c) => exits.push(c), log: () => {}, pollMs: 10 })
  await s.shutdown('test')
  assert.deepEqual(exits, [0])
  agent.destroy()
})

test('a second stop request does nothing', async () => {
  const { server } = await listen((req, res) => res.end('ok'))
  const exits = []
  const s = createShutdown({ server, exit: (c) => exits.push(c), log: () => {}, pollMs: 10 })
  await Promise.all([s.shutdown('a'), s.shutdown('b')])
  assert.deepEqual(exits, [0])
})

test('signals start a graceful stop; an uncaught exception logs one short line and exits with 1', () => {
  const proc = new EventEmitter()
  const reasons = []
  const logs = []
  const exits = []
  installProcessHandlers({ shutdown: (r) => reasons.push(r), proc, log: (m) => logs.push(m), exit: (c) => exits.push(c) })
  proc.emit('SIGTERM')
  proc.emit('SIGINT')
  assert.deepEqual(reasons, ['SIGTERM', 'SIGINT'])
  const err = Object.assign(new Error('x'.repeat(500)), { code: 'ECONNRESET' })
  err.stack = 'Error: secret path /home/user/.env\n at ...'
  proc.emit('uncaughtException', err)
  assert.deepEqual(exits, [1])
  assert.equal(logs.length, 1)
  assert.ok(logs[0].length < 300 && !logs[0].includes('.env') && logs[0].includes('ECONNRESET'))
})
