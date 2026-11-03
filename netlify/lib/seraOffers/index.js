// The 3 practice offers, generated once when the résumé is read and stored on
// the session (src/shared/seraSession.js). Pure: the caller passes the LLM call.
import { buildOffersPrompt, OFFERS_LLM_OPTIONS, OFFERS_LLM_SCHEMA } from './prompt.js'
import { validateOffers } from './validate.js'
import { repairOffers } from './repair.js'

export { buildOffersPrompt, OFFERS_LLM_OPTIONS, OFFERS_LLM_SCHEMA, WORK_MODES } from './prompt.js'
export { validateOffers } from './validate.js'
export { repairOffers } from './repair.js'

const MAX_ATTEMPTS = 2 // first try + one retry

// Validated LLM offer → the stored offer (trimmed, with a stable id).
const toOffer = (o, i) => ({
  id: `offer-${i + 1}`,
  company: o.company.trim(),
  logoLetter: o.logoLetter.trim(),
  industry: o.industry.trim(),
  city: o.city.trim(),
  workMode: o.workMode,
  role: o.role.trim(),
  ctcMinLpa: o.ctcMinLpa,
  ctcMaxLpa: o.ctcMaxLpa,
  skills: o.skills.map((s) => s.trim()),
  whyFit: o.whyFit.trim(),
  finalTwist: o.finalTwist.trim(),
})

// The retry prompt: the same prompt plus what was wrong last time, so the model does not
// repeat the same mistake (before, the retry sent the identical prompt and often failed the same way).
export function withFeedback(prompt, errors) {
  if (!errors?.length) return prompt
  return `${prompt}

YOUR PREVIOUS ANSWER WAS REJECTED. Fix these problems and answer again with all 3 offers:
${errors.slice(0, 12).map((e) => `- ${e}`).join('\n')}`
}

// llmCall({ prompt, schema, options }) → parsed JSON (e.g. generateJson from
// netlify/lib/openai.js). input: { resumeText, field, highlight }.
// Each answer is repaired (repairOffers: skills cut to 3, logo letter, CTC clamped, real-company
// names renamed) and then strictly validated. A retry carries the previous errors.
// → offers[3]. Throws after one failed retry — never returns broken offers.
// onAttempt({ attempt, ok, errors }) is an optional logging hook.
export async function generateOffers(llmCall, input, { onAttempt = () => {} } = {}) {
  const basePrompt = buildOffersPrompt(input)
  const problems = []
  let lastErrors = []
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const prompt = withFeedback(basePrompt, lastErrors)
      const json = repairOffers(await llmCall({ prompt, schema: OFFERS_LLM_SCHEMA, options: OFFERS_LLM_OPTIONS }))
      const { valid, errors } = validateOffers(json)
      onAttempt({ attempt, ok: valid, errors })
      if (valid) return json.offers.map(toOffer)
      lastErrors = errors
      problems.push(`attempt ${attempt}: ${errors.join('; ')}`)
    } catch (err) {
      onAttempt({ attempt, ok: false, errors: [String(err?.message || err)] })
      problems.push(`attempt ${attempt}: ${err?.message || err}`)
    }
  }
  throw new Error(`Sera offers: no valid offers after ${MAX_ATTEMPTS} attempts (${problems.join(' | ')})`)
}
