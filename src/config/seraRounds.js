// The interview — the SAME three rounds for both routes (New User and Student):
// Screening 5 min → Pick an offer (no timer) → HR round 3 min → Final round 3 min
// (about 11 minutes). The only route difference is payment: New User pays,
// Student uses an institute code.
//
// Each timed round has its own interviewer (a separate voice agent). The offer
// choice has no timer and no interviewer — no call runs while choosing.
export const SERA_ROUNDS = [
  { id: 'screening', label: 'Screening', seconds: 300, turnSeconds: 45, interviewer: { name: 'Sera', title: 'AI interviewer' } },
  { id: 'offer', label: 'Pick an offer', seconds: null, turnSeconds: null, interviewer: null },
  { id: 'hr', label: 'HR round', seconds: 180, turnSeconds: 45, interviewer: { name: 'Vinit', title: 'HR' } },
  { id: 'final', label: 'Final round', seconds: 180, turnSeconds: 45, interviewer: { name: 'Arvind', title: 'Business Head' } },
]

// Shown wherever the flow mentions its length.
export const INTERVIEW_LENGTH_LABEL = 'about 11 minutes'

// Same rounds for every route; kept as a function so callers stay route-aware
// if that ever changes.
export const roundsFor = () => SERA_ROUNDS

// 300 → "5 min", null → "no timer"
export const formatRoundLength = (seconds) => (seconds == null ? 'no timer' : `${Math.round(seconds / 60)} min`)
