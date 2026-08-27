export const REPORT_SCHEMA = {
  type: 'object',
  properties: {
    strengths: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 3 },
    growthAreas: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 3 },
    seraNote: { type: 'string' },
    roadmap: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          tier: { type: 'string' },
          role: { type: 'string' },
          description: { type: 'string' },
          skills: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 3 },
        },
        required: ['tier', 'role', 'description', 'skills'],
      },
      minItems: 3,
      maxItems: 3,
    },
  },
  required: ['strengths', 'growthAreas', 'seraNote', 'roadmap'],
}

export function buildReportPrompt({ candidateName, resumeText, transcript }) {
  return `You are Sera, an AI that just finished a warm, honest 5-minute voice interview with ${candidateName || 'a candidate'}. You are not an HR screener — you're an expert who tells people specifically where they're strong and where they're leaking marks, based on what they actually said, not generic advice.

Résumé text (for background only):
"""
${(resumeText || '').slice(0, 6000)}
"""

Interview transcript:
"""
${(transcript || '').slice(0, 8000)}
"""

Write the candidate's report:
- strengths: 2-3 specific, concrete observations tied to something they actually said or something in their résumé. Never generic ("good communicator").
- growthAreas: 2-3 specific, honest, constructive observations — real gaps, phrased kindly but directly.
- seraNote: one short, warm, first-person closing line from Sera, in quotes-worthy voice — specific to this person, not a template.
- roadmap: exactly 3 tiers — "now" (their current level, grounded in the résumé/interview), "next" (the realistic next step, with 2-3 skills to build), "later" (a longer-term aspiration, with 2-3 skills). Each needs a real one-line description tied to this candidate, not boilerplate career-ladder text.`
}
