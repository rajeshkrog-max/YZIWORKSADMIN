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
  // Both routes run the same 3 rounds and pick an offer — same sample interview.
  let transcript = SAMPLE_TRANSCRIPT
  let llmJson = SAMPLE_LLM_OUTPUT

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
    route: route === 'student' ? 'student' : 'visitor',
    plannedRounds: roundsFor(route),
    chosenOffer: SAMPLE_OFFER,
    firstName,
    interviewDate: new Date().toISOString().slice(0, 10),
  })
  return report
}
