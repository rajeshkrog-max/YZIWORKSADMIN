// The ONLY place the Sera login talks to the backend. Components call these
// three functions and never fetch directly. Contract: docs/sera-login-contract.md
//
// Mock mode (VITE_SERA_MOCK=true) answers everything locally, and the login
// steps swap the Google / MSG91 popups for small fake ones — no real OTP cost,
// no Google setup needed on localhost.

const MOCK_CODES = {
  'YZI-PUNE-OCT26': { instituteName: 'Pune Institute', seatsLeft: 42 },
  'YZI-FULL-TEST': { instituteName: 'Full Test Institute', seatsLeft: 0 },
}

const FRIENDLY_ERROR = "We couldn't reach the server. Please try again in a minute."

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export function isMockMode() {
  return import.meta.env.VITE_SERA_MOCK === 'true'
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

// → { valid: true, instituteName, seatsLeft } | { valid: false, reason }
export async function checkStudentCode(code) {
  const clean = String(code || '').trim().toUpperCase()

  if (isMockMode()) {
    await wait(350)
    const hit = MOCK_CODES[clean]
    return hit ? { valid: true, ...hit } : { valid: false, reason: 'not_found' }
  }

  // TODO(backend): POST /api/sera/student-code/check — not built yet.
  const data = await postJson('/api/sera/student-code/check', { code: clean })
  if (!data || typeof data.valid !== 'boolean') return { valid: false, reason: 'unavailable' }
  return data
}

// → { ok: true, session: { route, name, email, phone, studentCode, instituteName } } | { ok: false, error }
export async function completeLogin({ route, google, phone, msg91Token, studentCode }) {
  if (isMockMode()) {
    await wait(400)
    const code = route === 'student' ? String(studentCode || '').trim().toUpperCase() : null
    return {
      ok: true,
      session: {
        route,
        name: google.name,
        email: google.email,
        phone,
        studentCode: code,
        instituteName: code ? (MOCK_CODES[code]?.instituteName ?? null) : null,
      },
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
