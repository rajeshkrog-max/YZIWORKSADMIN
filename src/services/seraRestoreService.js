// Keeps the interview across a refresh: the session id lives in this tab's sessionStorage (cleared when
// the tab closes, so the next person on a shared computer never sees it), and the session itself is read
// back from the server. A closed tab is covered by the login instead: the server reopens this email's
// interview (POST /api/sera/login → `resumed`).
const KEY = 'sera.sessionId'

export function saveSessionId(sessionId) {
  try {
    if (sessionId) sessionStorage.setItem(KEY, sessionId)
  } catch {
    // Storage blocked (private mode, settings): a refresh then starts from the login, which still reopens it.
  }
}

export function loadSessionId() {
  try {
    return sessionStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function clearSessionId() {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    // nothing stored
  }
}

// → the public session (src/shared/seraSession.js shape plus status) | null when it no longer exists.
// Throws on a network failure, so a flaky connection never wipes the saved id.
export async function fetchServerSession(sessionId) {
  const res = await fetch('/api/sera/session/get', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId }),
  })
  if (res.status === 404) return null
  if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) throw new Error(`session read failed (${res.status})`)
  return res.json()
}
