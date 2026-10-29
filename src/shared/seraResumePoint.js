// Where to put a candidate whose interview already exists (a refresh, or a login that reopened it).
// Plain JS, browser safe. `session` is what POST /api/sera/session/get returns.
// → { screen: 'report' | 'restart' | 'wrapup' | 'pay' | 'upload', incomplete?: true } | null
const AFTER_CALL = new Set(['live', 'ended_by_candidate', 'completed', 'report_retrying', 'dropped'])

export function resumePoint(session) {
  if (!session?.sessionId) return null
  if (session.report) return { screen: 'report' }
  // The call was lost before the offers: one free restart (spec 0002).
  if (session.status === 'restart_available') return { screen: 'restart' }
  if (session.status === 'incomplete' || session.status === 'report_failed') return { screen: 'report', incomplete: true }
  // A call exists: it is ending or ended (a page reload leaves the call), so wait for what the server decides.
  if (session.rounds?.screening?.callId || AFTER_CALL.has(session.status)) return { screen: 'wrapup' }
  if (session.route === 'visitor' && session.offers?.length === 3 && !session.payment?.paymentId) return { screen: 'pay' }
  return { screen: 'upload' }
}
