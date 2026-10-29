// Razorpay Checkout — same load-once pattern as src/utils/msg91.js.

export function loadRazorpayScript() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) {
      resolve()
      return
    }

    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Razorpay script'))
    document.head.appendChild(script)
  })
}

// options: standard Razorpay Checkout options. `onPaymentFailed` (optional) is
// wired to the `payment.failed` event. Returns the checkout instance.
export function openRazorpayCheckout({ onPaymentFailed, ...options }) {
  if (typeof window.Razorpay !== 'function') {
    throw new Error('Razorpay not loaded')
  }
  const checkout = new window.Razorpay(options)
  if (onPaymentFailed) checkout.on('payment.failed', onPaymentFailed)
  checkout.open()
  return checkout
}
