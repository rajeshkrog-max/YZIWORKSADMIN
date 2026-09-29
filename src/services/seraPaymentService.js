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

// → { ok: true, orderId, amountPaise, currency, keyId } | { ok: false, error }
export async function createOrder({ email, phone, objectKey }) {
  if (isMockMode()) {
    await wait(400)
    return {
      ok: true,
      orderId: `order_mock_${Date.now()}`,
      amountPaise: SERA_VISITOR_PLAN.pricePaise,
      currency: SERA_VISITOR_PLAN.currency,
      keyId: 'rzp_test_mock',
    }
  }

  // TODO(backend): POST /api/sera/payment/create-order — not built yet.
  const data = await postJson('/api/sera/payment/create-order', { email, phone, objectKey })
  if (!data || typeof data.ok !== 'boolean') return { ok: false, error: FRIENDLY_ERROR }
  return data
}

// → { ok: true, paymentId } | { ok: false, error }
export async function verifyPayment({ orderId, paymentId, signature }) {
  if (isMockMode()) {
    await wait(400)
    return { ok: true, paymentId }
  }

  // TODO(backend): POST /api/sera/payment/verify — not built yet.
  const data = await postJson('/api/sera/payment/verify', { orderId, paymentId, signature })
  if (!data || typeof data.ok !== 'boolean') return { ok: false, error: FRIENDLY_ERROR }
  return data
}
