// Everything after the LLM call, in one step. Pure: no env, no network.
import { RUBRIC_CONFIG } from '../../../src/config/seraRubric.js'
import { validate } from '../../../src/shared/seraReportSchema.js'
import { verifyReport } from './verify.js'
import { computeMetrics } from './metrics.js'
import { scoreFromRatings } from './scoring.js'
import { assembleReport } from './assemble.js'

// → { report, dropped, validation: { valid, errors } }
export function buildReport({ llmJson, transcript, route, plannedRounds, chosenOffer, firstName, interviewDate }) {
  const { verified, dropped } = verifyReport(llmJson, transcript)
  const metrics = computeMetrics(transcript, plannedRounds, RUBRIC_CONFIG.cutShortRatio, RUBRIC_CONFIG.minUserWordsPerRound)
  const scores = scoreFromRatings(verified.answers, RUBRIC_CONFIG)
  const report = assembleReport({ verified, metrics, scores, route, plannedRounds, chosenOffer, firstName, interviewDate })
  return { report, dropped, validation: validate(report) }
}
