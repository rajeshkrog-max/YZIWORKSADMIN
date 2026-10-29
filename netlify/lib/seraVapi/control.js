// Live call control: after the candidate taps an offer card, tell the squad
// what they chose and hand the SAME call to Vinit. Pure builders + one POST.
import { buildCallVariables, formatCtcRange } from '../seraCall/variables.js'
import { SQUAD_MEMBERS } from './squad.js'

// The offer sentences already end in a full stop; don't double it.
const bare = (text) => String(text).trim().replace(/[.\s]+$/, '')

export function offerContextMessage(offer) {
  return (
    `Candidate chose ${offer.company}, ${offer.role}, ${offer.city}, ${offer.workMode}, CTC ${formatCtcRange(offer.ctcMinLpa, offer.ctcMaxLpa)}. ` +
    `Skills: ${offer.skills.join(', ')}. ` +
    `Why it fits: ${bare(offer.whyFit)}. ` +
    `Final-round situation: ${bare(offer.finalTwist)}. ` +
    'Use only this offer.'
  )
}

// Vinit's and Sonia's first messages use liquid variables ({{company}}, {{role}}...).
// A system message does not fill them, so the handoff carries them as variable values.
// Built by the same mapper as the call variables (buildCallVariables), not a second one.
const HANDOFF_VARIABLES = ['first_name', 'company', 'role', 'city', 'work_mode', 'ctc_range', 'requirements', 'final_twist']
export function offerHandoffVariables(session, offer) {
  const all = buildCallVariables({ ...session, chosenOfferId: offer.id }, 'final')
  return Object.fromEntries(HANDOFF_VARIABLES.map((key) => [key, all[key]]))
}

// The two control messages, in the order they must be sent.
export function buildOfferControlMessages(offer, variableValues) {
  return [
    {
      type: 'add-message',
      triggerResponseEnabled: false,
      message: { role: 'system', content: offerContextMessage(offer) },
    },
    {
      type: 'handoff',
      destination: {
        type: 'assistant',
        assistantName: SQUAD_MEMBERS.hr,
        ...(variableValues ? { assistantOverrides: { variableValues } } : {}),
      },
      // No spoken `content`: it played over Vinit's own greeting. The handoff is silent.
    },
  ]
}

export async function sendControlMessage(controlUrl, message, fetchImpl = fetch) {
  return postControl(controlUrl, message, fetchImpl)
}

async function postControl(controlUrl, message, fetchImpl) {
  const res = await fetchImpl(controlUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(message),
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) throw new Error(`Vapi control ${message.type} failed (${res.status}): ${await res.text().catch(() => '')}`)
}

// If Vapi rejects the live `handoff` control message, ask Sera to use her own
// handoff_to_assistant tool (she has one, pointing at Vinit).
export const SERA_HANDOFF_NUDGE = {
  type: 'add-message',
  triggerResponseEnabled: true,
  message: {
    role: 'system',
    content: 'The candidate has chosen their offer (see the message above). Hand over to Vinit now by calling handoff_to_assistant. Say nothing else.',
  },
}

// Sequential on purpose: the offer must be in Vinit's context before he speaks.
// → { via: 'handoff' | 'nudge' }. Throws if the offer context could not be added, or both handoff routes failed.
export async function sendOfferHandoff(controlUrl, offer, { variableValues, fetchImpl = fetch } = {}) {
  if (!controlUrl) throw new Error('No Vapi controlUrl stored for this session')
  const [addMessage, handoff] = buildOfferControlMessages(offer, variableValues)
  await postControl(controlUrl, addMessage, fetchImpl)
  try {
    await postControl(controlUrl, handoff, fetchImpl)
    return { via: 'handoff' }
  } catch (err) {
    console.warn('[Vapi] live handoff rejected, asking Sera to hand over:', err.message)
    await postControl(controlUrl, SERA_HANDOFF_NUDGE, fetchImpl)
    return { via: 'nudge' }
  }
}
