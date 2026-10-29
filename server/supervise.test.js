// Watchdog drills (spec 0001: AC-1, AC-3, AC-4, AC-5, AC-6, AC-14) against a small fake server, with the
// timings shrunk so each drill takes seconds. No network beyond 127.0.0.1, no secrets. Run: npm test
import test from 'node:test'
import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import http from 'node:http'
import { spawn } from 'node:child_process'
import { backoffDelay, exitReason, parseEnv, procSnapshot, createSupervisor } from './supervise.mjs'

const SECRET = 'watchdog-test-secret-value'
const FAST = {
  healthIntervalMs: 150,
  healthTimeoutMs: 250,
  failLimit: 3,
  graceMs: 2500,
  startupPollMs: 60,
  stableMs: 1200,
  beatMs: 80,
  tickMs: 30,
  killGraceMs: 250,
  stopGraceMs: 1500,
  backoffMs: [100, 200, 400, 800, 1500],
}

// Behaviour is switched by files in FAKE_CTRL so a drill can change it while the server runs.
const FAKE_SERVER = `
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
const ctrl = process.env.FAKE_CTRL
const has = (n) => fs.existsSync(path.join(ctrl, n))
const eat = (n) => { try { fs.unlinkSync(path.join(ctrl, n)) } catch {} }
fs.appendFileSync(path.join(ctrl, 'starts'), process.pid + '\\n')
if (has('exit-at-start')) process.exit(3)
http.createServer((req, res) => {
  if (req.url === '/api/sera/admin/restart' && req.method === 'POST') {
    if (req.headers.authorization !== 'Bearer ' + process.env.VAPI_WEBHOOK_SECRET) { res.writeHead(401); return res.end('{}') }
    res.end('{"restarting":true}')
    return void setTimeout(() => process.exit(0), 50)
  }
  if (has('hang')) return // never answers: a server that is up but stuck
  const reply = () => { res.writeHead(200, { 'content-type': 'application/json' }); res.end('{"ok":true,"build":"fake"}') }
  if (has('slow')) return void setTimeout(reply, 120)
  reply()
}).on('error', () => { /* port taken: stay alive but never answer, like a stuck server */ }).listen(Number(process.env.SERA_PORT), '127.0.0.1', () => { eat('hang') })
setInterval(() => {}, 1000)
`

// 50000-59999: kept apart from the 41000-48999 range the other server tests pick from, so they cannot collide
const freePort = () => 50000 + Math.floor(Math.random() * 10000)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function until(fn, ms, label) {
  const end = Date.now() + ms
  while (Date.now() < end) {
    const v = await fn()
    if (v) return v
    await sleep(25)
  }
  assert.fail(`timed out waiting for ${label}`)
}
const get = (port, p = '/health') =>
  new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port, path: p, timeout: 400 }, (res) => {
      let t = ''
      res.on('data', (c) => (t += c))
      res.on('end', () => resolve(res.statusCode === 200 && t.includes('"ok":true')))
    })
    req.on('timeout', () => req.destroy())
    req.on('error', () => resolve(false))
  })

async function rig(extra = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sera-wd-'))
  const ctrl = path.join(root, 'ctrl')
  await fs.mkdir(ctrl)
  const serverPort = freePort()
  await fs.writeFile(path.join(root, 'fake-server.mjs'), FAKE_SERVER)
  await fs.writeFile(path.join(root, '.env'), `VAPI_WEBHOOK_SECRET=${SECRET}\nFAKE_CTRL=${ctrl}\n`)
  await fs.writeFile(path.join(root, 'BUILD'), 'testbuild-1\n')
  const sup = createSupervisor({
    root,
    entry: path.join(root, 'fake-server.mjs'),
    nodeBin: process.execPath,
    serverPort,
    watchdogPort: freePort(),
    ...FAST,
    ...extra,
  })
  const done = sup.run()
  return {
    root,
    ctrl,
    serverPort,
    sup,
    done,
    log: () => fs.readFile(path.join(root, 'yzi-backend.log'), 'utf8').catch(() => ''),
    starts: async () => (await fs.readFile(path.join(ctrl, 'starts'), 'utf8').catch(() => '')).split('\n').filter(Boolean).map(Number),
    async finish() {
      sup.stop()
      await Promise.race([done, sleep(4000)])
      await fs.rm(root, { recursive: true, force: true })
    },
  }
}

test('backoffDelay grows 1, 2, 4, 8 then stays at 15 seconds', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 50].map((n) => backoffDelay(n)), [1000, 2000, 4000, 8000, 15000, 15000, 15000])
})

test('exitReason names a kill, a signal and a plain exit', () => {
  assert.deepEqual(exitReason({ code: 0, signal: null }), { reason: 'exit', detail: 'code=0' })
  assert.deepEqual(exitReason({ code: null, signal: 'SIGKILL' }), { reason: 'signal', detail: 'signal=SIGKILL' })
  assert.equal(exitReason({ code: null, signal: 'SIGKILL' }, 'health-kill').reason, 'health-kill')
})

