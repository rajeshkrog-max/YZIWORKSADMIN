// Watchdog for the Sera backend (spec 0001). Keeps `server/index.js` running on the host, where nothing
// else will: no root, no systemd, and cron is the only thing that survives a login ending.
//
//   - One watchdog at a time: it binds 127.0.0.1:SERA_WATCHDOG_PORT (default 4006) as its lock.
//   - Starts Node, gives it a startup grace, then calls /health every few seconds. Several failures in a
//     row replace it. A slow but answering Node is never killed.
//   - Restarts after any exit with a growing delay (1, 2, 4, 8, then 15 s), reset after a stable minute.
//   - Touches run/watchdog.beat so cron (server/ensure.sh) can tell the watchdog is alive.
//   - Creating run/stop stops Node and the watchdog, and nothing brings them back until the file is removed.
//
// The log line never carries a secret, a résumé, a transcript or a provider response. Only fixed fields.
import http from 'node:http'
import net from 'node:net'
import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HOUR_MS = 60 * 60 * 1000

export const DEFAULTS = {
  healthIntervalMs: 10_000,
  healthTimeoutMs: 5_000,
  failLimit: 5,
  graceMs: 30_000,
  startupPollMs: 1_000,
  stableMs: 60_000,
  beatMs: 5_000,
  tickMs: 250,
  killGraceMs: 2_000,
  stopGraceMs: 45_000,
  backoffMs: [1_000, 2_000, 4_000, 8_000, 15_000],
  // Cron on this host gives a job tree at most 25 processes and threads (seen as nproc_limit=25 in a stuck
  // Node's snapshot). A default Node uses 11 threads and hangs when it cannot get them, so the server runs
  // with the fewest threads Node allows.
  nodeArgs: ['--v8-pool-size=1'],
  threadPoolSize: '2',
  maxLogBytes: 5 * 1024 * 1024,
}

/** The delay after the nth quick failure in a row (0 based). Stays at the last step. */
export function backoffDelay(attempt, steps = DEFAULTS.backoffMs) {
  return steps[Math.min(Math.max(attempt, 0), steps.length - 1)]
}

/** Why Node stopped: our own kill wins, then a signal, then a plain exit. */
export function exitReason({ code, signal }, killReason) {
  if (killReason) return { reason: killReason, detail: signal ? `signal=${signal}` : `code=${code}` }
  if (signal) return { reason: 'signal', detail: `signal=${signal}` }
  return { reason: 'exit', detail: `code=${code}` }
}

/** KEY=VALUE lines of a .env file. Quotes are stripped, comments and blank lines skipped. */
export function parseEnv(text) {
  const out = {}
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq < 1) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1)
    out[key] = value
  }
  return out
}

/**
 * A few fixed fields about a process that did not become healthy, from /proc text. Never the environment,
 * the command line or any file contents: only numbers and a state word.
 */
export function procSnapshot({ status = '', stat = '', limits = '', wchan = '', syscall = '', loadavg = '' }) {
  const field = (text, name) => (text.match(new RegExp(String.raw`^${name}:\s*(.+)$`, 'm')) || [])[1]?.trim().replace(/\s+/g, ' ')
  const limit = (name) => (limits.match(new RegExp(String.raw`^${name}\s+(\S+)`, 'm')) || [])[1]
  // /proc/<pid>/stat: fields 14 and 15 (after the "(name)") are user and system CPU time in clock ticks.
  const rest = stat.slice(stat.lastIndexOf(')') + 2).split(' ')
  const cpuTicks = rest.length > 13 ? Number(rest[11]) + Number(rest[12]) : null
  const parts = [
    `state=${(field(status, 'State') || '?').split(' ')[0]}`,
    `threads=${field(status, 'Threads') || '?'}`,
    `rss=${field(status, 'VmRSS') || '?'}`,
    `cpu_ticks=${Number.isFinite(cpuTicks) ? cpuTicks : '?'}`,
    `wchan=${wchan.trim() || '?'}`,
    `syscall=${syscall.trim().split(' ')[0] || '?'}`,
    `nproc_limit=${limit('Max processes') || '?'}`,
    `nofile_limit=${limit('Max open files') || '?'}`,
    `loadavg=${loadavg.trim().split(' ').slice(0, 3).join(',') || '?'}`,
  ]
  return parts.join(' ')
}

