// Run: npm test — offers, per-round call variables, and the 3-round report,
// end to end on the fixtures in ./fixtures.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { generateOffers, validateOffers, buildOffersPrompt } from './seraOffers/index.js'
import { buildCallVariables, buildSummaryPrompt, cleanFirstName, parseSummary, pickAgentId } from './seraCall/index.js'
import { generateReport, mergeRoundTranscripts } from './seraReport/index.js'
import { validate } from '../../src/shared/seraReportSchema.js'
import { createSession } from '../../src/shared/seraSession.js'
import { SAMPLE_RESUME, SAMPLE_RESUME_TEXT } from './fixtures/seraResume.js'
import { SAMPLE_OFFERS, SAMPLE_OFFERS_LLM_JSON } from './fixtures/seraOffers.js'
import { SAMPLE_LLM_OUTPUT, SAMPLE_SUMMARIES, SAMPLE_TRANSCRIPTS } from './fixtures/seraInterview.js'

const clone = (x) => structuredClone(x)
const fixedLlm = (json) => async () => clone(json)
const RESUME_INPUT = { resumeText: SAMPLE_RESUME_TEXT, field: SAMPLE_RESUME.field, highlight: SAMPLE_RESUME.highlight }

// ── cleanFirstName ───────────────────────────────────────────────────────────
test('cleanFirstName: first real word, letters only, capitalised', () => {
  const cases = {
    'priya sharma': 'Priya',
    '  RAHUL   kumar ': 'Rahul',
    'Dr. Priya Sharma': 'Priya',
    'Mr Amit Shah': 'Amit',
    'mrs. kavita rao': 'Kavita',
    'Ms Neha': 'Neha',
    'Er. Rohan Patil': 'Rohan',
    'R. K. Sharma': 'Sharma',
    'A Kumar': 'Kumar',
    "D'Souza Anil": 'Dsouza',
    'Priya123': 'Priya',
    '': '',
    'Dr.': '',
    null: '',
  }
  for (const [input, expected] of Object.entries(cases)) {
    assert.equal(cleanFirstName(input === 'null' ? null : input), expected, JSON.stringify(input))
  }
})

// ── Offers ───────────────────────────────────────────────────────────────────
test('validateOffers: the sample offers pass', () => {
  assert.deepEqual(validateOffers(SAMPLE_OFFERS_LLM_JSON), { valid: true, errors: [] })
})

test('validateOffers: broken offers fail with clear reasons', () => {
  const bad = (mutate) => {
    const json = clone(SAMPLE_OFFERS_LLM_JSON)
    mutate(json.offers)
    return validateOffers(json)
  }
  assert.equal(validateOffers({ offers: SAMPLE_OFFERS_LLM_JSON.offers.slice(0, 2) }).valid, false, '2 offers')
  assert.equal(validateOffers(null).valid, false, 'no JSON')
  assert.match(bad((o) => (o[0].city = '  ')).errors.join(), /city: missing or empty/)
  assert.match(bad((o) => delete o[1].finalTwist).errors.join(), /finalTwist/)
  assert.match(bad((o) => (o[0].ctcMinLpa = 8)).errors.join(), /ctcMinLpa must be below/)
  assert.match(bad((o) => ((o[0].ctcMinLpa = 60), (o[0].ctcMaxLpa = 70))).errors.join(), /within/)
  assert.match(bad((o) => (o[2].skills = ['SQL', 'SQL', 'Excel'])).errors.join(), /3 different skills/)
  assert.match(bad((o) => (o[2].skills = ['SQL'])).errors.join(), /exactly 3/)
  assert.match(bad((o) => ((o[0].company = 'Infosys Analytics'), (o[0].logoLetter = 'I'))).errors.join(), /real company/)
  assert.match(bad((o) => (o[0].logoLetter = 'Z')).errors.join(), /first letter/)
  assert.match(bad((o) => (o[0].workMode = 'Office')).errors.join(), /workMode/)
  assert.match(bad((o) => ((o[2].role = o[1].role), (o[2].industry = o[1].industry))).errors.join(), /differ in role or industry/)
})

