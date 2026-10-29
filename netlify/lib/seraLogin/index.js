// Sera login checks. Pure: the caller passes `fetchImpl` and env, nothing here reads
// process.env or opens the network by itself. The browser is never trusted: identity
// comes from Google, the phone from MSG91, the code from the server's own list.

const GOOGLE_TOKENINFO_URL = 'https://oauth2.googleapis.com/tokeninfo'
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo'
const MSG91_VERIFY_URL = 'https://control.msg91.com/api/v5/widget/verifyAccessToken'

export const MOCK_GOOGLE_TOKEN = 'mock-google-token' // the dev-mode token; refused unless allowMock

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const isValidEmail = (email) => typeof email === 'string' && email.length <= 254 && EMAIL.test(email)
// Indian mobile: 10 digits starting 6-9 (the page sends it without +91).
export const isValidPhone = (phone) => /^[6-9]\d{9}$/.test(String(phone ?? ''))

// → { ok: true, identity: { email, name, picture } } | { ok: false, error }
// Checks, in order: the token is a real Google token for OUR client id, the email is
// verified, then reads the name. The email always comes from Google, never from the body.
export async function verifyGoogleLogin(google, { fetchImpl = fetch, clientId = '', allowMock = false, urls = {} } = {}) {
  const accessToken = google?.accessToken
  if (typeof accessToken !== 'string' || accessToken.length < 10) return { ok: false, error: 'Please sign in with Google again.' }

  if (accessToken === MOCK_GOOGLE_TOKEN) {
    // Only ever on a developer machine with SERA_ALLOW_MOCK_LOGIN=1 — never in production.
    if (!allowMock || !isValidEmail(google.email)) return { ok: false, error: 'Please sign in with Google again.' }
    return { ok: true, identity: { email: google.email.toLowerCase(), name: String(google.name ?? ''), picture: google.picture ?? null } }
  }

  try {
    const infoRes = await fetchImpl(`${urls.tokeninfo ?? GOOGLE_TOKENINFO_URL}?access_token=${encodeURIComponent(accessToken)}`, { signal: AbortSignal.timeout(10000) })
    if (!infoRes.ok) return { ok: false, error: 'Your Google sign-in expired. Please try again.' }
    const info = await infoRes.json()

    // The token must have been issued to THIS site, not to some other app.
    if (clientId && info.aud !== clientId && info.azp !== clientId) {
      return { ok: false, error: 'This Google sign-in is not valid for this site.' }
    }
    if (!isValidEmail(info.email) || !(info.email_verified === true || info.email_verified === 'true')) {
      return { ok: false, error: 'Your Google email is not verified.' }
    }

    let name = ''
    let picture = null
    const userRes = await fetchImpl(urls.userinfo ?? GOOGLE_USERINFO_URL, { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(10000) })
    if (userRes.ok) {
      const user = await userRes.json()
      name = String(user.name ?? user.given_name ?? '')
      picture = user.picture ?? null
    }
    return { ok: true, identity: { email: info.email.toLowerCase(), name, picture } }
  } catch {
    return { ok: false, error: "We couldn't reach Google. Please try again in a minute." }
  }
}

// The WhatsApp-only login: the candidate types a name and an email instead of using Google.
// The email is not verified, so it only identifies the interview (one per email); it never
// grants an admin or demo identity. → { ok: true, identity: { email, name } } | { ok: false, error }
export function typedIdentity(manual, { isAdminEmail = () => false } = {}) {
  const email = String(manual?.email ?? '').trim().toLowerCase()
  const name = String(manual?.name ?? '').replace(/\s+/g, ' ').trim().slice(0, 60)
  if (!/\p{L}/u.test(name)) return { ok: false, error: 'Please enter your name.' }
  if (!isValidEmail(email)) return { ok: false, error: 'Please enter a valid email address.' }
  if (isAdminEmail(email) || email.endsWith('@demo.yziworks.com')) {
    return { ok: false, error: 'Please sign in with Google to use this email.' }
  }
  return { ok: true, identity: { email, name } }
}

// MSG91 widget success token → verified server-side with the MSG91 auth key.
// → { ok: true } | { ok: false, error }. Only call when the auth key is configured.
export async function verifyMsg91Token({ token, authKey, fetchImpl = fetch, url = MSG91_VERIFY_URL }) {
  if (typeof token !== 'string' || token.length < 8) return { ok: false, error: "We couldn't verify your WhatsApp number." }
  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ authkey: authKey, 'access-token': token }),
      signal: AbortSignal.timeout(10000),
    })
    const data = await res.json().catch(() => null)
    // MSG91 returns the verified identifier (the mobile, with country code) in `message`.
    if (res.ok && data && String(data.type).toLowerCase() === 'success') return { ok: true, identifier: String(data.message ?? '') }
    return { ok: false, error: "We couldn't verify your WhatsApp number. Please try again." }
  } catch {
    return { ok: false, error: "We couldn't reach the verification service. Please try again." }
  }
}

// Sliding-window limiter, per key. In memory: one pm2 process, so that is enough.
export function createRateLimiter({ windowMs, max, now = () => Date.now() }) {
  const hits = new Map()
  return {
    // → { allowed: true } | { allowed: false, retryAfterSeconds }
    hit(key) {
      const t = now()
      const recent = (hits.get(key) ?? []).filter((at) => t - at < windowMs)
      if (recent.length >= max) {
        hits.set(key, recent)
        return { allowed: false, retryAfterSeconds: Math.ceil((windowMs - (t - recent[0])) / 1000) }
      }
      recent.push(t)
      hits.set(key, recent)
      if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((at) => t - at < windowMs)) hits.delete(k)
      return { allowed: true }
    },
  }
}

// Behind Apache the real client is the LAST x-forwarded-for entry (the proxy appends it;
// anything earlier is client-supplied and can be forged).
export function clientIp(headers, remoteAddress = '') {
  const parts = String(headers?.['x-forwarded-for'] ?? '').split(',').map((p) => p.trim()).filter(Boolean)
  return parts.at(-1) ?? remoteAddress ?? 'unknown'
}

// A demo visitor gets a throwaway identity: unique, unreachable, never a real mailbox.
export function demoIdentity(name, randomId) {
  const clean = String(name ?? '').replace(/[^\p{L}\p{M} .'-]/gu, '').trim().slice(0, 40)
  return { name: clean || 'Demo', email: `demo-${randomId}@demo.yziworks.com` }
}