test('parseEnv reads KEY=VALUE lines and ignores comments', () => {
  assert.deepEqual(parseEnv('# c\nA=1\n\nB="two words"\nC=\'x\'\nbad line\nD=a=b\n'), { A: '1', B: 'two words', C: 'x', D: 'a=b' })
})

test('procSnapshot keeps only fixed fields from /proc text', () => {
  const out = procSnapshot({
    status: 'Name:\tnode\nState:\tS (sleeping)\nThreads:\t7\nVmRSS:\t  51234 kB\nEnviron:\tSECRET=abc\n',
    stat: '23 (node) S 1 23 23 0 -1 4194560 100 0 0 0 12 5 0 0 20 0 7 0 100 1000 100',
    limits: 'Limit Soft Hard Units\nMax processes            512                  512                  processes\nMax open files            1024                 4096                 files\n',
    wchan: 'futex_wait_queue_me',
    syscall: '202 0x1 0x2',
    loadavg: '0.50 0.40 0.30 1/200 999',
  })
  assert.equal(out, 'state=S threads=7 rss=51234 kB cpu_ticks=17 wchan=futex_wait_queue_me syscall=202 nproc_limit=512 nofile_limit=1024 loadavg=0.50,0.40,0.30')
  assert.ok(!out.includes('SECRET'))
  assert.equal(procSnapshot({}), 'state=? threads=? rss=? cpu_ticks=? wchan=? syscall=? nproc_limit=? nofile_limit=? loadavg=?')
})

test('AC-1 AC-6: a killed Node is started again within seconds and the log says why', async () => {
  const r = await rig()
  try {
    await until(() => get(r.serverPort), 4000, 'first start')
    const [pid] = await r.starts()
    const killedAt = Date.now()
    process.kill(pid, 'SIGKILL')
    await until(async () => (await r.starts()).length >= 2 && (await get(r.serverPort)), 5000, 'restart')
    assert.ok(Date.now() - killedAt < 3000, 'restarted quickly')
    const log = await r.log()
    assert.match(log, /\[watchdog\] build=testbuild-1 start pid=\d+/)
    // Windows reports a killed process as exit code 1 instead of a signal; the host is Linux.
    assert.match(log, process.platform === 'win32' ? /exit reason=(signal|exit) /: /exit reason=signal signal=SIGKILL/)
    assert.match(log, /^\d{4}-\d\d-\d\dT[\d:.]+Z /m, 'UTC timestamps')
  } finally {
    await r.finish()
  }
})

test('AC-3: a Node that is up but not answering is replaced; a slow one that answers is not', async () => {
  const r = await rig()
  try {
    await until(() => get(r.serverPort), 4000, 'first start')
    await fs.writeFile(path.join(r.ctrl, 'slow'), '')
    await sleep(1500) // many health checks while slow but answering
    assert.equal((await r.starts()).length, 1, 'a busy but answering Node is never killed')
    await fs.unlink(path.join(r.ctrl, 'slow'))

    await fs.writeFile(path.join(r.ctrl, 'hang'), '')
    await until(async () => (await r.starts()).length >= 2, 5000, 'replacement of a hung Node')
    await until(() => get(r.serverPort), 4000, 'healthy again')
    assert.match(await r.log(), /exit reason=health-kill/)
  } finally {
    await r.finish()
  }
})

test('AC-3: a Node that never answers during the startup grace is replaced (startup-timeout)', async () => {
  const r = await rig({ graceMs: 600 })
  try {
    // Another listener holds the port, so the fake cannot answer: it starts, but never becomes healthy.
    const squatter = http.createServer((_, res) => res.end('nope')).listen(r.serverPort, '127.0.0.1')
    await new Promise((resolve) => squatter.once('listening', resolve))
    await until(async () => /exit reason=startup-timeout/.test(await r.log()), 6000, 'startup-timeout')
    squatter.close()
  } finally {
    await r.finish()
  }
})

test('AC-5: a Node that exits straight after starting is retried with a growing delay', async () => {
  const r = await rig()
  try {
    await fs.writeFile(path.join(r.ctrl, 'exit-at-start'), '')
    await until(async () => (await r.starts()).length >= 4, 6000, 'four attempts')
    const waits = [...(await r.log()).matchAll(/backoff wait=([\d.]+)s/g)].map((m) => Number(m[1]))
    assert.deepEqual(waits.slice(0, 3), [0.1, 0.2, 0.4])
    assert.match(await r.log(), /exit reason=exit code=3/)
  } finally {
    await r.finish()
  }
})

test('AC-5: a stable run resets the delay', async () => {
  const r = await rig({ stableMs: 400 })
  try {
    await until(() => get(r.serverPort), 4000, 'first start')
    await sleep(700) // healthy longer than stableMs
    process.kill((await r.starts())[0], 'SIGKILL')
    await until(async () => /backoff wait=0\.1s/.test(await r.log()), 3000, 'first step of the backoff again')
  } finally {
    await r.finish()
  }
})