test('generateOffers: valid answer → 3 offers with ids', async () => {
  let calls = 0
  const offers = await generateOffers(async ({ prompt, schema }) => {
    calls++
    assert.ok(prompt.includes('INVENTED') && prompt.includes('Meridale'), 'prompt carries the rules and the résumé')
    assert.ok(schema.properties.offers)
    return clone(SAMPLE_OFFERS_LLM_JSON)
  }, RESUME_INPUT)
  assert.equal(calls, 1)
  assert.deepEqual(offers, SAMPLE_OFFERS)
})

test('generateOffers: retries once, then succeeds', async () => {
  const answers = [{ offers: [] }, clone(SAMPLE_OFFERS_LLM_JSON)]
  const offers = await generateOffers(async () => answers.shift(), RESUME_INPUT)
  assert.equal(offers.length, 3)
  assert.equal(answers.length, 0)
})

test('generateOffers: fails twice → throws a clear error (no broken tiles)', async () => {
  let calls = 0
  await assert.rejects(
    generateOffers(async () => {
      calls++
      if (calls === 1) throw new Error('timeout')
      return { offers: SAMPLE_OFFERS_LLM_JSON.offers.slice(0, 1) }
    }, RESUME_INPUT),
    /no valid offers after 2 attempts.*timeout.*exactly 3 offers/,
  )
  assert.equal(calls, 2)
})

test('buildOffersPrompt carries the résumé details', () => {
  const prompt = buildOffersPrompt(RESUME_INPUT)
  for (const needle of ['Exactly 3 offers', 'finalTwist', 'JSON only', SAMPLE_RESUME.field, 'Power BI']) assert.ok(prompt.includes(needle), needle)
})

// ── Call variables ───────────────────────────────────────────────────────────
const sessionWith = (patch = {}) => ({
  ...createSession({ route: 'visitor', name: 'Dr. priya sharma', email: 'p@example.com', phone: '9876543210' }),
  resume: SAMPLE_RESUME,
  offers: SAMPLE_OFFERS,
  chosenOfferId: 'offer-2',
  summaries: { ...SAMPLE_SUMMARIES },
  ...patch,
})

test('buildCallVariables: screening', () => {
  assert.deepEqual(buildCallVariables(sessionWith(), 'screening'), {
    first_name: 'Priya',
    field: 'data analysis',
    resume_highlight: SAMPLE_RESUME.highlight,
  })
})

test('buildCallVariables: hr', () => {
  assert.deepEqual(buildCallVariables(sessionWith(), 'hr'), {
    first_name: 'Priya',
    company: 'Tidewell Retail Technologies',
    city: 'Bengaluru',
    work_mode: 'On-site',
    role: 'Business Analyst',
    ctc_range: '₹5–7.5 LPA',
    requirements: 'Stakeholder updates, Excel, Process mapping',
    screening_summary: SAMPLE_SUMMARIES.screening,
  })
})

test('buildCallVariables: final = hr + hr_summary + final_twist', () => {
  const hr = buildCallVariables(sessionWith(), 'hr')
  assert.deepEqual(buildCallVariables(sessionWith(), 'final'), {
    ...hr,
    hr_summary: SAMPLE_SUMMARIES.hr,
    final_twist: 'The role needs relocation from Pune to Bengaluru within three weeks.',
  })
  assert.equal(buildCallVariables(sessionWith({ chosenOfferId: 'offer-1' }), 'hr').ctc_range, '₹4–6 LPA')
})

test('buildCallVariables: HR/final without a chosen offer throws', () => {
  assert.throws(() => buildCallVariables(sessionWith({ chosenOfferId: null }), 'hr'), /chosen offer/)
  assert.throws(() => buildCallVariables(sessionWith(), 'offer'), /Unknown Sera round/)
})

