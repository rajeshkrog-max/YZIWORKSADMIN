// Sera report pipeline — pure functions, no env, no network.
// Order (see docs/sera-report-spec.md):
//   transcript → buildReportPrompt → LLM → verifyReport → computeMetrics
//   → scoreFromRatings → assembleReport → validate → store
import { RUBRIC_CONFIG } from '../../../src/config/seraRubric.js'
import { validate } from '../../../src/shared/seraReportSchema.js'
import { verifyReport } from './verify.js'
import { computeMetrics } from './metrics.js'
import { scoreFromRatings } from './scoring.js'
import { assembleReport } from './assemble.js'

export { buildReportPrompt, REPORT_LLM_SCHEMA, REPORT_LLM_OPTIONS } from './prompt.js'
export { computeMetrics, countFillers, FILLER_PHRASES } from './metrics.js'
export { scoreFromRatings } from './scoring.js'
export { verifyReport } from './verify.js'
export { assembleReport } from './assemble.js'
export { validate } from '../../../src/shared/seraReportSchema.js'

// Everything after the LLM call, in one step.
// → { report, dropped, validation: { valid, errors } }
export function buildReport({ llmJson, transcript, route, plannedRounds, chosenOffer, firstName, interviewDate }) {
  const { verified, dropped } = verifyReport(llmJson, transcript)
  const metrics = computeMetrics(transcript, plannedRounds, RUBRIC_CONFIG.cutShortRatio)
  const scores = scoreFromRatings(verified.answers, RUBRIC_CONFIG)
  const report = assembleReport({ verified, metrics, scores, route, plannedRounds, chosenOffer, firstName, interviewDate })
  return { report, dropped, validation: validate(report) }
}
