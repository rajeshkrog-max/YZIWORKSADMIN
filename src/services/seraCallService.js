// The ONLY place the interview talks to the backend: start the interview's ONE
// Vapi squad call, release an unused reservation, poll for the report.
// The server builds the call from the stored session (résumé, offers, payment or
// seat) — the browser only says which session. See docs/sera-vapi.md.

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

// Starts the whole interview (Sera → Vinit → Sonia is ONE call).
// → { ok: true, sessionId, callId, webCallUrl }
//   | { ok: false, blocked: true, message } — one-interview rule
//   | { ok: false, error }
export async function startInterviewCall(session) {
  const { status, data } = await postJson('/api/sera/start-call', {
    sessionId: session.sessionId,
    paymentId: session.payment?.paymentId,
  })
  if (status === 403 && data?.error === 'already-used') return { ok: false, blocked: true, message: data.message }
  if (!data?.success || !data.webCallUrl) return { ok: false, error: data?.message || data?.error || 'Unable to start the interview' }
  return { ok: true, sessionId: data.sessionId ?? session.sessionId, callId: data.callId ?? null, webCallUrl: data.webCallUrl }
}

// A call that stalled right at the start shouldn't use up the one interview
// (the server only forgives it inside the first 90 seconds).
export function releaseReservation(session) {
  if (!session?.sessionId) return
  postJson('/api/sera/release-reservation', { sessionId: session.sessionId })
}

// Where is the live call? The server learns it from Vapi (the show_offers tool call, and which
// assistant is speaking), so the page follows it even if an in-call message never arrives.
// → { offersShown: boolean, round: 'screening' | 'hr' | 'final' | null } | null
export async function fetchCallState(session) {
  const { status, data } = await postJson('/api/sera/session/get', { sessionId: session?.sessionId })
  if (status !== 200 || !data) return null
  return { offersShown: data.offersShown === true, round: data.callRound ?? null }
}

// Zero-LLM-cost read of the report the server generated once after the final
// round. → { ready: false } | { ready: true, report } | { ready: true, incomplete: true } | { error }
export async function fetchReport(session) {
  const { status, data } = await postJson('/api/sera/get-report', { email: session?.email, sessionId: session?.sessionId })
  if (status !== 200 || !data) return { error: true }
  return data
}