test('AC-4: two watchdogs on one lock port leave one Node', async () => {
  const watchdogPort = freePort()
  const r = await rig({ watchdogPort })
  try {
    await until(() => get(r.serverPort), 4000, 'first start')
    const other = createSupervisor({ root: r.root, entry: path.join(r.root, 'fake-server.mjs'), nodeBin: process.execPath, serverPort: r.serverPort, watchdogPort, ...FAST })
    assert.equal((await other.run()).reason, 'already-running')
    await sleep(300)
    assert.equal((await r.starts()).length, 1)
  } finally {
    await r.finish()
  }
})

test('AC-4: a Node left over from a dead watchdog is asked to exit and replaced, not looped on "port in use"', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sera-wd-left-'))
  const ctrl = path.join(root, 'ctrl')
  await fs.mkdir(ctrl)
  const port = freePort()
  await fs.writeFile(path.join(root, 'fake-server.mjs'), FAKE_SERVER)
  await fs.writeFile(path.join(root, '.env'), `VAPI_WEBHOOK_SECRET=${SECRET}\nFAKE_CTRL=${ctrl}\n`)
  const leftover = spawn(process.execPath, [path.join(root, 'fake-server.mjs')], {
    env: { ...process.env, SERA_PORT: String(port), FAKE_CTRL: ctrl, VAPI_WEBHOOK_SECRET: SECRET },
    stdio: 'ignore',
  })
  const leftoverGone = new Promise((resolve) => leftover.once('exit', resolve))
  await until(() => get(port), 4000, 'leftover answering')
  const sup = createSupervisor({ root, entry: path.join(root, 'fake-server.mjs'), nodeBin: process.execPath, serverPort: port, watchdogPort: freePort(), ...FAST })
  const done = sup.run()
  try {
    await leftoverGone
    await until(async () => (await fs.readFile(path.join(ctrl, 'starts'), 'utf8')).split('\n').filter(Boolean).length >= 2, 6000, 'a new Node of the watchdog')
    await until(() => get(port), 4000, 'healthy under the watchdog')
    assert.match(await fs.readFile(path.join(root, 'yzi-backend.log'), 'utf8'), /leftover-node asking it to exit/)
  } finally {
    leftover.kill()
    sup.stop()
    await Promise.race([done, sleep(4000)])
    await fs.rm(root, { recursive: true, force: true })
  }
})

test('AC-12: the Node binary comes from run/config at each start, and a missing one falls back', async () => {
  const r = await rig({ nodeBin: undefined })
  try {
    await until(() => get(r.serverPort), 4000, 'first start')
    assert.match(await r.log(), /start pid=\d+ node=.*node/)
    await fs.mkdir(path.join(r.root, 'run'), { recursive: true })
    await fs.writeFile(path.join(r.root, 'run', 'config'), 'NODE_BIN=/no/such/node\n')
    process.kill((await r.starts())[0], 'SIGKILL')
    await until(async () => (await r.starts()).length >= 2 && (await get(r.serverPort)), 5000, 'restart on the fallback Node')
    assert.match(await r.log(), /node-unusable path=\/no\/such\/node/)
  } finally {
    await r.finish()
  }
})

test('AC-14: run/stop stops Node and the watchdog, and nothing returns while it exists', async () => {
  const r = await rig()
  try {
    await until(() => get(r.serverPort), 4000, 'first start')
    await fs.mkdir(path.join(r.root, 'run'), { recursive: true })
    await fs.writeFile(path.join(r.root, 'run', 'stop'), '')
    const result = await Promise.race([r.done, sleep(5000).then(() => 'timeout')])
    assert.equal(result.reason, 'stopped')
    assert.equal(await get(r.serverPort), false, 'Node is gone')
    await sleep(500)
    assert.equal((await r.starts()).length, 1, 'nothing started again')
    assert.match(await r.log(), /watchdog-stop reason=stop-file/)
  } finally {
    await r.finish()
  }
})

test('the watchdog keeps a beat file fresh for cron to read', async () => {
  const r = await rig()
  try {
    await until(() => existsSync(path.join(r.root, 'run', 'watchdog.beat')), 2000, 'beat file')
    const first = (await fs.stat(path.join(r.root, 'run', 'watchdog.beat'))).mtimeMs
    await sleep(300)
    assert.ok((await fs.stat(path.join(r.root, 'run', 'watchdog.beat'))).mtimeMs > first)
  } finally {
    await r.finish()
  }
})

test('AC-6: the watchdog log never contains the secret from .env', async () => {
  const r = await rig()
  try {
    await until(() => get(r.serverPort), 4000, 'first start')
    process.kill((await r.starts())[0], 'SIGKILL')
    await until(async () => (await r.starts()).length >= 2, 4000, 'restart')
    assert.ok(!(await r.log()).includes(SECRET))
  } finally {
    await r.finish()
  }
})
