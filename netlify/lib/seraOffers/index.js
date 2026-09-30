// The 3 practice offers, generated once when the résumé is read and stored on
// the session (src/shared/seraSession.js). Pure: the caller passes the LLM call.
import { buildOffersPrompt, OFFERS_LLM_OPTIONS, OFFERS_LLM_SCHEMA } from './prompt.js'
import { validateOffers } from './validate.js'

export { buildOffersPrompt, OFFERS_LLM_OPTIONS, OFFERS_LLM_SCHEMA, WORK_MODES } from './prompt.js'
export { validateOffers } from './validate.js'

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

// llmCall({ prompt, schema, options }) → parsed JSON (e.g. generateJson from
// netlify/lib/openai.js). input: { resumeText, field, highlight }.
// → offers[3]. Throws after one failed retry — never returns broken offers.
export async function generateOffers(llmCall, input) {
  const prompt = buildOffersPrompt(input)
  const problems = []
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const json = await llmCall({ prompt, schema: OFFERS_LLM_SCHEMA, options: OFFERS_LLM_OPTIONS })
      const { valid, errors } = validateOffers(json)
      if (valid) return json.offers.map(toOffer)
      problems.push(`attempt ${attempt}: ${errors.join('; ')}`)
    } catch (err) {
      problems.push(`attempt ${attempt}: ${err?.message || err}`)
    }
  }
  throw new Error(`Sera offers: no valid offers after ${MAX_ATTEMPTS} attempts (${problems.join(' | ')})`)
}
