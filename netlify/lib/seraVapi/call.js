// Server-side creation of the ONE Vapi squad call for a whole interview
// (Sera → Vinit → Sonia). SERVER ONLY — takes the private key from env.
// The squad id is never in git: it comes from VAPI_SQUAD_ID.
import { buildCallVariables } from '../seraCall/variables.js'
import { sessionIdFromCall } from './webhook.js'

// POST /call/web is the only endpoint that creates a WEB call (POST /call needs a phone
// number). Verified against Vapi's API: it answers 401 to a private key and wants the
// PUBLIC key. That key stays on the server (env) and is never sent to the browser, so
// nobody can start calls from DevTools. The response carries the room the browser
// joins and, with monitorPlan.controlEnabled, `monitor.controlUrl`.
export const VAPI_WEB_CALL_URL = 'https://api.vapi.ai/call/web'
// VAPI_API_BASE exists only so the end-to-end test can point at a fake Vapi.
export const vapiWebCallUrl = (env = process.env) => (env.VAPI_API_BASE ? `${env.VAPI_API_BASE}/call/web` : VAPI_WEB_CALL_URL)

// Hard backstop. Screening ~4 min (cap 5) + 45 s offer pick + 4 min HR + 4 min final + the closings,
// with room to spare (a real call: Sera 229 s, Vinit 204 s, Sonia 150 s+). The server's round timers
// end each round long before this; it only stops a call that nothing else ended.
export const MAX_CALL_SECONDS = 900

export class VapiNotConfiguredError extends Error {
  constructor(missing) {
    super(`Vapi is not configured: ${missing.join(', ')}`)
    this.name = 'VapiNotConfiguredError'
    this.missing = missing
  }
}

export class VapiRequestError extends Error {
  constructor(status, body) {
    super(`Vapi call creation failed (${status})`)
    this.name = 'VapiRequestError'
    this.status = status
    this.body = body
  }
}

export function getVapiConfig(env = process.env) {
  const webCallKey = env.VAPI_PUBLIC_KEY?.trim()
  const squadId = env.VAPI_SQUAD_ID?.trim()
  const missing = [!webCallKey && 'VAPI_PUBLIC_KEY', !squadId && 'VAPI_SQUAD_ID'].filter(Boolean)
  if (missing.length) throw new VapiNotConfiguredError(missing)
  return { webCallKey, squadId }
}

// Only the screening variables exist at this point — the offer is not chosen
// yet. HR and Final get the chosen offer through the control message instead.
// maxDurationSeconds, metadata and monitorPlan are NOT call-level fields in Vapi's
// API (unknown top-level fields are silently dropped): they go in squadOverrides.
export function buildCreateCallBody(session, { squadId, objectKey }) {
  return {
    squadId,
    squadOverrides: {
      variableValues: buildCallVariables(session, 'screening'),
      maxDurationSeconds: MAX_CALL_SECONDS,
      metadata: { email: session.email, sessionId: session.sessionId, objectKey },
      monitorPlan: { controlEnabled: true },
    },
  }
}

// → { callId, webCallUrl, controlUrl }. Throws VapiNotConfiguredError / VapiRequestError.
export async function createVapiCall(session, { objectKey, env = process.env, fetchImpl = fetch } = {}) {
  const { webCallKey, squadId } = getVapiConfig(env)
  const res = await fetchImpl(vapiWebCallUrl(env), {
    method: 'POST',
    headers: { Authorization: `Bearer ${webCallKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(buildCreateCallBody(session, { squadId, objectKey })),
  })
  if (!res.ok) throw new VapiRequestError(res.status, await res.text().catch(() => ''))
  const data = await res.json()
  const webCallUrl = data?.webCallUrl ?? data?.transport?.callUrl
  const controlUrl = data?.monitor?.controlUrl
  if (!data?.id || !webCallUrl || !controlUrl) {
    throw new VapiRequestError(502, 'Vapi response is missing id, the web call url or monitor.controlUrl')
  }
  return { callId: data.id, webCallUrl, controlUrl }
}

// --- Reading a call back (server restart recovery, spec 0001) ---
// When the server is down at the end of a call, Vapi's end-of-call webhook is not answered. Recovery reads the
// call back with the server's own PRIVATE key (VAPI_PRIVATE_KEY; the public key above only creates web calls)
// and treats it as the report the webhook would have carried. Read only; nothing here is reachable by a stranger.
export const vapiCallUrl = (callId, env = process.env) => `${env.VAPI_API_BASE || 'https://api.vapi.ai'}/call/${encodeURIComponent(callId)}`

export class VapiLookupError extends Error {
  constructor(status) {
    super(`Vapi call lookup failed (${status})`)
    this.name = 'VapiLookupError'
    this.status = status
  }
}

// → the Vapi Call object. Throws VapiNotConfiguredError (no key) or VapiLookupError (404 = no such call).
export async function getCall(callId, { env = process.env, fetchImpl = fetch, timeoutMs = 15000 } = {}) {
  const key = env.VAPI_PRIVATE_KEY?.trim()
  if (!key) throw new VapiNotConfiguredError(['VAPI_PRIVATE_KEY'])
  const res = await fetchImpl(vapiCallUrl(callId, env), {
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!res.ok) throw new VapiLookupError(res.status)
  return res.json()
}

// Vapi's Call → what parseEndOfCall gives for the webhook, plus when the call ended.
// null while the call is still going (no `ended` status or no end time yet).
export function callToEndOfCall(call) {
  if (!call || call.status !== 'ended' || !call.endedAt || !Number.isFinite(Date.parse(call.endedAt))) return null
  return {
    callId: call.id ?? null,
    sessionId: sessionIdFromCall(call),
    endedReason: call.endedReason ?? null,
    messages: call.artifact?.messages ?? call.messages ?? [],
    endedAt: call.endedAt,
  }
}
