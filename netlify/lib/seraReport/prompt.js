// Builds the report prompt and the strict JSON schema for the LLM's answer.
// Pure: no env, no network. The LLM only RATES (1–5) and QUOTES; every number
// on the report is computed in code afterwards (scoring.js, metrics.js).
import { SERA_SKILLS } from '../../../src/config/seraRubric.js'
import { formatTimestamp } from '../../../src/shared/seraReportSchema.js'

// Call the LLM with a low temperature (if the model supports it) and JSON output only.
export const REPORT_LLM_OPTIONS = { temperature: 0.2 }

const SKILL_IDS = SERA_SKILLS.map((s) => s.id)
const nullable = (schema) => ({ anyOf: [schema, { type: 'null' }] })
const moment = {
  round: { type: 'string', enum: ['screening', 'hr', 'final'] },
  timestamp: { type: 'number' },
}
const quote = {
  type: 'object',
  properties: { text: { type: 'string' }, ...moment },
  required: ['text', 'round', 'timestamp'],
  additionalProperties: false,
}
const point = {
  type: 'object',
  properties: { text: { type: 'string' }, ...moment },
  required: ['text', 'round', 'timestamp'],
  additionalProperties: false,
}

// OpenAI strict json_schema (every property required; "optional" = nullable).
export const REPORT_LLM_SCHEMA = {
  type: 'object',
  properties: {
    answers: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          ...moment,
          ratings: {
            type: 'object',
            properties: Object.fromEntries(SKILL_IDS.map((id) => [id, nullable({ type: 'integer', minimum: 1, maximum: 5 })])),
            required: SKILL_IDS,
            additionalProperties: false,
          },
        },
        required: ['round', 'timestamp', 'ratings'],
        additionalProperties: false,
      },
    },
    skillQuotes: {
      type: 'object',
      properties: Object.fromEntries(SKILL_IDS.map((id) => [id, nullable(quote)])),
      required: SKILL_IDS,
      additionalProperties: false,
    },
    summary: nullable({ type: 'string' }),
    roundNotes: {
      type: 'object',
      properties: { screening: nullable({ type: 'string' }), hr: nullable({ type: 'string' }), final: nullable({ type: 'string' }) },
      required: ['screening', 'hr', 'final'],
      additionalProperties: false,
    },
    strengths: { type: 'array', items: point },
    growth: { type: 'array', items: point },
    rewrite: nullable({
      type: 'object',
      properties: { question: { type: 'string' }, youSaid: { type: 'string' }, stronger: { type: 'string' }, ...moment },
      required: ['question', 'youSaid', 'stronger', 'round', 'timestamp'],
      additionalProperties: false,
    }),
    offerFit: {
      type: 'array',
      items: {
        type: 'object',
        properties: { requirement: { type: 'string' }, shown: { type: 'boolean' }, quote: nullable(quote) },
        required: ['requirement', 'shown', 'quote'],
        additionalProperties: false,
      },
    },
    plan: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          horizon: { type: 'string', enum: ['30d', '1-3m', '6-12m'] },
          title: { type: 'string' },
          text: { type: 'string' },
          skills: { type: 'array', items: { type: 'string' } },
        },
        required: ['horizon', 'title', 'text', 'skills'],
        additionalProperties: false,
      },
    },
  },
  required: ['answers', 'skillQuotes', 'summary', 'roundNotes', 'strengths', 'growth', 'rewrite', 'offerFit', 'plan'],
  additionalProperties: false,
}

const formatTranscript = (transcript) =>
  transcript
    .map((t) => `[${t.round} ${formatTimestamp(t.start)} | t=${t.start}] ${t.role === 'agent' ? 'Sera' : 'Candidate'}: ${t.text}`)
    .join('\n')

const formatRubric = () =>
  SERA_SKILLS.map(
    (s) => `${s.id} (${s.label}):\n${Object.entries(s.anchors).map(([n, text]) => `  ${n} = ${text}`).join('\n')}`,
  ).join('\n\n')

// transcript: [{ role: 'agent'|'user', text, start, end, round }]
// resumeHighlights: short string from the résumé check (background only)
// route: 'student' | 'visitor'; rounds: the round ids that ran; chosenOffer: { company, role, skills } | null
export function buildReportPrompt({ transcript, resumeHighlights, route, rounds, chosenOffer }) {
  const offerBlock =
    route === 'student' && chosenOffer
      ? `The candidate chose a PRACTICE offer: ${chosenOffer.role} at ${chosenOffer.company} (an invented company).
Offer requirements to check, in this order: ${chosenOffer.skills.join('; ')}.`
      : 'No offer (visitor interview). Return offerFit as an empty array.'

  return `You are writing the evidence for a practice interview report. Sera, an AI interviewer, just interviewed an entry-level candidate. You RATE and QUOTE only — code computes every score afterwards.

RULES — follow all of them:
1. For every candidate answer, rate each skill 1–5 using ONLY the anchored rubric below, judged for this role at ENTRY level. Use null for any skill the answer gives no evidence for. Identify each answer by its round and its "t=" start time exactly as shown in the transcript.
2. Every quote MUST be copied WORD FOR WORD from the candidate's lines in the transcript (a continuous span, at least 4 words). Give the round and the "t=" start time of that line. Never paraphrase inside a quote, never quote Sera.
3. If there is not enough evidence for a skill or a round, return null. NEVER guess, never fill gaps.
4. Every strength and growth point must point to one specific moment (round + t= of the candidate line it is about). At most 3 of each.
5. offerFit: mark a requirement "shown": true ONLY if a word-for-word quote supports it; otherwise "shown": false with quote null.
6. Company names are practice examples only. Never mention or invent real companies.
7. Plain, direct language, addressed to the candidate as "you". No praise without evidence. No filler, no flattery.
8. rewrite: pick ONE candidate answer that could be stronger. "question" = Sera's question copied from the transcript, "youSaid" = the candidate's answer copied word for word, "stronger" = a better answer that uses ONLY facts the candidate actually mentioned (do not invent achievements or numbers).
9. plan: exactly 3 steps (horizons "30d", "1-3m", "6-12m"), each with 2 skills, tied to the gaps you found.
10. summary: 2–3 sentences. roundNotes: one line per round that ran (${rounds.join(', ')}); null for a round that did not run or has no evidence.
11. Output JSON only, matching the schema.

RUBRIC (anchors per skill):
${formatRubric()}

${offerBlock}

Résumé highlights (background only — never quote the résumé, never rate from it):
"""
${(resumeHighlights || '').slice(0, 1500)}
"""

TRANSCRIPT:
"""
${formatTranscript(transcript)}
"""`
}
