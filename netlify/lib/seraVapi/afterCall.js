// What happens to an interview once its call has ended. Pure.
//
// Rule confirmed with the owner on 2026-10-26 (spec 0002):
//  - The call ended BEFORE the offers appeared and the candidate did not press End, and Sera did not
//    end it herself: a network drop, a provider error, a refresh or a closed tab. The candidate gets ONE
//    free restart from Sera (no new payment, no new seat). So one interview costs at most two calls.
//  - After that, or after the offers: the ONE report is built from whatever was said. A candidate who
//    said nothing at all gets no report (incomplete, no language model cost).
import { decideOutcome } from './webhook.js'

export const MAX_RESTARTS = 1

// Sera (or the max duration) ended the call on purpose: not a drop, so no restart.
const ENDED_BY_INTERVIEW = new Set(['assistant-ended-call', 'assistant-said-end-call-phrase', 'exceeded-max-duration'])

/** Did the interview get past screening (offers shown, an offer picked, or a later round)? */
export function reachedOffers(vapi) {
  return Boolean(vapi?.offersShownAt || vapi?.handoffSent || (vapi?.round && vapi.round !== 'screening'))
}

/**
 * → 'restart' | 'report' | 'incomplete'
 * `restartsUsed` counts restarts this interview already had.
 */
export function decideAfterCall({ endedReason, transcripts, candidateEnded, offersReached, restartsUsed = 0 }) {
  if (!offersReached && !candidateEnded && !ENDED_BY_INTERVIEW.has(endedReason) && restartsUsed < MAX_RESTARTS) return 'restart'
  // A drop after the offers (or a second drop) is no longer a dead end: report on what was said.
  return decideOutcome({ endedReason, transcripts, candidateEnded: true }) === 'incomplete' ? 'incomplete' : 'report'
}
