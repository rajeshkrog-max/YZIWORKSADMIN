// Two neutral lines about a finished round, passed to the next interviewer
// (screening_summary → HR, hr_summary → Final). Pure: no env, no network.
import { formatTimestamp } from '../../../src/shared/seraReportSchema.js'

export const SUMMARY_LLM_OPTIONS = { temperature: 0.2 }

export const SUMMARY_LLM_SCHEMA = {
  type: 'object',
  properties: { lines: { type: 'array', items: { type: 'string' } } },
  required: ['lines'],
  additionalProperties: false,
}

const ROUND_NAMES = { screening: 'screening round', hr: 'HR round', final: 'final round' }

// transcript: [{ role: 'agent'|'user', text, start, end }] of ONE round.
export function buildSummaryPrompt(transcript, round) {
  const lines = (transcript ?? [])
    .map((t) => `[${formatTimestamp(t.start)}] ${t.role === 'agent' ? 'Interviewer' : 'Candidate'}: ${t.text}`)
    .join('\n')
  return `Summarise what the candidate said in this ${ROUND_NAMES[round] ?? round} of a practice interview, for the next interviewer.

RULES:
1. Exactly 2 short lines. Each line is one plain sentence.
2. Neutral and factual: only what the candidate actually said (their work, tools, examples, goals).
3. No scores, no ratings, no opinions, no advice, no adjectives like "good", "strong" or "weak".
4. Never invent anything that is not in the transcript. If they said very little, say so plainly.
5. Output JSON only: { "lines": ["...", "..."] }.

TRANSCRIPT:
"""
${lines}
"""`
}

// LLM JSON → the 2-line summary stored on the session ('' if unusable).
export const parseSummary = (json) =>
  (Array.isArray(json?.lines) ? json.lines : [])
    .map((line) => String(line ?? '').trim())
    .filter(Boolean)
    .slice(0, 2)
    .join('\n')