function request({ port, path: urlPath, method = 'GET', headers, timeoutMs }) {
  return new Promise((resolve) => {
    const req = http.request({ host: '127.0.0.1', port, path: urlPath, method, headers, timeout: timeoutMs }, (res) => {
      let text = ''
      res.on('data', (c) => {
        if (text.length < 2000) text += c
      })
      res.on('end', () => resolve({ status: res.statusCode, text }))
      res.on('error', () => resolve(null))
    })
    req.on('timeout', () => req.destroy())
    req.on('error', () => resolve(null))
    req.end()
  })
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export function createSupervisor(options = {}) {
  const here = path.dirname(fileURLToPath(import.meta.url))
  const root = options.root || path.resolve(here, '..')
  const o = { ...DEFAULTS, ...options }
  const entry = options.entry || path.join(root, 'server', 'index.js')
  const configFile = path.join(root, 'run', 'config')
  const runDir = path.join(root, 'run')
  const stopFile = path.join(runDir, 'stop')
  const beatFile = path.join(runDir, 'watchdog.beat')
  const logFile = options.logFile || path.join(root, 'yzi-backend.log')
  const watchdogPort = Number(options.watchdogPort || process.env.SERA_WATCHDOG_PORT || 4006)

  const lastLogged = new Map()
  let stopping = false
  let lock = null
  let child = null

  const readEnvFile = () => {
    try {
      return parseEnv(fs.readFileSync(path.join(root, '.env'), 'utf8'))
    } catch {
      return {}
    }
  }
  /** Which Node runs the server: run/config (NODE_BIN=...) is read at every start, so switching is one line and a restart. */
  const pickNodeBin = () => {
    let fromConfig
    try {
      fromConfig = fs.readFileSync(configFile, 'utf8').match(/^NODE_BIN=(.+)$/m)?.[1].trim()
    } catch {
      /* no config: use the defaults */
    }
    for (const candidate of [options.nodeBin, fromConfig, process.env.NODE_BIN, process.execPath]) {
      if (!candidate) continue
      try {
        fs.accessSync(candidate, fs.constants.X_OK)
        return candidate
      } catch {
        logOnce(`bad-node-${candidate}`, 'node-unusable', `path=${candidate}`)
      }
    }
    return process.execPath
  }
  const readBuild = () => {
    try {
      return fs.readFileSync(path.join(root, 'BUILD'), 'utf8').trim() || 'dev'
    } catch {
      return 'dev'
    }
  }

  function log(event, fields = '') {
    const line = `${new Date().toISOString()} [watchdog] build=${readBuild()} ${event}${fields ? ` ${fields}` : ''}\n`
    try {
      fs.appendFileSync(logFile, line)
    } catch {
      /* a full disk must not stop the watchdog */
    }
  }
  /** A line that can repeat (a failing health check) is written at most once an hour per key. */
  function logOnce(key, event, fields) {
    const now = Date.now()
    if (now - (lastLogged.get(key) || 0) < HOUR_MS) return
    lastLogged.set(key, now)
    log(event, fields)
  }

  function rotateLog() {
    try {
      if (fs.statSync(logFile).size > o.maxLogBytes) fs.renameSync(logFile, `${logFile}.1`)
    } catch {
      /* no log yet */
    }
  }

  function beat() {
    try {
      fs.writeFileSync(beatFile, `${Date.now()}\n`)
    } catch {
      /* ensure.sh will start another watchdog, which exits on the port lock if this one is alive */
    }
  }

  const stopRequested = () => stopping || fs.existsSync(stopFile)

  function acquireLock() {
    return new Promise((resolve) => {
      const srv = net.createServer()
      srv.once('error', () => resolve(false))
      srv.listen(watchdogPort, '127.0.0.1', () => {
        lock = srv
        resolve(true)
      })
    })
  }

  const serverPort = () => Number(options.serverPort || readEnvFile().SERA_PORT || process.env.SERA_PORT || 4005)
  const health = async (port) => {
    const res = await request({ port, path: '/health', timeoutMs: o.healthTimeoutMs })
    return !!res && res.status === 200 && /"ok"\s*:\s*true/.test(res.text)
  }

  /** A Node left over from a watchdog that died still holds the port. Ask it to exit, never loop on "port in use". */
  async function clearPort(port, env) {
    if (!(await health(port))) return true
    const secret = env.VAPI_WEBHOOK_SECRET
    if (!secret) {
      logOnce('no-secret', 'leftover-node', 'cannot ask it to exit, no VAPI_WEBHOOK_SECRET in .env')
      return false
    }
    log('leftover-node', 'asking it to exit')
    await request({ port, path: '/api/sera/admin/restart', method: 'POST', headers: { Authorization: `Bearer ${secret}` }, timeoutMs: 5_000 })
    for (let i = 0; i < 30 && !stopRequested(); i++) {
      await sleep(500)
      if (!(await health(port))) return true
    }
    logOnce('leftover-stuck', 'leftover-node', 'still answering after the exit request')
    return false
  }

  /** Runs one Node to its end. Resolves with how it ended and how long it was healthy. */
  function runOnce(env, port, nodeBin) {
    return new Promise((resolve) => {
      rotateLog()
      const fd = fs.openSync(logFile, 'a')
      let killReason = null
      let firstOkAt = null
      const startedAt = Date.now()
      let proc
      try {
        proc = spawn(nodeBin, [...o.nodeArgs, entry], {
          cwd: root,
          env: { UV_THREADPOOL_SIZE: o.threadPoolSize, ...process.env, ...env, SERA_PORT: String(port) },
          stdio: ['ignore', fd, fd],
        })
      } catch (err) {
        fs.closeSync(fd)
        log('start-failed', `error=${String(err.code || 'spawn')}`)
        return resolve({ reason: 'start-failed', healthyMs: 0 })
      }
      child = proc
      log('start', `pid=${proc.pid} node=${nodeBin}`)

      let exited = false
      const kill = (reason, graceMs = o.killGraceMs) => {
        if (killReason || exited) return
        killReason = reason
        if (reason === 'startup-timeout' || reason === 'health-kill') {
          // Why it was given up on, while it is still there to look at (Linux only; empty elsewhere).
          const read = (f) => {
            try {
              return fs.readFileSync(f, 'utf8')
            } catch {
              return ''
            }
          }
          const dir = `/proc/${proc.pid}`
          logOnce(
            `snapshot-${reason}`,
            'snapshot',
            `reason=${reason} ${procSnapshot({
              status: read(`${dir}/status`),
              stat: read(`${dir}/stat`),
              limits: read(`${dir}/limits`),
              wchan: read(`${dir}/wchan`),
              syscall: read(`${dir}/syscall`),
              loadavg: read('/proc/loadavg'),
            })}`,
          )
        }
        try {
          proc.kill('SIGTERM')
        } catch {
          /* already gone */
        }
        setTimeout(() => {
          if (!exited) {
            try {
              proc.kill('SIGKILL')
            } catch {
              /* already gone */
            }
          }
        }, graceMs).unref()
      }

      proc.once('error', (err) => {
        if (exited) return
        exited = true
        fs.closeSync(fd)
        child = null
        log('start-failed', `error=${String(err.code || 'spawn')}`)
        resolve({ reason: 'start-failed', healthyMs: 0 })
      })
      proc.once('exit', (code, signal) => {
        if (exited) return
        exited = true
        fs.closeSync(fd)
        child = null
        const { reason, detail } = exitReason({ code, signal }, killReason)
        const healthyMs = firstOkAt ? Date.now() - firstOkAt : 0
        log('exit', `reason=${reason} ${detail} uptime=${Math.round((Date.now() - startedAt) / 1000)}s`)
        resolve({ reason, healthyMs })
      })

      ;(async () => {
        let fails = 0
        let lastCheck = -Infinity
        while (!exited) {
          await sleep(o.tickMs)
          if (exited) return
          if (stopRequested()) {
            kill('stop', o.stopGraceMs)
            continue
          }
          if (killReason) continue
          const t = Date.now() - startedAt
          const interval = firstOkAt ? o.healthIntervalMs : o.startupPollMs
          if (t - lastCheck >= interval) {
            lastCheck = t
            const ok = await health(port)
            if (exited) return
            if (ok) {
              if (!firstOkAt) firstOkAt = Date.now()
              fails = 0
            } else if (firstOkAt) {
              fails += 1
              logOnce('health-fail', 'health-failing', `fails=${fails}`)
              if (fails >= o.failLimit) kill('health-kill')
            }
          }
          if (!firstOkAt && t >= o.graceMs) kill('startup-timeout')
        }
      })()
    })
  }

  async function waitOrStop(ms) {
    const end = Date.now() + ms
    while (Date.now() < end && !stopRequested()) await sleep(Math.min(250, end - Date.now()))
  }

  async function run() {
    if (!(await acquireLock())) return { reason: 'already-running' }
    fs.mkdirSync(runDir, { recursive: true })
    beat()
    const beatTimer = setInterval(beat, o.beatMs)
    log('watchdog-start', `pid=${process.pid}`)
    let attempt = 0
    try {
      while (!stopRequested()) {
        const env = readEnvFile()
        const port = Number(options.serverPort || env.SERA_PORT || process.env.SERA_PORT || 4005)
        const cleared = await clearPort(port, env)
        let result = { reason: 'port-busy', healthyMs: 0 }
        if (cleared && !stopRequested()) result = await runOnce(env, port, pickNodeBin())
        if (stopRequested()) break
        if (result.healthyMs >= o.stableMs) attempt = 0
        const delay = backoffDelay(attempt, o.backoffMs)
        attempt += 1
        log('backoff', `wait=${Math.round(delay / 100) / 10}s`)
        await waitOrStop(delay)
      }
      // Stopping on purpose: also ask a Node we did not start to exit, so run/stop really means stopped.
      if (fs.existsSync(stopFile)) {
        const env = readEnvFile()
        await clearPort(Number(options.serverPort || env.SERA_PORT || process.env.SERA_PORT || 4005), env)
      }
      log('watchdog-stop', fs.existsSync(stopFile) ? 'reason=stop-file' : 'reason=stop-requested')
      return { reason: 'stopped' }
    } finally {
      clearInterval(beatTimer)
      lock?.close()
    }
  }

  return {
    run,
    logLine: log,
    /** Ends the loop and stops the current Node too (used by tests; the real stop is the run/stop file). */
    stop() {
      stopping = true
      if (child) {
        try {
          child.kill('SIGTERM')
        } catch {
          /* already gone */
        }
      }
    },
    serverPort,
  }
}

// Command line: `node server/supervise.mjs`. Started by server/ensure.sh, detached.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const supervisor = createSupervisor()
  // A signal to the watchdog ends the watchdog only. A healthy Node keeps serving, and the next watchdog
  // (cron starts one within a minute) adopts it. Stopping on purpose is the run/stop file.
  for (const sig of ['SIGTERM', 'SIGINT']) {
    process.on(sig, () => {
      supervisor.logLine('watchdog-exit', `reason=signal ${sig}`)
      process.exit(0)
    })
  }
  supervisor.run().then(
    () => process.exit(0),
    (err) => {
      console.error('[watchdog] fatal:', err?.code || err?.message)
      process.exit(1)
    },
  )
}
