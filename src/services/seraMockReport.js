// DEV ONLY — mock-mode data. NOT hand-written: it runs the real server modules
// (netlify/lib/seraOffers, seraCall, seraReport) on the fixtures in
// netlify/lib/fixtures, so localhost shows the real data shapes and every
// quote is really in the transcript. Only imported behind
// `import.meta.env.DEV` checks, so it never ships.
import { buildReport, generateReport, mergeRoundTranscripts } from '../../netlify/lib/seraReport/index.js'
import { generateOffers } from '../../netlify/lib/seraOffers/index.js'
import { SAMPLE_LLM_OUTPUT, SAMPLE_OFFER, SAMPLE_SUMMARIES, SAMPLE_TRANSCRIPTS } from '../../netlify/lib/fixtures/seraInterview.js'
import { SAMPLE_OFFERS_LLM_JSON } from '../../netlify/lib/fixtures/seraOffers.js'
import { SAMPLE_RESUME, SAMPLE_RESUME_TEXT } from '../../netlify/lib/fixtures/seraResume.js'
import { getChosenOffer } from '../shared/seraSession.js'
import { roundsFor } from '../config/seraRounds.js'

// A fake LLM that always answers with the given fixture.
const fixtureLlm = (json) => async () => structuredClone(json)

// Résumé check + offers, as prepareResume() returns them.
export async function mockPreparedResume(fileName) {
  const offers = await generateOffers(fixtureLlm(SAMPLE_OFFERS_LLM_JSON), {
    resumeText: SAMPLE_RESUME_TEXT,
    field: SAMPLE_RESUME.field,
    highlight: SAMPLE_RESUME.highlight,
  })
  return { resume: { ...SAMPLE_RESUME, objectKey: `sera-interviews/mock/${fileName}` }, offers }
}

// What Retell + the summary LLM would give after a round that ran `elapsed`
// seconds: the fixture transcript up to that point, and the 2-line summary.
export function mockRoundResult(round, elapsed) {
  return {
    transcript: (SAMPLE_TRANSCRIPTS[round] ?? []).filter((t) => t.end <= elapsed),
    summary: SAMPLE_SUMMARIES[round] ?? null,
  }
}

// The report from the session's 3 round transcripts — the real generateReport.
export async function buildMockReportFromSession(session) {
  const { report } = await generateReport(fixtureLlm(SAMPLE_LLM_OUTPUT), {
    transcripts: Object.fromEntries(Object.entries(session.rounds).map(([id, r]) => [id, r.transcript])),
    chosenOffer: getChosenOffer(session),
    resumeHighlights: session.resume.highlight,
    route: session.route,
    firstName: session.firstName || 'there',
    interviewDate: new Date().toISOString().slice(0, 10),
  })
  return report
}

// Synchronous sample report for ?preview=report and the tests.
// variant 'gaps': Composure has no evidence and the final round was cut short
// — to check that missing data hides instead of showing empty.
export function buildMockReport({ route = 'student', firstName = 'Priya', variant = null } = {}) {
  let transcripts = SAMPLE_TRANSCRIPTS
  let llmJson = SAMPLE_LLM_OUTPUT

  if (variant === 'gaps') {
    transcripts = { ...transcripts, final: transcripts.final.filter((t) => t.start < 62) }
    llmJson = {
      ...llmJson,
      answers: llmJson.answers.map((a) => ({ ...a, ratings: { ...a.ratings, composure: null } })),
      skillQuotes: { ...llmJson.skillQuotes, composure: null },
    }
  }

  const { report } = buildReport({
    llmJson,
    transcript: mergeRoundTranscripts(transcripts),
    route: route === 'student' ? 'student' : 'visitor',
    plannedRounds: roundsFor(route),
    chosenOffer: SAMPLE_OFFER,
    firstName,
    interviewDate: new Date().toISOString().slice(0, 10),
  })
  return report
}
