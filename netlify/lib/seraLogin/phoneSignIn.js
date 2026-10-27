// Sign in with only a WhatsApp number + OTP: reopens the interview that number already has.
// Pure: the server passes in the sessions and the reservation lookup.

// True only when MSG91 names exactly this number as the one it verified (with or without
// the 91 country code). A token for one number can never open another number's interview.
export function msg91NumberMatches(identifier, phone) {
  const digits = String(identifier ?? '').replace(/\D/g, '')
  const clean = String(phone ?? '').replace(/\D/g, '')
  return clean.length === 10 && (digits === `91${clean}` || digits === clean)
}

// How far an interview got; a further one wins when a number has several.
const progress = (s) => {
  if (s.report) return 5
  if (s.vapi?.callId) return 4
  if (s.offers?.length) return 3
  if (s.resume?.objectKey) return 2
  if (s.payment?.paymentId) return 1
  return 0
}

// sessions: every stored session. reservationFor(email) → the reservation or null.
// → the session to reopen, or null when this number has no interview.
// A session is skipped when its email's one interview is a different session (a stale login).
export async function pickPhoneSession(sessions, phone, reservationFor) {
  let best = null
  for (const s of sessions) {
    if (s.demo || !s.sessionId || s.phone !== phone) continue
    const reservation = s.email ? await reservationFor(s.email) : null
    if (reservation?.sessionId && reservation.sessionId !== s.sessionId) continue
    if (!best || progress(s) > progress(best)) best = s
  }
  return best
}
