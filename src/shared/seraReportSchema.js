// The Sera report JSON — the single source of truth stored by the server and
// rendered by the report page and the PDF. Plain JS, no dependencies: used by
// the browser (src/) and by the report pipeline (netlify/lib/seraReport/).
//
// Shape (every field below is required unless marked "| null"):
// {
//   version: 1,
//   route: 'student' | 'visitor',
//   firstName: string,
//   interviewDate: 'YYYY-MM-DD',
//   interviewMinutes: number,                          // 10 student, 5 visitor
//   chosenOffer: { company, logoLetter, role } | null, // student only
//   overall: { score: 0–100 | null, band: 'needs_work'|'getting_there'|'ready' | null, summary: string | null },
//   facts: { secondsSpoken, questionsAnswered, roundsCompleted, roundsTotal },   // computed in code
//   rounds: [{ id, label, score: 0–100 | null, note: string | null, durationSeconds, cutShort: boolean }],
//   skills: [{ id, label, score: 0–100 | null, expected: 0–100, quote: Quote | null }],
//   strengths: [{ text, moment: { round, timestamp } }],   // ≤ 3
//   growth:    [{ text, moment: { round, timestamp } }],   // ≤ 3
//   rewrite: { question, youSaid, stronger, round, timestamp } | null,
//   offerFit: { company, role, items: [{ requirement, shown: boolean, quote: Quote | null }] } | null,
//   speaking: { avgAnswerSeconds, fillerWords, fillersPerMinute, talkShare (0–1) } | null,  // computed in code
//   plan: [{ horizon: '30d' | '1-3m' | '6-12m', title, text, skills: [string, string] }],
// }
// Quote = { text, round, timestamp }  — text copied word for word from the
// transcript; timestamp = seconds from the start of that round's call.
import { SERA_SKILLS } from '../config/seraRubric.js'

export const REPORT_VERSION = 1
export const SKILL_IDS = SERA_SKILLS.map((skill) => skill.id)
export const ROUND_IDS = ['screening', 'hr', 'final']
export const PLAN_HORIZONS = ['30d', '1-3m', '6-12m']
export const BAND_IDS = ['needs_work', 'getting_there', 'ready']

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const isStr = (v) => typeof v === 'string' && v.trim().length > 0
const isNum = (v) => typeof v === 'number' && Number.isFinite(v)
const isScore = (v) => isNum(v) && v >= 0 && v <= 100
const isNullOr = (check) => (v) => v === null || check(v)
const isMoment = (v) => isObj(v) && ROUND_IDS.includes(v.round) && isNum(v.timestamp) && v.timestamp >= 0
const isQuote = (v) => isMoment(v) && isStr(v.text)

