import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import GlassBlobs from '../login/GlassBlobs'
import OrderSummary from './OrderSummary'
import PriceBreakdown from './PriceBreakdown'
import { SERA_VISITOR_PLAN, formatRupees } from '../../../config/seraPricing'
import { createOrder, verifyPayment } from '../../../services/seraPaymentService'
import { isMockMode } from '../../../services/seraAuthService'
import { loadRazorpayScript, openRazorpayCheckout } from '../../../utils/razorpay'

const FAILED = "Payment didn't go through. You haven't been charged — try again."
const METHODS = ['UPI', 'Cards', 'Netbanking', 'Wallets']

const LockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
)

const Spinner = () => <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin motion-reduce:animate-none" />

// Mock mode only: stands in for Razorpay Checkout. Portalled to <body> so the
// glass card's backdrop-filter doesn't trap the fixed overlay inside it.
function MockCheckout({ amountPaise, onPay, onFail, onClose }) {
  return createPortal(
    <div className="fixed inset-0 z-[300] grid place-items-center bg-black/50 backdrop-blur-sm px-6" onClick={onClose}>
      <div
        role="dialog"
        aria-label="Checkout (mock)"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xs rounded-2xl bg-card border border-fg/10 p-5 text-left shadow-2xl"
      >
        <p className="text-[11px] font-semibold uppercase tracking-widest text-accent-orange-fg mb-1">Mock Razorpay</p>
        <h3 className="text-fg font-semibold">YZI Works</h3>
        <p className="text-xs text-fg/55 mt-1 mb-4">Sera AI Interview · {SERA_VISITOR_PLAN.minutes} min</p>
        <div className="flex flex-col gap-2">
          <button type="button" onClick={onPay} className="h-10 rounded-xl bg-emerald-500 text-white text-sm font-semibold">
            Pay {formatRupees(amountPaise)} (test)
          </button>
          <button type="button" onClick={onFail} className="h-10 rounded-xl border border-red-500/40 text-red-500 text-sm font-medium">
            Simulate failure
          </button>
          <button type="button" onClick={onClose} className="h-10 rounded-xl text-fg/60 hover:text-fg text-sm">
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

// Visitor pay screen. The interview starts only after the SERVER verifies the
// payment (verifyPayment) — never on the checkout callback alone.
function SeraPay({ profile, fileName, objectKey, onPaymentSuccess, onChangeResume }) {
  // idle | opening | checkout | verifying
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)
  const [mockOrder, setMockOrder] = useState(null)
  const lockRef = useRef(false) // one order per click, even on a fast double-click

  const release = (message = null) => {
    lockRef.current = false
    setStatus('idle')
    setMockOrder(null)
    if (message) setError(message)
  }

  const confirm = async ({ orderId, paymentId, signature }) => {
    setMockOrder(null)
    setStatus('verifying')
    const result = await verifyPayment({ orderId, paymentId, signature })
    if (result.ok) onPaymentSuccess(result.paymentId)
    else release(result.error || FAILED)
  }

  const pay = async () => {
    if (lockRef.current) return
    lockRef.current = true
    setError(null)
    setStatus('opening')

    const order = await createOrder({ email: profile?.email, phone: profile?.phone, objectKey })
    if (!order.ok) {
      release(order.error || FAILED)
      return
    }

    if (isMockMode()) {
      setMockOrder(order)
      setStatus('checkout')
      return
    }

    try {
      await loadRazorpayScript()
      openRazorpayCheckout({
        key: order.keyId || import.meta.env.VITE_RAZORPAY_KEY_ID,
        order_id: order.orderId,
        amount: order.amountPaise,
        currency: order.currency,
        name: 'YZI Works',
        description: `Sera AI Interview · ${SERA_VISITOR_PLAN.minutes} min`,
        prefill: { email: profile?.email, contact: profile?.phone },
        theme: { color: '#8B5CF6' },
        handler: (response) =>
          confirm({
            orderId: response.razorpay_order_id,
            paymentId: response.razorpay_payment_id,
            signature: response.razorpay_signature,
          }),
        // Closing the popup isn't an error: just re-enable the button.
        modal: { ondismiss: () => release() },
        onPaymentFailed: () => setError(FAILED),
      })
      setStatus('checkout')
    } catch {
      release("Couldn't open the payment window. You haven't been charged — try again.")
    }
  }

  const busy = status !== 'idle'
  const label = {
    idle: `Pay ${formatRupees(SERA_VISITOR_PLAN.pricePaise)}`,
    opening: 'Opening payment…',
    checkout: 'Complete payment in the popup…',
    verifying: 'Confirming payment…',
  }[status]

  return (
    <div className="w-full flex flex-col items-center">
      <div className="relative w-full max-w-[440px]">
        <GlassBlobs />

        <div className="relative rounded-[26px] border border-white/10 light:border-white/80 bg-card/55 light:bg-white/55 backdrop-blur-[22px] shadow-[0_24px_60px_rgba(0,0,0,0.45)] light:shadow-[0_24px_60px_rgba(76,29,149,0.14)] p-6 sm:p-8 text-left">
          <OrderSummary email={profile?.email} fileName={fileName} />
          <PriceBreakdown />

          <section className="pt-5 border-t border-fg/10 text-center">
            <button
              type="button"
              onClick={pay}
              disabled={busy}
              className="w-full h-[52px] flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-yzi-orange via-yzi-pink to-yzi-purple text-white font-semibold transition hover:brightness-110 disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:brightness-100"
            >
              {status === 'opening' || status === 'verifying' ? <Spinner /> : <LockIcon />}
              {label}
            </button>

            <p className="mt-3 text-xs text-fg/55">Payments secured by Razorpay</p>
            <div className="mt-2 flex flex-wrap justify-center gap-1.5">
              {METHODS.map((method) => (
                <span key={method} className="px-2 py-0.5 rounded-md border border-fg/15 text-[11px] text-fg/55">
                  {method}
                </span>
              ))}
            </div>

            {error && <p className="mt-3 text-xs text-red-400 light:text-red-600">{error}</p>}

            {/* TODO: link Terms and Refund Policy once those pages exist (no routes yet). */}
            <p className="mt-4 text-[11px] text-fg/40">By paying you agree to our Terms and Refund Policy.</p>

            <button
              type="button"
              onClick={onChangeResume}
              disabled={busy}
              className="mt-3 text-xs text-fg/60 underline underline-offset-2 hover:text-fg disabled:opacity-50"
            >
              Use a different résumé
            </button>
          </section>
        </div>
      </div>

      {mockOrder && (
        <MockCheckout
          amountPaise={mockOrder.amountPaise}
          onPay={() => confirm({ orderId: mockOrder.orderId, paymentId: `pay_mock_${Date.now()}`, signature: 'mock-signature' })}
          onFail={() => release(FAILED)}
          onClose={() => release()}
        />
      )}
    </div>
  )
}

export default SeraPay
