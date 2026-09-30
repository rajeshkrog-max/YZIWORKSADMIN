// The ONLY place the interview session rules (intentional end, dropped call,
// rejoin) talk to the backend. Contract: docs/sera-interview-contract.md
//
// The real decisions (was it really a network drop? issue a rejoin? has it been
// used?) are made on the server. The DEV-only mock below lets the whole flow be
// clicked through on localhost; every mock branch is written as
// `import.meta.env.DEV && isMockMode()` so it is stripped from production.
import { isMockMode } from './seraAuthService'
import {
  MOCK_REJOIN_CODE,
  MOCK_REJOIN_TOKEN,
  findMockSessionByRejoin,
  readMockSessions,
  saveMockSession,
} from './seraMockCall'

async function postJson(path, body) {
  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.headers.get('content-type')?.includes('application/json')) return null
    return await res.json()
  } catch {
    return null
  }
}

// Called BEFORE hanging up when the candidate confirms "End interview", so the
// server records ended_by_candidate (no rejoin) rather than a drop. → { ok }
export async function markCandidateEnded(sessionId) {
  if (import.meta.env.DEV && isMockMode()) {
    saveMockSession(sessionId, { status: 'ended_by_candidate' })
    return { ok: true }
  }
  // TODO(backend): POST /api/sera/session/end — not built yet.
  const data = await postJson('/api/sera/session/end', { sessionId })
  return { ok: data?.ok === true }
}

// Called when the call drops without the candidate pressing End.
// → { ok, rejoinIssued } — rejoinIssued is false after the one allowed rejoin
// (the server emails the admin instead of sending another link).
export async function reportConnectionLost(sessionId, round) {
  if (import.meta.env.DEV && isMockMode()) {
    const session = readMockSessions()[sessionId]
    if (!session || session.rejoinCount >= 1) {
      saveMockSession(sessionId, { status: 'dropped', round })
      return { ok: true, rejoinIssued: false }
    }
    const student = session.route === 'student'
    saveMockSession(sessionId, {
      status: 'dropped',
      round,
      rejoinToken: student ? null : MOCK_REJOIN_TOKEN,
      rejoinCode: student ? MOCK_REJOIN_CODE : null,
      rejoinUsed: false,
    })
    return { ok: true, rejoinIssued: true }
  }
  // TODO(backend): POST /api/sera/session/lost — not built yet. The server must
  // still confirm Retell's disconnection reason before issuing a rejoin.
  const data = await postJson('/api/sera/session/lost', { sessionId, round })
  return { ok: data?.ok === true, rejoinIssued: data?.rejoinIssued === true }
}

// New User (route 'visitor'): { token } from the WhatsApp link. Student: { code } typed in the
// Student code field. Must match the email + phone the session started with.
// → { ok: true, session: { sessionId, route, round, chosenOffer, resumeMeta } }
//   | { ok: false, reason: 'expired' | 'used' | 'mismatch' | 'invalid' }
export async function redeemRejoin({ token, code, email, phone }) {
  if (import.meta.env.DEV && isMockMode()) {
    await new Promise((resolve) => setTimeout(resolve, 400))
    if (code === 'REJOIN-EXPIRED' || token === 'REJOIN-EXPIRED') return { ok: false, reason: 'expired' }
    let session = findMockSessionByRejoin({ token, code })
    if (!session) {
      // Fresh browser with no dropped session: the test link/code still works.
      if (token !== MOCK_REJOIN_TOKEN && code !== MOCK_REJOIN_CODE) return { ok: false, reason: 'invalid' }
      session = saveMockSession(`mock-session-${Date.now()}`, {
        route: code ? 'student' : 'visitor',
        round: 'screening',
        email,
        phone,
        chosenOffer: null,
        resumeMeta: { originalFilename: 'Resume.pdf', size: 0 },
        rejoinToken: token ?? null,
        rejoinCode: code ?? null,
        rejoinUsed: false,
        rejoinCount: 0,
      })
    }
    if (session.rejoinUsed) return { ok: false, reason: 'used' }
    if (session.email !== email || session.phone !== phone) return { ok: false, reason: 'mismatch' }
    saveMockSession(session.sessionId, {
      rejoinUsed: true,
      rejoinCount: (session.rejoinCount ?? 0) + 1,
      status: 'live',
    })
    const { sessionId, route, round, chosenOffer, resumeMeta } = session
    return { ok: true, session: { sessionId, route, round, chosenOffer, resumeMeta } }
  }
  // TODO(backend): POST /api/sera/rejoin — not built yet.
  const data = await postJson('/api/sera/rejoin', { token, code, email, phone })
  if (typeof data?.ok !== 'boolean') return { ok: false, reason: 'invalid' }
  return data
}
