// Run: npm test. Handoff Fix 1: small LLM mistakes are repaired instead of failing the whole answer.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { generateOffers, repairOffers, validateOffers, withFeedback } from './index.js'
import { SAMPLE_OFFERS, SAMPLE_OFFERS_LLM_JSON } from '../fixtures/seraOffers.js'

const clone = (v) => JSON.parse(JSON.stringify(v))
const INPUT = { resumeText: 'B.Com graduate, Power BI dashboards at a retail store, Excel, SQL.', field: 'data analysis', highlight: 'Power BI' }

// The mistakes seen in the [Offers] log, all in one answer.
const sloppy = () => {
  const json = clone(SAMPLE_OFFERS_LLM_JSON)
  json.offers[0].skills = ['SQL', 'Excel', 'sql', 'Power BI', 'Tableau'] // 5, with a duplicate
  json.offers[0].logoLetter = 'z'
  json.offers[1].ctcMinLpa = 0.5 // below 1
  json.offers[1].ctcMaxLpa = 12 // spread too wide
  json.offers[2].company = 'Axis Fintech' // contains a real company word
  json.offers[2].logoLetter = 'A'
  return json
}

test('repairOffers: the sample offers come back unchanged', () => {
  assert.deepEqual(repairOffers(clone(SAMPLE_OFFERS_LLM_JSON)), SAMPLE_OFFERS_LLM_JSON)
})

test('repairOffers: skills, logo letter, CTC and real-company names are fixed, then pass validation', () => {
  const before = sloppy()
  assert.equal(validateOffers(before).valid, false)
  const fixed = repairOffers(before)
  const [a, b, c] = fixed.offers
  assert.deepEqual(a.skills, ['SQL', 'Excel', 'Power BI'])
  assert.equal(a.logoLetter, a.company[0].toUpperCase())
  assert.equal(b.ctcMinLpa, 1)
  assert.ok(b.ctcMaxLpa - b.ctcMinLpa <= 4)
  assert.equal(c.company, 'Fintech Systems') // real word dropped, suffix added
  assert.equal(c.logoLetter, 'F')
  assert.deepEqual(validateOffers(fixed), { valid: true, errors: [] })
  assert.equal(before.offers[0].skills.length, 5, 'the input is not mutated')
})

test('repairOffers: swapped/stringy CTC, work-mode spelling, a name that is only a real company, duplicate names', () => {
  const json = clone(SAMPLE_OFFERS_LLM_JSON)
  json.offers[0].ctcMinLpa = '9 LPA'
  json.offers[0].ctcMaxLpa = 6
  json.offers[1].workMode = 'onsite'
  json.offers[1].company = 'Tata'
  json.offers[2].company = json.offers[0].company
  const fixed = repairOffers(json)
  assert.deepEqual([fixed.offers[0].ctcMinLpa, fixed.offers[0].ctcMaxLpa], [6, 9])
  assert.equal(fixed.offers[1].workMode, 'On-site')
  assert.ok(!/tata/i.test(fixed.offers[1].company) && fixed.offers[1].company.length > 0)
  assert.notEqual(fixed.offers[2].company, fixed.offers[0].company)
  assert.deepEqual(validateOffers(fixed), { valid: true, errors: [] })
})

test('repairOffers: what it cannot fix is left for the validator (2 skills, same role and industry, not 3 offers)', () => {
  const json = clone(SAMPLE_OFFERS_LLM_JSON)
  json.offers[0].skills = ['SQL', 'sql']
  json.offers[2].role = json.offers[1].role
  json.offers[2].industry = json.offers[1].industry
  assert.equal(validateOffers(repairOffers(json)).valid, false)
  assert.equal(validateOffers(repairOffers({ offers: json.offers.slice(0, 2) })).valid, false)
  assert.equal(repairOffers(null), null)
})

test('generateOffers: a sloppy answer is repaired on the first attempt (one LLM call)', async () => {
  let calls = 0
  const offers = await generateOffers(async () => (calls++, sloppy()), INPUT)
  assert.equal(calls, 1)
  assert.equal(offers.length, 3)
  assert.deepEqual(offers.map((o) => o.id), SAMPLE_OFFERS.map((o) => o.id))
})

test('generateOffers: the retry prompt carries the previous errors', async () => {
  const prompts = []
  const bad = clone(SAMPLE_OFFERS_LLM_JSON)
  bad.offers[2].role = bad.offers[1].role
  bad.offers[2].industry = bad.offers[1].industry
  const answers = [bad, clone(SAMPLE_OFFERS_LLM_JSON)]
  const attempts = []
  await generateOffers(
    async ({ prompt }) => (prompts.push(prompt), answers.shift()),
    INPUT,
    { onAttempt: (a) => attempts.push(a) },
  )
  assert.equal(prompts.length, 2)
  assert.ok(!prompts[0].includes('PREVIOUS ANSWER'))
  assert.match(prompts[1], /PREVIOUS ANSWER WAS REJECTED[\s\S]*differ in role or industry/)
  assert.deepEqual(attempts.map((a) => a.ok), [false, true])
})

test('withFeedback: no errors → the same prompt', () => {
  assert.equal(withFeedback('P', []), 'P')
})
