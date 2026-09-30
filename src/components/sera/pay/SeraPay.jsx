import { useRef, useState } from 'react'
import GlassBlobs from '../login/GlassBlobs'
import OrderSummary from './OrderSummary'
import PriceBreakdown from './PriceBreakdown'
import { SERA_VISITOR_PLAN, formatRupees } from '../../../config/seraPricing'
import { INTERVIEW_LENGTH_LABEL } from '../../../config/seraRounds'
import { createOrder, verifyPayment } from '../../../services/seraPaymentService'
import { isMockMode } from '../../../services/seraAuthService'
import { loadRazorpayScript, openRazorpayCheckout } from '../../../utils/razorpay'
import { takeMockPayOutcome } from '../../../services/seraMockCall'

const FAILED = "Payment didn't go through. You haven't been charged — try again."
const METHODS = ['UPI', 'Cards', 'Netbanking', 'Wallets']

const LockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
)

const Spinner = () => <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin motion-reduce:animate-none" />

// New User pay screen (route 'visitor'). The interview starts only after the SERVER verifies the
// payment (verifyPayment) — never on the checkout callback alone.
function SeraPay({ session, fileName, onPaymentSuccess, onChangeResume }) {
  // idle | opening | checkout | verifying
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)
  const lockRef = useRef(false) // one order per click, even on a fast double-click

  const release = (message = null) => {
    lockRef.current = false
    setStatus('idle')
    if (message) setError(message)
  }

  const confirm = async ({ orderId, paymentId, signature }) => {
    setStatus('verifying')
    const result = await verifyPayment({ orderId, paymentId, signature })
    if (result.ok) onPaymentSuccess({ orderId, paymentId: result.paymentId })
    else release(result.error || FAILED)
  }

  const pay = async () => {
    if (lockRef.current) return
    lockRef.current = true
    setError(null)
    setStatus('opening')

    const order = await createOrder({ email: session?.email, phone: session?.phone, objectKey: session?.resume.objectKey })
    if (!order.ok) {
      release(order.error || FAILED)
      return
    }

    // DEV ONLY — mock pass-through: a short "Processing…", then straight into
    // the interview. Failure / closed are armed from the DEV panel instead.
    if (import.meta.env.DEV && isMockMode()) {
      await new Promise((resolve) => setTimeout(resolve, 300))
      const outcome = takeMockPayOutcome()
      if (outcome === 'fail') release(FAILED)
      else if (outcome === 'close') release()
      else confirm({ orderId: order.orderId, paymentId: `pay_mock_${Date.now()}`, signature: 'mock-signature' })
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
        description: `Sera AI Interview · 3 rounds, ${INTERVIEW_LENGTH_LABEL}`,
        prefill: { email: session?.email, contact: session?.phone },
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
  const mockPay = import.meta.env.DEV && isMockMode()
  const label = {
    idle: `Pay ${formatRupees(SERA_VISITOR_PLAN.pricePaise)}`,
    opening: mockPay ? 'Processing…' : 'Opening payment…',
    checkout: 'Complete payment in the popup…',
    verifying: mockPay ? 'Processing…' : 'Confirming payment…',
  }[status]

  return (
    <div className="w-full flex flex-col items-center">
      <div className="relative w-full max-w-[440px]">
        <GlassBlobs />

        <div className="relative rounded-[26px] border border-white/10 light:border-white/80 bg-card/55 light:bg-white/55 backdrop-blur-[22px] shadow-[0_24px_60px_rgba(0,0,0,0.45)] light:shadow-[0_24px_60px_rgba(76,29,149,0.14)] p-6 sm:p-8 text-left">
          <OrderSummary email={session?.email} fileName={fileName} />
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
    </div>
  )
}

export default SeraPay