test('pickAgentId: reads the round env var, clear error when missing', () => {
  const env = { RETELL_AGENT_ID_SCREENING: 'agent_s', RETELL_AGENT_ID_HR: ' agent_h ', RETELL_AGENT_ID_FINAL: '' }
  assert.equal(pickAgentId('screening', env), 'agent_s')
  assert.equal(pickAgentId('hr', env), 'agent_h')
  assert.throws(() => pickAgentId('final', env), /RETELL_AGENT_ID_FINAL is not set/)
  assert.throws(() => pickAgentId('final', {}), /RETELL_AGENT_ID_FINAL/)
})

test('buildSummaryPrompt: neutral, factual, 2 lines', () => {
  const prompt = buildSummaryPrompt(SAMPLE_TRANSCRIPTS.screening, 'screening')
  for (const needle of ['Exactly 2', 'No scores', 'Power BI dashboard', 'JSON only']) assert.ok(prompt.includes(needle), needle)
  assert.equal(parseSummary({ lines: [' One. ', '', 'Two.', 'Three.'] }), 'One.\nTwo.')
  assert.equal(parseSummary(null), '')
})

// ── Report from the 3 rounds ─────────────────────────────────────────────────
const reportInput = (patch = {}) => ({
  transcripts: SAMPLE_TRANSCRIPTS,
  chosenOffer: SAMPLE_OFFERS[1],
  resumeHighlights: SAMPLE_RESUME.highlight,
  route: 'visitor',
  firstName: 'Priya',
  interviewDate: '2026-09-30',
  ...patch,
})

test('report: a quote from another round is dropped (same-round rule)', async () => {
  // Real candidate words, but from the HR round — the LLM says "screening".
  const llmJson = {
    ...clone(SAMPLE_LLM_OUTPUT),
    skillQuotes: { ...SAMPLE_LLM_OUTPUT.skillQuotes, communication: { text: 'I made a one page summary with three numbers', round: 'screening', timestamp: 16 } },
  }
  const { report, dropped, validation } = await generateReport(fixedLlm(llmJson), reportInput())
  assert.equal(validation.valid, true)
  assert.equal(report.skills.find((s) => s.id === 'communication').quote, null)
  assert.ok(dropped.some((d) => d.path === 'skillQuotes.communication'))
})

test('report: a made-up quote is dropped', async () => {
  const llmJson = {
    ...clone(SAMPLE_LLM_OUTPUT),
    skillQuotes: { ...SAMPLE_LLM_OUTPUT.skillQuotes, judgement: { text: 'I always escalate to the CEO directly', round: 'final', timestamp: 14 } },
  }
  const { report, dropped } = await generateReport(fixedLlm(llmJson), reportInput())
  assert.equal(report.skills.find((s) => s.id === 'judgement').quote, null)
  assert.ok(dropped.some((d) => d.path === 'skillQuotes.judgement'))
})

test('report: a round with too little speech → "Not enough to score" (null)', async () => {
  // Full length, but the candidate barely spoke in the final round.
  const final = [
    { role: 'agent', text: 'Final round. Your manager wants a report by Friday but the data is wrong. What do you do?', start: 0, end: 12 },
    { role: 'user', text: 'I would tell the manager.', start: 14, end: 20 },
    { role: 'agent', text: "Thank you, that's the end of the final round.", start: 160, end: 175 },
  ]
  const { report, validation } = await generateReport(fixedLlm(SAMPLE_LLM_OUTPUT), reportInput({ transcripts: { ...SAMPLE_TRANSCRIPTS, final } }))
  assert.equal(validation.valid, true)
  const round = report.rounds.find((r) => r.id === 'final')
  assert.equal(round.cutShort, true)
  assert.equal(round.score, null)
})

