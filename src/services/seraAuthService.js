// The ONLY place the Sera login talks to the backend. Components call these
// three functions and never fetch directly. Contract: docs/sera-login-contract.md
//
// Mock mode (VITE_SERA_MOCK=true) answers everything locally, and the login
// steps swap the Google / MSG91 popups for small fake ones — no real OTP cost,
// no Google setup needed on localhost.

import { MOCK_REJOIN_CODE, findMockSessionByRejoin } from './seraMockCall'
import { cleanFirstName } from '../../netlify/lib/seraCall/cleanFirstName.js'

// DEV ONLY — stripped from production builds (import.meta.env.DEV is false there).
const MOCK_CODES = import.meta.env.DEV
  ? {
      'YZI-PUNE-OCT26': { instituteName: 'Pune Institute', seatsLeft: 42 },
      'YZI-FULL-TEST': { instituteName: 'Full Test Institute', seatsLeft: 0 },
    }
  : {}

const FRIENDLY_ERROR = "We couldn't reach the server. Please try again in a minute."

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// Dev server only: a production build can never run in mock mode (it would
// skip payment and the real checks), even if VITE_SERA_MOCK is set by mistake.
export function isMockMode() {
  return import.meta.env.DEV && import.meta.env.VITE_SERA_MOCK === 'true'
}

// POSTs JSON and returns the parsed body, or null if the endpoint is missing,
// errored, or answered with something that isn't JSON (e.g. the SPA fallback).
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

// → { valid: true, instituteName, seatsLeft } — a campus code
//   | { valid: true, kind: 'rejoin' } — a one-time code to continue a dropped interview
//   | { valid: false, reason } — reason: 'not_found' | 'expired' | 'used' | 'unavailable'
export async function checkStudentCode(code) {
  const clean = String(code || '').trim().toUpperCase()

  if (import.meta.env.DEV && isMockMode()) {
    await wait(350)
    // DEV ONLY — rejoin codes from a mock dropped call (seraSessionService).
    if (import.meta.env.DEV && clean.startsWith('REJOIN-')) {
      if (clean === 'REJOIN-EXPIRED') return { valid: false, reason: 'expired' }
      const dropped = findMockSessionByRejoin({ code: clean })
      if (dropped?.rejoinUsed) return { valid: false, reason: 'used' }
      if (dropped || clean === MOCK_REJOIN_CODE) return { valid: true, kind: 'rejoin' }
      return { valid: false, reason: 'not_found' }
    }
    const hit = MOCK_CODES[clean]
    return hit ? { valid: true, ...hit } : { valid: false, reason: 'not_found' }
  }

  // TODO(backend): POST /api/sera/student-code/check — not built yet.
  const data = await postJson('/api/sera/student-code/check', { code: clean })
  if (!data || typeof data.valid !== 'boolean') return { valid: false, reason: 'unavailable' }
  return data
}

// → { ok: true, login: { route, firstName, email, phone, studentCode } } | { ok: false, error }
// (the hook turns `login` into the session — src/shared/seraSession.js)
export async function completeLogin({ route, google, phone, msg91Token, studentCode }) {
  if (import.meta.env.DEV && isMockMode()) {
    await wait(400)
    const code = route === 'student' ? String(studentCode || '').trim().toUpperCase() : null
    return {
      ok: true,
      login: { route, firstName: cleanFirstName(google.name), email: google.email, phone, studentCode: code },
    }
  }

  // TODO(backend): POST /api/sera/login — not built yet. Server must verify the
  // Google accessToken, the MSG91 token and the student code (see contract doc).
  const data = await postJson('/api/sera/login', {
    route,
    google,
    phone,
    msg91Token,
    studentCode: route === 'student' ? studentCode : null,
  })
  if (!data || typeof data.ok !== 'boolean') return { ok: false, error: FRIENDLY_ERROR }
  return data
}

// DEV ONLY — /meet-sera?testlogin=visitor|student skips the login entirely
// ('visitor' = the New User route id).
// Active only in the Vite dev server AND mock mode; in a production build
// import.meta.env.DEV is `false`, so this always returns null and the sample
// profiles below are stripped from the bundle.
export function getDevTestSession(kind) {
  if (!import.meta.env.DEV || !isMockMode()) return null
  if (kind === 'visitor') {
    return { firstName: 'Test', email: 'visitor.test@gmail.com', phone: '9876543210', route: 'visitor', studentCode: null }
  }
  if (kind === 'student') {
    return { firstName: 'Test', email: 'student.test@gmail.com', phone: '9876543211', route: 'student', studentCode: 'YZI-PUNE-OCT26' }
  }
  return null
}
