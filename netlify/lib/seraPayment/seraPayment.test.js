import test from 'node:test'
import assert from 'node:assert/strict'
import { listOrderPayments, ordersToReconcile, pickPaidPayment, unusedPayment } from './index.js'

const NOW = Date.parse('2026-10-26T12:00:00Z')
const ago = (h) => new Date(NOW - h * 3600 * 1000).toISOString()

test('pickPaidPayment: captured first, then authorized; failed and created never count', () => {
  assert.equal(pickPaidPayment([{ id: 'a', status: 'failed' }, { id: 'b', status: 'created' }]), null)
  assert.equal(pickPaidPayment([{ id: 'a', status: 'authorized' }, { id: 'b', status: 'captured' }]).id, 'b')
  assert.equal(pickPaidPayment([{ id: 'a', status: 'authorized' }]).id, 'a')
  assert.equal(pickPaidPayment(undefined), null)
})

test('ordersToReconcile: only this email, only unverified, only recent', () => {
  const orders = [
    { orderId: '1', email: 'Priya@Example.com', status: 'created', createdAt: ago(1) },
    { orderId: '2', email: 'priya@example.com', status: 'verified', createdAt: ago(1) },
    { orderId: '3', email: 'other@example.com', status: 'created', createdAt: ago(1) },
    { orderId: '4', email: 'priya@example.com', status: 'created', createdAt: ago(24 * 4) },
  ]
  assert.deepEqual(ordersToReconcile(orders, 'priya@example.com', NOW).map((o) => o.orderId), ['1'])
})

test('unusedPayment: a verified, unused payment of this email, oldest first', () => {
  const orders = [
    { orderId: 'new', email: 'p@example.com', status: 'verified', used: false, paymentId: 'pay_2', updatedAt: ago(1) },
    { orderId: 'old', email: 'p@example.com', status: 'verified', used: false, paymentId: 'pay_1', updatedAt: ago(2) },
    { orderId: 'used', email: 'p@example.com', status: 'verified', used: true, paymentId: 'pay_0', updatedAt: ago(3) },
  ]
  assert.equal(unusedPayment(orders, 'P@example.com').orderId, 'old')
  assert.equal(unusedPayment(orders, 'q@example.com'), null)
})

test('listOrderPayments: basic auth with the key pair, items from the collection', async () => {
  let seen
  const fetchImpl = async (url, init) => {
    seen = { url, auth: init.headers.Authorization }
    return { ok: true, json: async () => ({ entity: 'collection', items: [{ id: 'pay_1', status: 'captured' }] }) }
  }
  const items = await listOrderPayments('order_1', { keyId: 'k', keySecret: 's', env: {}, fetchImpl })
  assert.equal(seen.url, 'https://api.razorpay.com/v1/orders/order_1/payments')
  assert.equal(seen.auth, `Basic ${Buffer.from('k:s').toString('base64')}`)
  assert.equal(items[0].id, 'pay_1')
  await assert.rejects(listOrderPayments('o', { keyId: 'k', keySecret: 's', env: {}, fetchImpl: async () => ({ ok: false, status: 401 }) }), { status: 401 })
})
