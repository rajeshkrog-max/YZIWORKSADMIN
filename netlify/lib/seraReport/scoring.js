// Scores computed IN CODE from the LLM's 1–5 ratings — the LLM never picks the
// final numbers. Pure: no env, no network.
import { bandFor, ratingToScore } from '../../../src/config/seraRubric.js'

const mean = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null)
const valid = (r) => Number.isInteger(r) && r >= 1 && r <= 5

// ratings: [{ round, timestamp, ratings: { skillId: 1–5 | null } }] (verified answers)
// rubricConfig: RUBRIC_CONFIG from src/config/seraRubric.js
// → { skills: { id: 0–100 | null }, rounds: { id: 0–100 | null }, overall: 0–100 | null, band }
export function scoreFromRatings(ratings, rubricConfig) {
  const { skills, minRatedAnswersPerRound, minSkillsForOverall } = rubricConfig

  const skillScores = {}
  for (const skill of skills) {
    const values = ratings.map((a) => a.ratings?.[skill.id]).filter(valid)
    const avg = mean(values)
    skillScores[skill.id] = avg === null ? null : ratingToScore(avg)
  }

  const roundScores = {}
  for (const id of [...new Set(ratings.map((a) => a.round))]) {
    const perAnswer = ratings
      .filter((a) => a.round === id)
      .map((a) => mean(Object.values(a.ratings ?? {}).filter(valid)))
      .filter((v) => v !== null)
    roundScores[id] = perAnswer.length >= minRatedAnswersPerRound ? ratingToScore(mean(perAnswer)) : null
  }

  const scored = skills.filter((s) => skillScores[s.id] !== null)
  let overall = null
  if (scored.length >= minSkillsForOverall) {
    const weight = scored.reduce((s, sk) => s + sk.weight, 0)
    overall = Math.round(scored.reduce((s, sk) => s + skillScores[sk.id] * sk.weight, 0) / weight)
  }

  return { skills: skillScores, rounds: roundScores, overall, band: bandFor(overall) }
}