test('report: a round that never ran → null, not a guess', async () => {
  const { report } = await generateReport(fixedLlm(SAMPLE_LLM_OUTPUT), reportInput({ transcripts: { ...SAMPLE_TRANSCRIPTS, final: null } }))
  assert.equal(report.rounds.find((r) => r.id === 'final').score, null)
  assert.equal(report.facts.roundsCompleted, 2)
})

test('report: offer fit = the chosen offer\'s skills; "shown" only with a kept quote', async () => {
  const { report } = await generateReport(fixedLlm(SAMPLE_LLM_OUTPUT), reportInput({ chosenOffer: SAMPLE_OFFERS[0] }))
  assert.deepEqual(report.offerFit.items.map((i) => i.requirement), ['Excel', 'Power BI', 'SQL'])
  const excel = report.offerFit.items[0]
  assert.equal(excel.shown, true)
  assert.equal(excel.quote.round, 'screening')
  assert.deepEqual(report.offerFit.items[1], { requirement: 'Power BI', shown: false, quote: null })
})

test('report: the LLM is called once; nothing said → throws before any LLM call', async () => {
  let calls = 0
  const llm = async () => (calls++, clone(SAMPLE_LLM_OUTPUT))
  await generateReport(llm, reportInput())
  assert.equal(calls, 1)
  await assert.rejects(generateReport(llm, reportInput({ transcripts: {} })), /said nothing/)
  assert.equal(calls, 1)
})

test('mergeRoundTranscripts tags each turn with its round, in round order', () => {
  const merged = mergeRoundTranscripts({ final: SAMPLE_TRANSCRIPTS.final, screening: SAMPLE_TRANSCRIPTS.screening })
  assert.deepEqual([...new Set(merged.map((t) => t.round))], ['screening', 'final'])
})

// ── End to end ───────────────────────────────────────────────────────────────
test('end to end: résumé → offers → variables per round → report → validate()', async () => {
  let session = createSession({ route: 'student', name: 'Ms. PRIYA Sharma', email: 'p@example.com', phone: '9876543210', studentCode: 'YZI-PUNE-OCT26' })
  const offers = await generateOffers(fixedLlm(SAMPLE_OFFERS_LLM_JSON), RESUME_INPUT)
  session = { ...session, resume: SAMPLE_RESUME, offers }

  const screening = buildCallVariables(session, 'screening')
  assert.deepEqual(Object.keys(screening), ['first_name', 'field', 'resume_highlight'])
  assert.equal(screening.first_name, 'Priya')

  session = { ...session, chosenOfferId: offers[1].id, summaries: { screening: SAMPLE_SUMMARIES.screening, hr: null } }
  const hr = buildCallVariables(session, 'hr')
  assert.deepEqual(Object.keys(hr), ['first_name', 'company', 'city', 'work_mode', 'role', 'ctc_range', 'requirements', 'screening_summary'])

  session = { ...session, summaries: { ...session.summaries, hr: SAMPLE_SUMMARIES.hr } }
  const final = buildCallVariables(session, 'final')
  assert.deepEqual(Object.keys(final), [...Object.keys(hr), 'hr_summary', 'final_twist'])
  assert.ok(Object.values(final).every((v) => typeof v === 'string' && v.length > 0))

  const { report, dropped, validation } = await generateReport(fixedLlm(SAMPLE_LLM_OUTPUT), {
    transcripts: SAMPLE_TRANSCRIPTS,
    chosenOffer: offers[1],
    resumeHighlights: session.resume.highlight,
    route: session.route,
    firstName: session.firstName,
    interviewDate: '2026-09-30',
  })
  assert.deepEqual(validation.errors, [])
  assert.deepEqual(validate(report).errors, [])
  assert.equal(dropped.length, 0)
  assert.deepEqual(report.rounds.map((r) => r.id), ['screening', 'hr', 'final'])
  assert.ok(report.rounds.every((r) => r.score !== null))
  assert.equal(report.chosenOffer.company, 'Tidewell Retail Technologies')
  assert.equal(report.firstName, 'Priya')
})
