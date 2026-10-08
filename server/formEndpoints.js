// The public website endpoints (application forms, contact form, phone OTP, file uploads).
// They began as Netlify Functions. Their handlers are reused unchanged and run here behind a
// small adapter, so the forms keep calling the same /.netlify/functions/<name> URLs (Apache
// forwards that path to this server). /api/forms/<name> is accepted as an alias.
// r2-create-upload is the exception: it is written here (applicationUploads.js) because the
// browser can no longer upload straight to R2.
import { handler as sendOtp } from '../netlify/functions/send-otp.js'
import { handler as verifyOtp } from '../netlify/functions/verify-otp.js'
import { handler as sendContact } from '../netlify/functions/send-contact.js'
import { prepareUploads } from './applicationUploads.js'
import { createRateLimiter } from '../netlify/lib/seraLogin/index.js'

const TEN_MINUTES = 10 * 60 * 1000

// Netlify style handler for r2-create-upload: signed upload URLs that point back at this server.
async function r2CreateUpload(event) {
  const json = (statusCode, body) => ({ statusCode, body: JSON.stringify(body) })
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' })
  let request
  try {
    request = JSON.parse(event.body || '{}')
  } catch {
    return json(400, { error: 'Invalid request' })
  }
  const out = prepareUploads(request, { secret: process.env.R2_SECRET_ACCESS_KEY })
  return json(out.status, out.body)
}

// `requires` are the env names the handler needs; a missing one answers 503 instead of
// calling a provider with an empty key. Limits are per client IP: send-otp costs an SMS,
// send-contact and verify-otp send an email, r2-create-upload hands out upload URLs.
export const FORM_ROUTES = {
  'send-otp': { handler: sendOtp, requires: ['MSG91_AUTH_KEY', 'MSG91_WIDGET_ID'], limiter: createRateLimiter({ windowMs: TEN_MINUTES, max: 6 }) },
  'verify-otp': { handler: verifyOtp, requires: ['RESEND_API_KEY'], limiter: createRateLimiter({ windowMs: TEN_MINUTES, max: 10 }) },
  'send-contact': { handler: sendContact, requires: ['RESEND_API_KEY'], limiter: createRateLimiter({ windowMs: TEN_MINUTES, max: 6 }) },
  'r2-create-upload': { handler: r2CreateUpload, requires: ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY'], limiter: createRateLimiter({ windowMs: TEN_MINUTES, max: 30 }) },
}

const PATH_PATTERN = /^\/(?:\.netlify\/functions|api\/forms)\/([a-z0-9-]+)\/?$/

// Returns the route for a path such as /.netlify/functions/send-contact, or null.
export function matchFormRoute(pathname) {
  const name = PATH_PATTERN.exec(pathname)?.[1]
  return name && Object.hasOwn(FORM_ROUTES, name) ? { name, ...FORM_ROUTES[name] } : null
}

// The env names a route needs that are not set.
export function missingEnv(route, env = process.env) {
  return route.requires.filter((name) => !env[name])
}

// Which routes are ready, for the diagnostics endpoint. Names only, never values.
export function formsStatus(env = process.env) {
  return Object.fromEntries(
    Object.entries(FORM_ROUTES).map(([name, route]) => {
      const missing = missingEnv(route, env)
      return [name, missing.length ? { ok: false, missing } : { ok: true }]
    }),
  )
}

// Runs a Netlify style handler for one request and returns { statusCode, headers, body }.
export async function runFormHandler(route, { method, path, headers, rawBody }) {
  const result = await route.handler({
    httpMethod: method,
    path,
    headers,
    body: rawBody || null,
    queryStringParameters: {},
  })
  return {
    statusCode: result?.statusCode ?? 200,
    headers: { 'Content-Type': 'application/json', ...(result?.headers ?? {}) },
    body: result?.body ?? '',
  }
}
