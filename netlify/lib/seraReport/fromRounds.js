// The report from all 3 rounds — generated ONCE, after the final round.
// Pure: the caller passes the LLM call (one call per interview).
import { roundsFor } from '../../../src/config/seraRounds.js'
import { CALL_ROUND_IDS } from '../../../src/shared/seraSession.js'
import { buildReportPrompt, REPORT_LLM_OPTIONS, REPORT_LLM_SCHEMA } from './prompt.js'
import { buildReport } from './build.js'

// { screening: [turn], hr: [turn], final: [turn] } (one per Retell call, times
// from the start of that call) → one transcript with `round` on every turn.
// A round that didn't run (null / empty) is simply absent.
export const mergeRoundTranscripts = (transcripts = {}) =>
  CALL_ROUND_IDS.flatMap((round) => (transcripts[round] ?? []).map((t) => ({ ...t, round })))

// input: { transcripts, chosenOffer, resumeHighlights, route }
export function buildFinalReportPrompt({ transcripts, chosenOffer, resumeHighlights, route }) {
  const transcript = mergeRoundTranscripts(transcripts)
  const rounds = CALL_ROUND_IDS.filter((id) => transcript.some((t) => t.round === id))
  const prompt = buildReportPrompt({ transcript, resumeHighlights, route, rounds, chosenOffer: chosenOffer ?? null })
  return { prompt, schema: REPORT_LLM_SCHEMA, options: REPORT_LLM_OPTIONS, transcript, rounds }
}

// llmCall({ prompt, schema, options }) → parsed JSON.
// input: { transcripts, chosenOffer, resumeHighlights, route, firstName, interviewDate }
// → { report, dropped, validation } — store the report only if validation.valid.
export async function generateReport(llmCall, input) {
  const { prompt, schema, options, transcript } = buildFinalReportPrompt(input)
  if (!transcript.some((t) => t.role === 'user')) throw new Error('Sera report: the candidate said nothing in any round')
  const llmJson = await llmCall({ prompt, schema, options })
  return buildReport({
    llmJson,
    transcript,
    route: input.route,
    plannedRounds: roundsFor(input.route),
    chosenOffer: input.chosenOffer ?? null,
    firstName: input.firstName,
    interviewDate: input.interviewDate,
  })
}
