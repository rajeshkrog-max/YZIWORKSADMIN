// Assembles the stored report (src/shared/seraReportSchema.js) from verified
// LLM evidence + metrics + scores computed in code. Pure: no env, no network.
import { SERA_SKILLS } from '../../../src/config/seraRubric.js'
import { PLAN_HORIZONS, REPORT_VERSION, ROUND_LABELS } from '../../../src/shared/seraReportSchema.js'

// Offer fit = exactly the chosen offer's skills, in order. A skill the LLM
// didn't cover (or quoted wrongly — already cleared by verifyReport) is "not shown yet".
const norm = (s) => String(s ?? '').toLowerCase().trim()
function offerFitItems(skills = [], items = []) {
  return skills.map((skill) => {
    const item = items.find((i) => norm(i.requirement) === norm(skill))
    return item?.shown && item.quote
      ? { requirement: skill, shown: true, quote: item.quote }
      : { requirement: skill, shown: false, quote: null }
  })
}

// plannedRounds: the rounds from src/config/seraRounds.js ([{ id, label, seconds }]).
export function assembleReport({ verified, metrics, scores, route, plannedRounds, chosenOffer, firstName, interviewDate }) {
  // Both routes run the same rounds and pick an offer; route only affects payment.
  const timed = plannedRounds.filter((r) => r.seconds != null) // the offer choice has no timer

  const rounds = timed.map((r) => {
    const ran = metrics.perRound[r.id]
    const cutShort = !ran || ran.cutShort
    return {
      id: r.id,
      label: ROUND_LABELS[r.id] ?? r.label,
      score: cutShort ? null : (scores.rounds[r.id] ?? null),
      note: verified.roundNotes?.[r.id] ?? null,
      durationSeconds: ran?.durationSeconds ?? 0,
      cutShort,
    }
  })

  const skills = SERA_SKILLS.map((s) => {
    const score = scores.skills[s.id] ?? null
    return { id: s.id, label: s.label, score, expected: s.expected, quote: score === null ? null : (verified.skillQuotes?.[s.id] ?? null) }
  })

  const offer = chosenOffer ?? null

  return {
    version: REPORT_VERSION,
    route: route === 'student' ? 'student' : 'visitor',
    firstName,
    interviewDate,
    interviewMinutes: Math.round(timed.reduce((sum, r) => sum + r.seconds, 0) / 60),
    chosenOffer: offer ? { company: offer.company, logoLetter: offer.logoLetter, role: offer.role } : null,
    overall: { score: scores.overall, band: scores.band, summary: verified.summary ?? null },
    facts: {
      secondsSpoken: metrics.secondsSpoken,
      questionsAnswered: metrics.questionsAnswered,
      roundsCompleted: metrics.roundsCompleted,
      roundsTotal: timed.length,
    },
    rounds,
    skills,
    strengths: verified.strengths,
    growth: verified.growth,
    rewrite: verified.rewrite,
    offerFit: offer ? { company: offer.company, role: offer.role, items: offerFitItems(offer.skills, verified.offerFit) } : null,
    speaking:
      metrics.questionsAnswered > 0
        ? {
            avgAnswerSeconds: metrics.avgAnswerSeconds,
            fillerWords: metrics.fillerWords,
            fillersPerMinute: metrics.fillersPerMinute,
            talkShare: metrics.talkShare,
          }
        : null,
    plan: (verified.plan ?? [])
      .filter((p) => PLAN_HORIZONS.includes(p.horizon) && p.title && p.text && p.skills?.length >= 2)
      .slice(0, 3)
      .map((p) => ({ horizon: p.horizon, title: p.title, text: p.text, skills: p.skills.slice(0, 2) })),
  }
}
