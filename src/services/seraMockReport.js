// DEV ONLY — the sample report shown in mock mode. It is NOT hand-written: it
// runs the real pipeline (netlify/lib/seraReport) on the sample interview
// fixture, so it passes validate() and every quote is really in the transcript.
// Only imported behind `import.meta.env.DEV` checks, so it never ships.
// It always uses the fixture's practice offer (the sample interview is about it).
import { buildReport } from '../../netlify/lib/seraReport/index.js'
import { SAMPLE_LLM_OUTPUT, SAMPLE_OFFER, SAMPLE_TRANSCRIPT } from '../../netlify/lib/seraReport/fixtures/sampleInterview.js'
import { roundsFor } from '../config/seraRounds.js'

// variant 'gaps': Composure has no evidence and the final round was cut short
// — to check that missing data hides instead of showing empty.
export function buildMockReport({ route = 'student', firstName = 'Priya', variant = null } = {}) {
  const student = route === 'student'
  let transcript = student ? SAMPLE_TRANSCRIPT : SAMPLE_TRANSCRIPT.filter((t) => t.round === 'screening')
  let llmJson = student
    ? SAMPLE_LLM_OUTPUT
    : {
        ...SAMPLE_LLM_OUTPUT,
        answers: SAMPLE_LLM_OUTPUT.answers.filter((a) => a.round === 'screening'),
        skillQuotes: Object.fromEntries(
          Object.entries(SAMPLE_LLM_OUTPUT.skillQuotes).map(([id, q]) => [id, q?.round === 'screening' ? q : null]),
        ),
        strengths: SAMPLE_LLM_OUTPUT.strengths.filter((p) => p.round === 'screening'),
        growth: SAMPLE_LLM_OUTPUT.growth.filter((p) => p.round === 'screening'),
        rewrite: null,
        offerFit: [],
        roundNotes: { screening: SAMPLE_LLM_OUTPUT.roundNotes.screening, hr: null, final: null },
      }

  if (variant === 'gaps') {
    transcript = transcript.filter((t) => t.round !== 'final' || t.start < 62)
    llmJson = {
      ...llmJson,
      answers: llmJson.answers.map((a) => ({ ...a, ratings: { ...a.ratings, composure: null } })),
      skillQuotes: { ...llmJson.skillQuotes, composure: null },
    }
  }

  const { report } = buildReport({
    llmJson,
    transcript,
    route: student ? 'student' : 'visitor',
    plannedRounds: roundsFor(route),
    chosenOffer: student ? SAMPLE_OFFER : null,
    firstName,
    interviewDate: new Date().toISOString().slice(0, 10),
  })
  return report
}
