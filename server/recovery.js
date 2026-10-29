// Restart recovery for the Sera backend (spec 0001). Runs once when the server starts and then every two
// minutes. The server keeps some things only in memory (the round timers) and depends on Vapi calling it
// back (the end of call report); a restart or an outage in the middle of an interview loses both.
// This sweep puts them back:
//   1. re-arms the round timers of a live call, part way through, without repeating a note already sent
//   2. finds a call that ended while the server was down (reads it back from Vapi) and hands it to the same
//      end of call processing the webhook uses
//   3. retries a report that was running when the server stopped, once, and runs the one retry of a failed
//      report (confirmed 2026-10-26, spec 0002) whose timer a restart lost
//   4. releases an interview slot taken just before a crash, before any call existed
//
// It never makes a language model call of its own: a report is only ever built by `finalizeReport`, the
// existing path, and the `reportAttempts` count keeps that to two runs per interview at most.
// Everything it needs is passed in, so the tests run it with fakes and a fake clock.
import { decideOutcome } from '../netlify/lib/seraVapi/webhook.js'

export const RECOVERY_INTERVAL_MS = 2 * 60 * 1000
export const END_WAIT_MS = 90 * 1000 // wait this long after Vapi's end time: the webhook may still be on its way
export const LIVE_MAX_MS = 30 * 60 * 1000 // an interview never lasts this long; a call older than this is left alone
export const ORPHAN_AFTER_MS = 5 * 60 * 1000
export const MAX_REPORT_ATTEMPTS = 2
const HOUR_MS = 60 * 60 * 1000

/**
 * May a report run start for this session? `finalizeReport` asks this inside its lock.
 * The webhook path (stale false) is as before: not when a report exists, is running or is done.
 * A recovery retry (stale true) may also take over a report that was running when this process started,
 * once, and never one that failed on a language model error.
 */
export function canClaimReport(session, { stale = false, processStartedMs = 0 } = {}) {
  if (session.report || session.reportState === 'done') return false
  if ((session.reportAttempts ?? 0) >= MAX_REPORT_ATTEMPTS) return false // never more than two runs, on any path
  if (session.reportState === 'running' && !(stale && Date.parse(session.reportStartedAt) < processStartedMs)) return false
  if (stale && (session.reportState === 'failed' || (session.reportAttempts ?? 0) >= MAX_REPORT_ATTEMPTS)) return false
  return true
}

/** Seconds the current round has been running, from what the session recorded. null = not recorded. */
export function roundElapsedSeconds(vapi, now) {
  const round = vapi.round ?? 'screening'
  const from = vapi.roundStartedAt?.[round] ?? (round === 'screening' ? vapi.startedAt : round === 'hr' ? vapi.handoffAt : null)
  const ms = Date.parse(from)
  return Number.isFinite(ms) ? Math.max(0, Math.round((now - ms) / 1000)) : null
}