// → { valid: boolean, errors: string[] }. The UI renders a report only when valid.
export function validate(report) {
  const errors = []
  const check = (ok, path) => {
    if (!ok) errors.push(path)
  }

  if (!isObj(report)) return { valid: false, errors: ['report is not an object'] }
  check(report.version === REPORT_VERSION, 'version')
  check(['student', 'visitor'].includes(report.route), 'route')
  check(isStr(report.firstName), 'firstName')
  check(typeof report.interviewDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(report.interviewDate), 'interviewDate')
  check(isNum(report.interviewMinutes) && report.interviewMinutes > 0, 'interviewMinutes')
  check(
    report.chosenOffer === null ||
      (isObj(report.chosenOffer) && isStr(report.chosenOffer.company) && isStr(report.chosenOffer.logoLetter) && isStr(report.chosenOffer.role)),
    'chosenOffer',
  )

  const o = report.overall
  check(isObj(o), 'overall')
  if (isObj(o)) {
    check(isNullOr(isScore)(o.score), 'overall.score')
    check(o.band === null || BAND_IDS.includes(o.band), 'overall.band')
    check((o.score === null) === (o.band === null), 'overall.band must be null exactly when score is null')
    check(isNullOr(isStr)(o.summary), 'overall.summary')
  }

  const f = report.facts
  check(isObj(f) && ['secondsSpoken', 'questionsAnswered', 'roundsCompleted', 'roundsTotal'].every((k) => isNum(f[k]) && f[k] >= 0), 'facts')

  check(Array.isArray(report.rounds), 'rounds')
  ;(report.rounds ?? []).forEach((r, i) => {
    check(
      isObj(r) && ROUND_IDS.includes(r.id) && isStr(r.label) && isNullOr(isScore)(r.score) && isNullOr(isStr)(r.note) &&
        isNum(r.durationSeconds) && typeof r.cutShort === 'boolean',
      `rounds[${i}]`,
    )
    if (isObj(r) && r.cutShort) check(r.score === null, `rounds[${i}].score must be null when cut short`)
  })

  check(Array.isArray(report.skills) && report.skills.length === SKILL_IDS.length, 'skills')
  ;(report.skills ?? []).forEach((s, i) => {
    check(
      isObj(s) && SKILL_IDS.includes(s.id) && isStr(s.label) && isNullOr(isScore)(s.score) && isScore(s.expected) && isNullOr(isQuote)(s.quote),
      `skills[${i}]`,
    )
  })

  for (const key of ['strengths', 'growth']) {
    check(Array.isArray(report[key]) && report[key].length <= 3, key)
    ;(report[key] ?? []).forEach((item, i) => check(isObj(item) && isStr(item.text) && isMoment(item.moment), `${key}[${i}]`))
  }

  const rw = report.rewrite
  check(rw === null || (isObj(rw) && isStr(rw.question) && isStr(rw.youSaid) && isStr(rw.stronger) && isMoment(rw)), 'rewrite')

  const fit = report.offerFit
  check(
    fit === null ||
      (isObj(fit) && isStr(fit.company) && isStr(fit.role) && Array.isArray(fit.items) &&
        fit.items.every((it) => isObj(it) && isStr(it.requirement) && typeof it.shown === 'boolean' && isNullOr(isQuote)(it.quote) && (!it.shown || it.quote !== null))),
    'offerFit (and "shown" needs a quote)',
  )
  if (report.route === 'visitor') {
    check(report.offerFit === null, 'offerFit must be null for visitors')
    check(report.chosenOffer === null, 'chosenOffer must be null for visitors')
  }

  const sp = report.speaking
  check(
    sp === null ||
      (isObj(sp) && isNum(sp.avgAnswerSeconds) && isNum(sp.fillerWords) && isNum(sp.fillersPerMinute) && isNum(sp.talkShare) && sp.talkShare >= 0 && sp.talkShare <= 1),
    'speaking',
  )

  check(Array.isArray(report.plan) && report.plan.length <= 3, 'plan')
  ;(report.plan ?? []).forEach((p, i) =>
    check(isObj(p) && PLAN_HORIZONS.includes(p.horizon) && isStr(p.title) && isStr(p.text) && Array.isArray(p.skills) && p.skills.length === 2 && p.skills.every(isStr), `plan[${i}]`),
  )

  return { valid: errors.length === 0, errors }
}

// Which sections/bars the page and the PDF show — a section whose data is
// missing is hidden, never shown empty.
export function reportSections(report) {
  const student = report.route === 'student'
  const scoredSkills = report.skills.filter((s) => s.score !== null)
  return {
    gauge: report.overall.score !== null,
    summary: report.overall.summary !== null,
    rounds: student && report.rounds.length > 0,
    skills: scoredSkills.length > 0,
    skillBar: (skill) => skill.score !== null,
    strengths: report.strengths.length > 0,
    growth: report.growth.length > 0,
    rewrite: report.rewrite !== null,
    offerFit: student && report.offerFit !== null && report.offerFit.items.length > 0,
    speaking: report.speaking !== null,
    plan: report.plan.length > 0,
  }
}

// 102 → "1:42"
export const formatTimestamp = (seconds) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`

export const ROUND_LABELS = { screening: 'Screening', hr: 'HR round', final: 'Final round' }
