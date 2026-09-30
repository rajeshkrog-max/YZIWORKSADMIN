// Prompt + strict JSON schema for the 3 practice offers. Pure: no env, no network.

export const OFFERS_LLM_OPTIONS = { temperature: 0.3 }

export const WORK_MODES = ['On-site', 'Hybrid', 'Remote']

const str = { type: 'string' }

// OpenAI strict json_schema (every property required).
export const OFFERS_LLM_SCHEMA = {
  type: 'object',
  properties: {
    offers: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          company: str,
          logoLetter: str,
          industry: str,
          city: str,
          workMode: { type: 'string', enum: WORK_MODES },
          role: str,
          ctcMinLpa: { type: 'number' },
          ctcMaxLpa: { type: 'number' },
          skills: { type: 'array', items: str },
          whyFit: str,
          finalTwist: str,
        },
        required: ['company', 'logoLetter', 'industry', 'city', 'workMode', 'role', 'ctcMinLpa', 'ctcMaxLpa', 'skills', 'whyFit', 'finalTwist'],
        additionalProperties: false,
      },
    },
  },
  required: ['offers'],
  additionalProperties: false,
}

// resumeText: text from sera-extract-resume; field / highlight: from the same check.
export function buildOffersPrompt({ resumeText, field, highlight }) {
  return `You are creating 3 PRACTICE job offers for an entry-level candidate in India, based on their résumé. They will pick one and do a practice HR round and final round for it.

RULES — follow all of them:
1. Exactly 3 offers. They must differ in role or industry (no two offers with the same role in the same industry).
2. company: an INVENTED company name. Never a real, well-known company (no TCS, Infosys, Wipro, Google, Amazon, Flipkart, Zomato, etc.) and never a close imitation of one. logoLetter = the first letter of the company name, uppercase.
3. industry: 1–3 words (e.g. "Retail", "Fintech", "Logistics").
4. city: a real Indian city. workMode: one of ${WORK_MODES.join(', ')}.
5. role: a realistic next role for THIS candidate's level and field.
6. ctcMinLpa / ctcMaxLpa: realistic annual CTC in lakhs (LPA) for India and this candidate's level; ctcMinLpa < ctcMaxLpa, a range of 1 to 4 LPA.
7. skills: exactly 3 short skills, drawn from the résumé and what the role needs.
8. whyFit: ONE line tying the offer to a real, specific detail from the résumé. Never invent experience.
9. finalTwist: ONE realistic situation the final-round interviewer will bring up, e.g. relocation, an earlier joining date, the lower end of the CTC range, a routine first project, a rotating shift. Plain words, one sentence.
10. Simple English. No empty strings. Output JSON only, matching the schema.

Field: ${field || 'not given'}
Résumé highlight: ${highlight || 'not given'}
Résumé text:
"""
${String(resumeText ?? '').slice(0, 6000)}
"""`
}