export function createRecovery({
  store,
  roundTimers,
  roundSeconds,
  hasVapiKey,
  getCall,
  callToEndOfCall,
  processEndOfCall,
  finalizeReport,
  mutateSession,
  now = Date.now,
  log = console.log,
}) {
  const lastLogged = new Map()
  const short = (id) => String(id).slice(0, 8)
  /** A line that can repeat every sweep is written at most once an hour per key. */
  const logOnce = (key, message) => {
    if (now() - (lastLogged.get(key) ?? -Infinity) < HOUR_MS) return
    lastLogged.set(key, now())
    log(message)
  }
  let sweeping = false

  async function markCallMissing(sessionId) {
    // Vapi has no such call (404): nothing will ever end it. No report, and no refund.
    await mutateSession(sessionId, (s) => {
      if (!s.vapi || s.vapi.endHandled) return
      s.vapi.endHandled = true
      s.vapi.endedReason = 'call-not-found'
      s.status = 'incomplete'
    })
    roundTimers.clear(sessionId)
    log(`[recovery] session ${short(sessionId)}: Vapi has no such call, marked incomplete`)
  }

  function rearmTimers(session) {
    const v = session.vapi
    const round = v.round ?? 'screening'
    const seconds = roundSeconds[round]
    if (!seconds || !v.controlUrl || roundTimers.isRunning(session.sessionId, round)) return false
    const elapsed = roundElapsedSeconds(v, now())
    roundTimers.start({
      sessionId: session.sessionId,
      round,
      seconds,
      controlUrl: v.controlUrl,
      elapsedSeconds: elapsed ?? 0,
      done: Object.keys(v.timerSteps?.[round] ?? {}),
    })
    log(`[recovery] session ${short(session.sessionId)}: ${round} timers re-armed at ${elapsed ?? 'unknown'} s`)
    return true
  }

  /** A call with no end handled: it is live, or it ended while the server was away. */
  async function handleOpenCall(session, summary) {
    const v = session.vapi
    if (hasVapiKey()) {
      let call = null
      try {
        call = await getCall(v.callId)
      } catch (err) {
        if (err?.status === 404) {
          await markCallMissing(session.sessionId)
          summary.missing += 1
          return
        }
        logOnce(`lookup-${err?.status ?? err?.name}`, `[recovery] could not read a call from Vapi (${err?.status ?? err?.name}), will try again`)
      }
      const ended = call && callToEndOfCall(call)
      if (ended) {
        if (now() - Date.parse(ended.endedAt) < END_WAIT_MS) return // give the webhook its moment first
        await processEndOfCall({ ...ended, sessionId: ended.sessionId ?? session.sessionId })
        log(`[recovery] session ${short(session.sessionId)}: call had ended while the server was away, handled`)
        summary.caughtUp += 1
        return
      }
    }
    const age = now() - Date.parse(v.startedAt)
    if (age > LIVE_MAX_MS) {
      logOnce(`old-${session.sessionId}`, `[recovery] session ${short(session.sessionId)}: call is ${Math.round(age / 60000)} min old and not ended, left alone`)
      return
    }
    if (rearmTimers(session)) summary.rearmed += 1
  }

  const wouldReport = (session) =>
    !['restart_available', 'incomplete', 'report_failed'].includes(session.status) &&
    decideOutcome({
      endedReason: session.vapi.endedReason,
      transcripts: Object.fromEntries(['screening', 'hr', 'final'].map((r) => [r, session.rounds?.[r]?.transcript ?? []])),
      candidateEnded: session.status === 'ended_by_candidate' || session.candidateEnded === true,
    }) === 'report'

  /** A report that was running when the server stopped, or a call whose end was handled but no report began. */
  async function handleReport(session, { startup, startedMs }, summary) {
    if (session.report || session.reportState === 'done' || session.reportState === 'failed') return
    if ((session.reportAttempts ?? 0) >= MAX_REPORT_ATTEMPTS) return
    const stuckRunning = session.reportState === 'running' && Date.parse(session.reportStartedAt) < startedMs
    // A failed report waiting for its one retry (server/index.js sets the time); a restart lost the timer.
    const retryDue = session.reportState === 'retry_pending' && Date.parse(session.reportRetryAt ?? 0) <= now()
    // "Ended with no report yet" is only a crash leftover at start up; later it is just a report about to begin.
    const stranded = startup && !session.reportState && wouldReport(session)
    if (!stuckRunning && !stranded && !retryDue) return
    log(`[recovery] session ${short(session.sessionId)}: report ${stuckRunning ? 'was running when the server stopped' : retryDue ? 'failed once, running its retry' : 'never started'}, retrying once`)
    await finalizeReport(session.sessionId, { stale: true })
    summary.reportsRetried += 1
  }

  /** A slot reserved just before a crash: no call exists for it, so the candidate was never in an interview. */
  async function handleOrphans(sessions, summary) {
    const byId = new Map(sessions.map((s) => [s.sessionId, s]))
    for (const reservation of await store.listReservations()) {
      if (reservation.status !== 'reserved') continue
      if (now() - Date.parse(reservation.reservedAt) < ORPHAN_AFTER_MS) continue
      if (byId.get(reservation.sessionId)?.vapi?.callId) continue // a call exists: never release
      await store.releaseReservationByKey(reservation.key)
      if (reservation.seatConsumedFor) await store.refundStudentSeat(reservation.seatConsumedFor)
      log(`[recovery] released an interview slot left behind by a crash${reservation.seatConsumedFor ? ' (seat refunded)' : ''}`)
      summary.released += 1
    }
  }

  /** One pass. `startup` is true for the first pass after the server started. */
  async function sweep({ startup = false, startedMs = now() } = {}) {
    if (sweeping) return null
    sweeping = true
    const summary = { rearmed: 0, caughtUp: 0, missing: 0, reportsRetried: 0, released: 0 }
    try {
      const sessions = await store.listSessions()
      for (const session of sessions) {
        try {
          if (session.vapi?.callId && !session.vapi.endHandled) await handleOpenCall(session, summary)
          else if (session.vapi?.endHandled) await handleReport(session, { startup, startedMs }, summary)
        } catch (err) {
          logOnce(`session-${err?.name}`, `[recovery] a session could not be checked (${err?.name}: ${String(err?.message).slice(0, 120)})`)
        }
      }
      await handleOrphans(sessions, summary)
    } catch (err) {
      logOnce(`sweep-${err?.name}`, `[recovery] sweep failed (${err?.name}: ${String(err?.message).slice(0, 120)})`)
    } finally {
      sweeping = false
    }
    return summary
  }

  return {
    sweep,
    /** The first pass now, then one every two minutes. The timer never keeps the process alive. */
    start({ intervalMs = RECOVERY_INTERVAL_MS } = {}) {
      const startedMs = now()
      void sweep({ startup: true, startedMs })
      const timer = setInterval(() => void sweep({ startedMs }), intervalMs)
      timer.unref?.()
      return timer
    },
  }
}
