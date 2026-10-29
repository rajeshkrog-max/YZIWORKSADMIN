// Graceful stop for the Sera backend (spec 0001). On SIGTERM, SIGINT or the admin restart request the
// server stops taking new connections, closes idle keep alive sockets, waits for the requests and the
// report in progress (up to 40 s), then exits. The watchdog (server/supervise.mjs) starts the next one.
// A crash we did not expect is logged in one short line and ends the process with code 1, so the watchdog
// restarts it from a clean state instead of leaving it half broken.
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export function createShutdown({ server, isBusy = () => false, timeoutMs = 40_000, pollMs = 100, exit = (code) => process.exit(code), log = console.log }) {
  let inFlight = 0
  let stopping = false

  server.on('request', (req, res) => {
    inFlight += 1
    res.once('close', () => {
      inFlight -= 1
    })
  })

  async function shutdown(reason, code = 0) {
    if (stopping) return
    stopping = true
    log(`[shutdown] ${reason}: not taking new connections, finishing work in progress`)
    server.close()
    server.closeIdleConnections?.()
    const end = Date.now() + timeoutMs
    while ((inFlight > 0 || isBusy()) && Date.now() < end) {
      server.closeIdleConnections?.()
      await sleep(pollMs)
    }
    const left = inFlight > 0 || isBusy()
    log(`[shutdown] exiting${left ? ' (gave up waiting for work still in progress)' : ''}`)
    exit(code)
  }

  return { shutdown, isStopping: () => stopping, inFlight: () => inFlight }
}

/** Signals and unexpected errors. `proc` is injectable for tests. */
export function installProcessHandlers({ shutdown, proc = process, log = console.error, exit = (code) => process.exit(code) }) {
  for (const signal of ['SIGTERM', 'SIGINT']) proc.on(signal, () => void shutdown(signal))
  proc.on('uncaughtException', (err) => {
    // One short line: the error name, its code and the first 200 characters of the message. No stack, no data.
    log(`[fatal] uncaught exception: ${err?.name || 'Error'} ${err?.code || ''} ${String(err?.message || err).slice(0, 200)}`)
    exit(1)
  })
}
