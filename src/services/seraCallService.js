// The ONLY place the interview rounds talk to the backend: start a round's
// Retell call, release an unused reservation, poll for the report.
// The server picks the agent (pickAgentId) and builds its variables
// (buildCallVariables) from the stored session — see
// docs/sera-interview-contract.md ("Per-round calls").

async function postJson(path, body) {
  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.headers.get('content-type')?.includes('application/json')) return { status: res.status, data: null }
    return { status: res.status, data: await res.json() }
  } catch {
    return { status: 0, data: null }
  }
}

// session: src/shared/seraSession.js. round: 'screening' | 'hr' | 'final'.
// → { ok: true, sessionId, callId, accessToken }
//   | { ok: false, blocked: true, message } — one-interview rule
//   | { ok: false, error }
export async function startRoundCall(session, round) {
  const { status, data } = await postJson('/.netlify/functions/sera-start-call', {
    sessionId: session.sessionId,
    round,
    route: session.route,
    email: session.email,
    name: session.firstName,
    studentCode: session.studentCode,
    paymentId: session.payment?.paymentId,
    objectKey: session.resume?.objectKey,
    highlight: session.resume?.highlight,
    field: session.resume?.field,
    chosenOfferId: session.chosenOfferId,
    offers: session.offers,
  })
  if (status === 403 && data?.error === 'already-used') return { ok: false, blocked: true, message: data.message }
  if (!data?.success) return { ok: false, error: data?.error || 'Unable to start the interview' }
  return { ok: true, sessionId: data.sessionId ?? session.sessionId, callId: data.callId ?? null, accessToken: data.accessToken }
}

// A call that stalled right at the start shouldn't use up the one interview.
export function releaseReservation(session) {
  if (!session?.email) return
  postJson('/.netlify/functions/sera-release-reservation', { email: session.email })
}

// Zero-LLM-cost read of the report the server generated once after the final
// round. → { ready: false } | { ready: true, report } | { ready: true, incomplete: true } | { error }
export async function fetchReport(session) {
  const { status, data } = await postJson('/.netlify/functions/sera-get-report', { email: session?.email, sessionId: session?.sessionId })
  if (status !== 200 || !data) return { error: true }
  return data
}
