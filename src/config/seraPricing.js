// Display prices for the New User pay screen (internal route id 'visitor'). The amount actually charged comes
// from the server's Razorpay order — the browser never decides it.
export const SERA_VISITOR_PLAN = { mrpPaise: 49900, pricePaise: 24900, offerLabel: 'Launch offer', currency: 'INR' }

// 24900 → "₹249"
export const formatRupees = (paise) => `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
