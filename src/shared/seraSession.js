// The ONE Sera session shape — used by the hook, every screen, the services
// and the server modules in netlify/lib/ (seraOffers, seraCall, seraReport).
// Plain JS, no env, no network.
import { cleanFirstName } from '../../netlify/lib/seraCall/cleanFirstName.js'

/**
 * @typedef {'visitor' | 'student'} SeraRoute  'visitor' = "New User" (pays), 'student' = institute code
 * @typedef {'screening' | 'hr' | 'final'} SeraCallRound
 *
 * @typedef {Object} SeraTurn
 * @property {'agent' | 'user'} role
 * @property {string} text
 * @property {number} start  seconds from the start of that round's call
 * @property {number} end
 *
 * @typedef {Object} SeraOffer
 * @property {string} id
 * @property {string} company     invented, never a real company
 * @property {string} logoLetter
 * @property {string} industry
 * @property {string} city
 * @property {'On-site' | 'Hybrid' | 'Remote'} workMode
 * @property {string} role
 * @property {number} ctcMinLpa
 * @property {number} ctcMaxLpa
 * @property {string[]} skills    exactly 3
 * @property {string} whyFit
 * @property {string} finalTwist  the final round's realistic situation
 *
 * @typedef {Object} SeraRoundState
 * @property {string | null} callId
 * @property {'pending' | 'live' | 'completed' | 'cut_short' | 'dropped'} status
 * @property {SeraTurn[] | null} transcript
 *
 * @typedef {Object} SeraSession
 * @property {string | null} sessionId
 * @property {SeraRoute} route
 * @property {string} firstName   cleanFirstName() of the Google name
 * @property {string} email
 * @property {string} phone
 * @property {string | null} studentCode
 * @property {{ objectKey: string | null, highlight: string, field: string }} resume
 * @property {SeraOffer[]} offers  3, generated when the résumé is read
 * @property {string | null} chosenOfferId
 * @property {{ screening: SeraRoundState, hr: SeraRoundState, final: SeraRoundState }} rounds
 * @property {{ screening: string | null, hr: string | null }} summaries  2 neutral lines each
 * @property {{ orderId: string | null, paymentId: string | null }} payment  New User only
 * @property {object | null} report  src/shared/seraReportSchema.js
 * @property {SeraSessionStatus} status
 *
 * @typedef {'new' | 'reserved' | 'live' | 'completed' | 'ended_by_candidate' | 'dropped' | 'failed_to_start'} SeraSessionStatus
 */

export const CALL_ROUND_IDS = ['screening', 'hr', 'final']

const emptyRound = () => ({ callId: null, status: 'pending', transcript: null })

/**
 * A fresh session from the login ({ route, firstName | name, email, phone, studentCode }).
 * @returns {SeraSession}
 */
export function createSession(login = {}) {
  return {
    sessionId: login.sessionId ?? null,
    route: login.route === 'student' ? 'student' : 'visitor',
    firstName: cleanFirstName(login.firstName ?? login.name),
    email: login.email ?? '',
    phone: login.phone ?? '',
    studentCode: login.route === 'student' ? (login.studentCode ?? null) : null,
    resume: { objectKey: null, highlight: '', field: '' },
    offers: [],
    chosenOfferId: null,
    rounds: { screening: emptyRound(), hr: emptyRound(), final: emptyRound() },
    summaries: { screening: null, hr: null },
    payment: { orderId: null, paymentId: null },
    report: null,
    status: 'new',
  }
}

/** @returns {SeraOffer | null} */
export const getChosenOffer = (session) =>
  session?.offers?.find((o) => o.id === session.chosenOfferId) ?? null

/** Immutable update of one round: patchRound(session, 'hr', { status: 'live' }). */
export const patchRound = (session, round, patch) => ({
  ...session,
  rounds: { ...session.rounds, [round]: { ...session.rounds[round], ...patch } },
})
