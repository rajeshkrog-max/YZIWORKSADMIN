// The ONLY place the Sera pay screen talks to the backend. Contract:
// docs/sera-payment-contract.md
//
// Mock mode (VITE_SERA_MOCK=true, see seraAuthService) answers locally and the
// pay screen shows a fake checkout instead of loading Razorpay.
import { isMockMode } from './seraAuthService'
import { SERA_VISITOR_PLAN } from '../config/seraPricing'

const FRIENDLY_ERROR = "We couldn't reach the payment server. You haven't been charged — please try again in a minute."

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

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

// After Razorpay took the money, a failed confirm must never say "you haven't been charged".
export const VERIFY_PENDING =
  "Your payment went through, but we couldn't confirm it yet. Please don't pay again — refresh this page in a minute and it will be picked up automatically."

// The server takes the email and phone from the signed-in session, never from here.
// → { ok: true, orderId, amountPaise, currency, keyId }
//   | { ok: true, alreadyPaid: true, orderId, paymentId } — this email has a verified, unused payment
//   | { ok: false, error }
export async function createOrder({ sessionId }) {
  if (import.meta.env.DEV && isMockMode()) {
    await wait(400)
    return {
      ok: true,
      orderId: `order_mock_${Date.now()}`,
      amountPaise: SERA_VISITOR_PLAN.pricePaise,
      currency: SERA_VISITOR_PLAN.currency,
      keyId: 'rzp_test_mock',
    }
  }

  const data = await postJson('/api/sera/payment/create-order', { sessionId })
  if (!data || typeof data.ok !== 'boolean') return { ok: false, error: FRIENDLY_ERROR }
  return data
}

// Retried on a network failure (the money is already taken by then).
// → { ok: true, paymentId } | { ok: false, error }
export async function verifyPayment({ orderId, paymentId, signature, sessionId }) {
  if (import.meta.env.DEV && isMockMode()) {
    await wait(400)
    return { ok: true, paymentId }
  }

  let data = null
  for (let attempt = 0; attempt < 4 && !data; attempt++) {
    if (attempt) await wait(1500 * attempt)
    data = await postJson('/api/sera/payment/verify', { orderId, paymentId, signature, sessionId })
    if (data && typeof data.ok !== 'boolean') data = null
  }
  if (!data) return { ok: false, error: VERIFY_PENDING }
  return data
}
