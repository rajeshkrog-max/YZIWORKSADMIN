// Razorpay helpers for the New User payment. Pure: the caller passes keys, fetch and the clock.
//
// Why this exists: a candidate can pay and still never reach POST /payment/verify (tab closed in the
// Razorpay handler, phone locked, network gone right after paying). Their money is taken but our order
// stays "created". Before asking anyone to pay, the server reads that email's recent unpaid orders back
// from Razorpay (GET /v1/orders/{id}/payments) and treats a captured or authorized payment as verified,
// so nobody is ever charged twice and a refresh never loses a payment.

// RAZORPAY_API_BASE exists only so the tests can point at a fake Razorpay.
export const razorpayBase = (env = process.env) => env.RAZORPAY_API_BASE || 'https://api.razorpay.com'

export const PAID_STATUSES = new Set(['captured', 'authorized'])
export const RECONCILE_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000 // older unpaid orders are not checked again
export const ORDER_REUSE_MS = 30 * 60 * 1000 // a fresh unpaid order is offered again instead of a new one

const basicAuth = (keyId, keySecret) => `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`

// → the Razorpay order { id, ... }. Throws with `status` on a refusal.
export async function createRazorpayOrder({ keyId, keySecret, amountPaise, notes, env = process.env, fetchImpl = fetch, now = Date.now }) {
  const res = await fetchImpl(`${razorpayBase(env)}/v1/orders`, {
    method: 'POST',
    headers: { Authorization: basicAuth(keyId, keySecret), 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount: amountPaise, currency: 'INR', receipt: `sera_${now()}`, notes }),
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) throw Object.assign(new Error(`Razorpay order creation failed (${res.status}): ${await res.text().catch(() => '')}`), { status: res.status })
  return res.json()
}

// → [payment] for one order. Throws with `status` on a refusal.
export async function listOrderPayments(orderId, { keyId, keySecret, env = process.env, fetchImpl = fetch }) {
  const res = await fetchImpl(`${razorpayBase(env)}/v1/orders/${encodeURIComponent(orderId)}/payments`, {
    headers: { Authorization: basicAuth(keyId, keySecret) },
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) throw Object.assign(new Error(`Razorpay payments lookup failed (${res.status})`), { status: res.status })
  const data = await res.json()
  return Array.isArray(data?.items) ? data.items : []
}

// The payment that settled this order, if any (captured first, then authorized).
export function pickPaidPayment(payments) {
  const paid = (payments ?? []).filter((p) => PAID_STATUSES.has(p?.status) && p?.id)
  return paid.find((p) => p.status === 'captured') ?? paid[0] ?? null
}

const sameEmail = (a, b) => typeof a === 'string' && typeof b === 'string' && a.trim().toLowerCase() === b.trim().toLowerCase()

/** Orders still worth asking Razorpay about: this email, never verified, recent. */
export function ordersToReconcile(orders, email, now = Date.now()) {
  return orders.filter(
    (o) => sameEmail(o.email, email) && o.status === 'created' && now - Date.parse(o.createdAt ?? o.updatedAt ?? 0) < RECONCILE_MAX_AGE_MS,
  )
}

/** A verified payment of this email that no interview has used yet (oldest first). */
export function unusedPayment(orders, email) {
  return (
    orders
      .filter((o) => sameEmail(o.email, email) && o.status === 'verified' && !o.used && o.paymentId)
      .sort((a, b) => Date.parse(a.updatedAt ?? 0) - Date.parse(b.updatedAt ?? 0))[0] ?? null
  )
}
