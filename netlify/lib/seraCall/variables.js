// Retell dynamic variables for each round's agent. Pure: no env, no network.
// The exact lists per agent are in docs/sera-interview-contract.md.
import { cleanFirstName } from './cleanFirstName.js'
import { getChosenOffer } from '../../../src/shared/seraSession.js'

export const CALL_ROUNDS = ['screening', 'hr', 'final']

// 6, 8 → "₹6–8 LPA"
export const formatCtcRange = (min, max) => `₹${min}–${max} LPA`

// session: src/shared/seraSession.js. round: 'screening' | 'hr' | 'final'.
// Every value is a string (Retell substitutes them as text).
export function buildCallVariables(session, round) {
  if (!CALL_ROUNDS.includes(round)) throw new Error(`Unknown Sera round "${round}"`)
  const first_name = cleanFirstName(session?.firstName) || 'there'

  if (round === 'screening') {
    return {
      first_name,
      field: session?.resume?.field ?? '',
      resume_highlight: session?.resume?.highlight ?? '',
    }
  }

  const offer = getChosenOffer(session)
  if (!offer) throw new Error(`Sera ${round} round needs the chosen offer — none on the session`)

  const hr = {
    first_name,
    company: offer.company,
    city: offer.city,
    work_mode: offer.workMode,
    role: offer.role,
    ctc_range: formatCtcRange(offer.ctcMinLpa, offer.ctcMaxLpa),
    requirements: offer.skills.join(', '),
    screening_summary: session?.summaries?.screening ?? '',
  }
  if (round === 'hr') return hr

  return {
    ...hr,
    hr_summary: session?.summaries?.hr ?? '',
    final_twist: offer.finalTwist,
  }
}
