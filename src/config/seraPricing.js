// Display prices for the visitor pay screen. The amount actually charged comes
// from the server's Razorpay order — the browser never decides it.
export const SERA_VISITOR_PLAN = { mrpPaise: 49900, pricePaise: 24900, offerLabel: 'Launch offer', minutes: 5, currency: 'INR' }

// 24900 → "₹249"
export const formatRupees = (paise) => `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
