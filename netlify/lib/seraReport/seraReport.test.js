// Run: npm test   (node's built-in test runner — no framework)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildReport, computeMetrics, scoreFromRatings, verifyReport, buildReportPrompt } from './index.js'
import { reportSections, validate } from '../../../src/shared/seraReportSchema.js'
import { RUBRIC_CONFIG } from '../../../src/config/seraRubric.js'
import { roundsFor } from '../../../src/config/seraRounds.js'
import { SAMPLE_LLM_OUTPUT, SAMPLE_OFFER, SAMPLE_TRANSCRIPT } from '../fixtures/seraInterview.js'
import { buildMockReport } from '../../../src/services/seraMockReport.js'

const build = (overrides = {}) =>
  buildReport({
    llmJson: SAMPLE_LLM_OUTPUT,
    transcript: SAMPLE_TRANSCRIPT,
    route: 'student',
    plannedRounds: roundsFor('student'),
    chosenOffer: SAMPLE_OFFER,
    firstName: 'Priya',
    interviewDate: '2026-09-29',
    ...overrides,
  })

test('sample interview → valid report, nothing dropped', () => {
  const { report, dropped, validation } = build()
  assert.deepEqual(validation.errors, [])
  assert.equal(dropped.length, 0)
  assert.equal(report.rounds.length, 3)
  assert.ok(report.skills.every((s) => s.quote !== null))
})

test('a quote that is not in the transcript is dropped (and logged)', () => {
  const llmJson = {
    ...SAMPLE_LLM_OUTPUT,
    skillQuotes: { ...SAMPLE_LLM_OUTPUT.skillQuotes, communication: { text: 'I led a team of fifty people across three cities', round: 'hr', timestamp: 16 } },
  }
  const { report, dropped, validation } = build({ llmJson })
  assert.equal(validation.valid, true)
  assert.equal(report.skills.find((s) => s.id === 'communication').quote, null)
  assert.ok(report.skills.find((s) => s.id === 'communication').score !== null, 'the score still comes from the ratings')
  assert.ok(dropped.some((d) => d.path === 'skillQuotes.communication'))
})

test('quote timestamps come from the transcript, not the LLM', () => {
  const { verified } = verifyReport(
    { ...SAMPLE_LLM_OUTPUT, skillQuotes: { roleKnowledge: { text: 'removed duplicates and fixed the dates', round: 'screening', timestamp: 999 } } },
    SAMPLE_TRANSCRIPT,
  )
  assert.deepEqual(verified.skillQuotes.roleKnowledge, { text: 'removed duplicates and fixed the dates', round: 'screening', timestamp: 50 })
})

test('"shown" offer fit without a real quote becomes "not shown yet"', () => {
  const llmJson = {
    ...SAMPLE_LLM_OUTPUT,
    offerFit: [{ requirement: 'Process mapping', shown: true, quote: { text: 'I mapped every process at my internship', round: 'hr', timestamp: 16 } }],
  }
  const { report } = build({ llmJson })
  assert.deepEqual(report.offerFit.items.find((i) => i.requirement === 'Process mapping'), { requirement: 'Process mapping', shown: false, quote: null })
})

test('a skill with no evidence is null and its bar is hidden', () => {
  const llmJson = {
    ...SAMPLE_LLM_OUTPUT,
    answers: SAMPLE_LLM_OUTPUT.answers.map((a) => ({ ...a, ratings: { ...a.ratings, composure: null } })),
  }
  const { report, validation } = build({ llmJson })
  assert.equal(validation.valid, true)
  const composure = report.skills.find((s) => s.id === 'composure')
  assert.equal(composure.score, null)
  assert.equal(composure.quote, null)
  assert.equal(reportSections(report).skillBar(composure), false)
  assert.equal(reportSections(report).skills, true, 'the section stays for the other skills')
})

test('a cut-short round shows no score', () => {
  const transcript = SAMPLE_TRANSCRIPT.filter((t) => t.round !== 'final' || t.start < 62)
  const { report, validation } = build({ transcript })
  assert.equal(validation.valid, true)
  const final = report.rounds.find((r) => r.id === 'final')
  assert.equal(final.cutShort, true)
  assert.equal(final.score, null)
  assert.equal(report.facts.roundsCompleted, 2)
})

