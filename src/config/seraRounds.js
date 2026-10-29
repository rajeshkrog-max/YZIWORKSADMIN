// The interview — the SAME three rounds for both routes (New User and Student):
// Screening 5 min → Pick an offer (no timer) → HR round 3 min → Final round 3 min
// (about 13 minutes planned). The only route difference is payment: New User pays,
// Student uses an institute code.
//
// The times are what the page SHOWS and what the server's round timers enforce (netlify/lib/seraVapi/rounds.js:
// "time is nearly up" / "time is up" notes into the live call). HR is 4 minutes because Vinit tells candidates
// "about four minutes"; a real call measured Vinit at about 3:25 without notes.
//
// Each timed round has its own interviewer (a member of ONE Vapi squad call:
// Sera → Vinit → Sonia). The offer choice has no interviewer and no voice; the
// call stays open but silent, so the page caps it (OFFER_PICK_SECONDS).
// The final round's id stays "final" (the code once called her Arvind).
export const SERA_ROUNDS = [
  { id: 'screening', label: 'Screening', seconds: 300, turnSeconds: 45, interviewer: { name: 'Sera', title: 'AI interviewer' } },
  { id: 'offer', label: 'Pick an offer', seconds: null, turnSeconds: null, interviewer: null },
  { id: 'hr', label: 'HR round', seconds: 240, turnSeconds: 45, interviewer: { name: 'Vinit', title: 'HR' } },
  { id: 'final', label: 'Final round', seconds: 240, turnSeconds: 45, interviewer: { name: 'Sonia', title: 'Final round' } },
]

// Shown wherever the flow mentions its length.
// The offer pick runs on the open call — if the candidate doesn't tap, offers[0] is chosen.
export const OFFER_PICK_SECONDS = 45

export const INTERVIEW_LENGTH_LABEL = 'about 13 minutes'

// Same rounds for every route; kept as a function so callers stay route-aware
// if that ever changes.
export const roundsFor = () => SERA_ROUNDS

// 300 → "5 min", null → "no timer"
export const formatRoundLength = (seconds) => (seconds == null ? 'no timer' : `${Math.round(seconds / 60)} min`)
