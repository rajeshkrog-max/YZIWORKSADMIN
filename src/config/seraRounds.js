// Interview rounds per route. `seconds: null` = no timer (the offer choice).
// Visitors get one 5-minute round and no offers.
export const SERA_ROUNDS = {
  student: [
    { id: 'screening', label: 'Screening', seconds: 300 },
    { id: 'offer', label: 'Pick an offer', seconds: null },
    { id: 'hr', label: 'HR round', seconds: 180 },
    { id: 'final', label: 'Final round', seconds: 120 },
  ],
  visitor: [{ id: 'screening', label: 'Screening', seconds: 300 }],
}

// Max length of one candidate answer (the turn-timer ring).
export const SERA_TURN_SECONDS = { student: 45, visitor: 35 }

const routeKey = (route) => (route === 'student' ? 'student' : 'visitor')
export const roundsFor = (route) => SERA_ROUNDS[routeKey(route)]
export const turnSecondsFor = (route) => SERA_TURN_SECONDS[routeKey(route)]

// 300 → "5 min", null → "no timer"
export const formatRoundLength = (seconds) => (seconds == null ? 'no timer' : `${Math.round(seconds / 60)} min`)