test('scores are computed in code from 1–5 ratings', () => {
  const ratings = [
    { round: 'screening', timestamp: 1, ratings: { communication: 4, roleKnowledge: 2, problemSolving: 3, composure: null, judgement: null } },
    { round: 'screening', timestamp: 2, ratings: { communication: 5, roleKnowledge: null, problemSolving: 3, composure: null, judgement: null } },
  ]
  const scores = scoreFromRatings(ratings, RUBRIC_CONFIG)
  assert.equal(scores.skills.communication, 88) // mean 4.5 → (3.5 / 4) × 100 = 87.5
  assert.equal(scores.skills.roleKnowledge, 25) // 2 → 25
  assert.equal(scores.skills.problemSolving, 50) // 3 → 50
  assert.equal(scores.skills.composure, null)
  // overall = weighted mean of the scored skills: (88×.25 + 25×.25 + 50×.2) / .7 = 54.6
  assert.equal(scores.overall, 55)
  assert.equal(scores.band, 'getting_there')
  // round: answer means (4+2+3)/3 = 3 and (5+3)/2 = 4 → 3.5 → (2.5 / 4) × 100 = 62.5
  assert.equal(scores.rounds.screening, 63)
})

test('too few scored skills → no overall score and no band', () => {
  const scores = scoreFromRatings([{ round: 'hr', timestamp: 1, ratings: { communication: 3 } }], RUBRIC_CONFIG)
  assert.equal(scores.overall, null)
  assert.equal(scores.band, null)
  assert.equal(scores.rounds.hr, null, 'one rated answer is not enough to score a round')
})

test('speaking metrics are computed in code', () => {
  const m = computeMetrics(SAMPLE_TRANSCRIPT)
  assert.equal(m.fillerWords, 7) // actually, um, basically, matlab, um, uh, uh
  assert.equal(m.questionsAnswered, 10) // includes "Tell me about a time…" (a prompt without "?")
  assert.equal(m.secondsSpoken, 380) // candidate turns: 196 s screening + 110 s HR + 74 s final
  assert.ok(m.talkShare > 0.5 && m.talkShare < 1)
})

test('New User (route "visitor") gets the same 3 rounds and offer fit as Student', () => {
  const { report, validation } = build({ route: 'visitor', plannedRounds: roundsFor('visitor') })
  assert.equal(validation.valid, true)
  assert.equal(report.route, 'visitor')
  assert.deepEqual(report.rounds.map((r) => r.id), ['screening', 'hr', 'final'])
  assert.equal(report.interviewMinutes, 11)
  assert.equal(reportSections(report).rounds, true)
  assert.equal(reportSections(report).offerFit, true)
})

test('validate() rejects a made-up shape', () => {
  assert.equal(validate({ strengths: ['Great communicator'] }).valid, false)
})

test('the DEV mock reports pass validate()', () => {
  for (const args of [{ route: 'student' }, { route: 'visitor' }, { route: 'student', variant: 'gaps' }]) {
    assert.deepEqual(validate(buildMockReport(args)).errors, [], JSON.stringify(args))
  }
})

test('the prompt carries the rules and the rubric', () => {
  const prompt = buildReportPrompt({ transcript: SAMPLE_TRANSCRIPT, resumeHighlights: 'Sales dashboard', route: 'student', rounds: ['screening', 'hr', 'final'], chosenOffer: SAMPLE_OFFER })
  for (const needle of ['WORD FOR WORD', 'return null', 'NEVER guess', 'Never mention or invent real companies', 'JSON only', '5 = Crisp']) {
    assert.ok(prompt.includes(needle), needle)
  }
})

test('PDF name: Latin part only, "Candidate" when there is none', async () => {
  const { pdfName } = await import('./renderReportPdf.js')
  assert.equal(pdfName('Priya'), 'Priya')
  assert.equal(pdfName('Priya प्रिया'), 'Priya')
  assert.equal(pdfName('प्रिया'), 'Candidate')
  assert.equal(pdfName(''), 'Candidate')
})
