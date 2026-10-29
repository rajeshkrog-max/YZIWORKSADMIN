// Run: npm test   (node's built-in test runner — no framework)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  MAX_CALL_SECONDS,
  VAPI_WEB_CALL_URL,
  VapiNotConfiguredError,
  VapiRequestError,
  buildCreateCallBody,
  buildOfferControlMessages,
  buildToolCallResults,
  createVapiCall,
  decideOutcome,
  extractToolCalls,
  getVapiConfig,
  isShowOffersMessage,
  offerHandoffVariables,
  parseEndOfCall,
  roundOfAssistantName,
  sendOfferHandoff,
  splitRounds,
  verifyVapiWebhook,
} from './index.js'
import { createSession } from '../../../src/shared/seraSession.js'
import { SAMPLE_OFFERS } from '../fixtures/seraOffers.js'

const session = () => ({
  ...createSession({ sessionId: 's-1', route: 'student', firstName: 'Priya', email: 'p@example.com' }),
  resume: { objectKey: 'sera-interviews/a.pdf', highlight: 'Built a Monday sales dashboard', field: 'data analysis' },
  offers: SAMPLE_OFFERS,
})
const env = { VAPI_PUBLIC_KEY: 'pub', VAPI_SQUAD_ID: 'squad-from-env' }
const okFetch = (calls = []) => async (url, init) => {
  calls.push({ url, init, body: JSON.parse(init.body) })
  return { ok: true, status: 200, json: async () => ({ id: 'call-1', webCallUrl: 'https://vapi.daily.co/x', monitor: { controlUrl: 'https://control/x' } }), text: async () => '' }
}

test('config: refuses when the web-call key or squad id is missing', () => {
  assert.throws(() => getVapiConfig({}), (e) => e instanceof VapiNotConfiguredError && e.missing.length === 2)
  assert.throws(() => getVapiConfig({ VAPI_PUBLIC_KEY: 'k' }), /VAPI_SQUAD_ID/)
  assert.throws(() => getVapiConfig({ VAPI_SQUAD_ID: 's' }), /VAPI_PUBLIC_KEY/)
  // a private key alone is not enough: Vapi's web-call endpoint wants the public one
  assert.throws(() => getVapiConfig({ VAPI_PRIVATE_KEY: 'k', VAPI_SQUAD_ID: 's' }), /VAPI_PUBLIC_KEY/)
})

test('create call: one squad call, screening variables only, control enabled, squad id from env', async () => {
  const calls = []
  const result = await createVapiCall(session(), { objectKey: 'sera-interviews/a.pdf', env, fetchImpl: okFetch(calls) })
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, VAPI_WEB_CALL_URL)
  assert.equal(calls[0].init.headers.Authorization, 'Bearer pub')
  // maxDurationSeconds / metadata / monitorPlan live in squadOverrides — Vapi drops them at the top level
  assert.deepEqual(calls[0].body, {
    squadId: 'squad-from-env',
    squadOverrides: {
      variableValues: { first_name: 'Priya', field: 'data analysis', resume_highlight: 'Built a Monday sales dashboard' },
      maxDurationSeconds: MAX_CALL_SECONDS,
      metadata: { email: 'p@example.com', sessionId: 's-1', objectKey: 'sera-interviews/a.pdf' },
      monitorPlan: { controlEnabled: true },
    },
  })
  assert.deepEqual(result, { callId: 'call-1', webCallUrl: 'https://vapi.daily.co/x', controlUrl: 'https://control/x' })
})

test('create call: the web url may come back as transport.callUrl', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ id: 'c', transport: { provider: 'daily', callUrl: 'https://vapi.daily.co/t' }, monitor: { controlUrl: 'https://control/t' } }) })
  assert.deepEqual(await createVapiCall(session(), { objectKey: 'k', env, fetchImpl }), { callId: 'c', webCallUrl: 'https://vapi.daily.co/t', controlUrl: 'https://control/t' })
})

test('create call: no request at all when the squad id is missing', async () => {
  const calls = []
  await assert.rejects(
    createVapiCall(session(), { objectKey: 'k', env: { VAPI_PUBLIC_KEY: 'pub' }, fetchImpl: okFetch(calls) }),
    VapiNotConfiguredError
  )
  assert.equal(calls.length, 0)
})

test('create call: Vapi errors and incomplete responses throw VapiRequestError', async () => {
  const fail = async () => ({ ok: false, status: 401, text: async () => 'nope' })
  await assert.rejects(createVapiCall(session(), { objectKey: 'k', env, fetchImpl: fail }), (e) => e instanceof VapiRequestError && e.status === 401)
  const noControl = async () => ({ ok: true, json: async () => ({ id: 'c', webCallUrl: 'u' }) })
  await assert.rejects(createVapiCall(session(), { objectKey: 'k', env, fetchImpl: noControl }), VapiRequestError)
})

test('create call body never carries a key', () => {
  assert.ok(!JSON.stringify(buildCreateCallBody(session(), { squadId: 's', objectKey: 'k' })).includes('pub'))
})

test('control: add-message first (no response), then handoff to Vinit — filled from the chosen offer', () => {
  const offer = SAMPLE_OFFERS[1]
  const [add, handoff] = buildOfferControlMessages(offer)
  assert.equal(add.type, 'add-message')
  assert.equal(add.triggerResponseEnabled, false)
  assert.equal(add.message.role, 'system')
  assert.equal(
    add.message.content,
    `Candidate chose ${offer.company}, ${offer.role}, ${offer.city}, ${offer.workMode}, CTC ₹${offer.ctcMinLpa}–${offer.ctcMaxLpa} LPA. ` +
      `Skills: ${offer.skills.join(', ')}. Why it fits: ${offer.whyFit.replace(/\.$/, '')}. Final-round situation: ${offer.finalTwist.replace(/\.$/, '')}. Use only this offer.`
  )
  assert.deepEqual(handoff, {
    type: 'handoff',
    destination: { type: 'assistant', assistantName: 'Vinit – HR Round' },
  })
  assert.equal('content' in handoff, false) // silent: a spoken line played over Vinit's greeting
})

test("control: the handoff carries the variable values Vinit's and Sonia's first messages need", () => {
  const offer = SAMPLE_OFFERS[1]
  const variables = offerHandoffVariables(session(), offer)
  assert.deepEqual(variables, {
    first_name: 'Priya',
    company: offer.company,
    role: offer.role,
    city: offer.city,
    work_mode: offer.workMode,
    ctc_range: `₹${offer.ctcMinLpa}–${offer.ctcMaxLpa} LPA`,
    requirements: offer.skills.join(', '),
    final_twist: offer.finalTwist,
  })
  const [, handoff] = buildOfferControlMessages(offer, variables)
  assert.deepEqual(handoff.destination.assistantOverrides, { variableValues: variables })
  assert.ok(Object.values(variables).every((v) => typeof v === 'string' && v.length > 0))
})

test('control: different offers produce different messages (nothing hardcoded)', () => {
  const a = buildOfferControlMessages(SAMPLE_OFFERS[0])[0].message.content
  const b = buildOfferControlMessages(SAMPLE_OFFERS[2])[0].message.content
  assert.notEqual(a, b)
  assert.ok(a.includes(SAMPLE_OFFERS[0].company) && !a.includes(SAMPLE_OFFERS[2].company))
})

test('control: both messages are POSTed to the stored controlUrl, in order', async () => {
  const calls = []
  const result = await sendOfferHandoff('https://control/x', SAMPLE_OFFERS[0], { fetchImpl: okFetch(calls) })
  assert.deepEqual(result, { via: 'handoff' })
  assert.deepEqual(calls.map((c) => c.body.type), ['add-message', 'handoff'])
  assert.ok(calls.every((c) => c.url === 'https://control/x'))
})

test('control: if Vapi rejects the live handoff, Sera is asked to hand over with her own tool', async () => {
  const sent = []
  const fetchImpl = async (url, init) => {
    const body = JSON.parse(init.body)
    sent.push(body)
    return body.type === 'handoff' ? { ok: false, status: 400, text: async () => 'unknown type' } : { ok: true, status: 200, text: async () => '' }
  }
  const result = await sendOfferHandoff('https://control/x', SAMPLE_OFFERS[0], { fetchImpl })
  assert.deepEqual(result, { via: 'nudge' })
  assert.deepEqual(sent.map((m) => m.type), ['add-message', 'handoff', 'add-message'])
  assert.equal(sent[2].triggerResponseEnabled, true)
  assert.ok(sent[2].message.content.includes('handoff_to_assistant'))
})

test('control: stops after a failed add-message — no handoff without the offer context', async () => {
  const calls = []
  const fetchImpl = async (url, init) => {
    calls.push(JSON.parse(init.body).type)
    return { ok: false, status: 500, text: async () => 'boom' }
  }
  await assert.rejects(sendOfferHandoff('https://control/x', SAMPLE_OFFERS[0], { fetchImpl }), /add-message failed/)
  assert.deepEqual(calls, ['add-message'])
  await assert.rejects(sendOfferHandoff('', SAMPLE_OFFERS[0], { fetchImpl }), /controlUrl/)
})

test('show_offers is recognised in every known tool-call shape', () => {
  const shapes = [
    { type: 'tool-calls', toolCallList: [{ id: 't1', name: 'show_offers' }] },
    { type: 'tool-calls', toolWithToolCallList: [{ name: 'show_offers', toolCall: { id: 't1' } }] },
    { type: 'tool-calls', toolCalls: [{ id: 't1', function: { name: 'show_offers' } }] },
    { type: 'function-call', functionCall: { name: 'show_offers' } },
  ]
  for (const shape of shapes) assert.ok(isShowOffersMessage(shape), JSON.stringify(shape))
  assert.ok(!isShowOffersMessage({ type: 'tool-calls', toolCallList: [{ id: 't', name: 'handoff_to_assistant' }] }))
  assert.ok(!isShowOffersMessage({ type: 'transcript' }))
  assert.ok(!isShowOffersMessage(null))
  assert.deepEqual(extractToolCalls({ toolCallList: [{ id: 'a', name: 'x' }] }), [{ id: 'a', name: 'x' }])
})

test('tool-calls server message: show_offers gets a result, others none', () => {
  const out = buildToolCallResults({ toolCallList: [{ id: 't1', name: 'show_offers' }, { id: 't2', name: 'other' }] })
  assert.equal(out.results.length, 1)
  assert.equal(out.results[0].toolCallId, 't1')
  assert.equal(buildToolCallResults({ toolCallList: [{ id: 't2', name: 'other' }] }), null)
})

test('webhook auth: bearer or X-Vapi-Secret, fails closed', () => {
  assert.ok(verifyVapiWebhook({ authorization: 'Bearer s3cret' }, 's3cret'))
  assert.ok(verifyVapiWebhook({ 'x-vapi-secret': 's3cret' }, 's3cret'))
  assert.ok(!verifyVapiWebhook({ authorization: 'Bearer wrong' }, 's3cret'))
  assert.ok(!verifyVapiWebhook({}, 's3cret'))
  assert.ok(!verifyVapiWebhook({ authorization: 'Bearer ' }, ''))
  assert.ok(!verifyVapiWebhook({ authorization: 'Bearer undefined' }, undefined))
})

test('assistant names map to rounds', () => {
  assert.equal(roundOfAssistantName('Sera – Screening'), 'screening')
  assert.equal(roundOfAssistantName('Vinit – HR Round'), 'hr')
  assert.equal(roundOfAssistantName('sonia-final round'), 'final')
  assert.equal(roundOfAssistantName('Vinit - HR round (v2)'), 'hr')
  assert.equal(roundOfAssistantName('Sonia'), 'final')
  assert.equal(roundOfAssistantName('Someone else'), null)
  assert.equal(roundOfAssistantName(undefined), null)
})

const msg = (role, message, secondsFromStart, name) => ({ role, message, secondsFromStart, ...(name ? { name } : {}) })
const SQUAD_MESSAGES = [
  { role: 'system', message: 'prompt text', secondsFromStart: 0 },
  msg('assistant', 'Hi Priya, welcome.', 1, 'Sera – Screening'),
  msg('user', 'Hello', 6),
  msg('assistant', 'The offers are on screen.', 280, 'Sera – Screening'),
  msg('assistant', 'Hello, I am Vinit from HR.', 340, 'Vinit – HR Round'),
  msg('user', 'Nice to meet you', 346),
  msg('assistant', 'Over to Sonia.', 500, 'Vinit – HR Round'),
  msg('assistant', 'Hi, Sonia here.', 505, 'sonia-final round'),
  msg('user', 'Hi', 510),
]

test('split rounds: by assistant name, times rebased per round, system messages dropped', () => {
  const { transcripts, attributedByName } = splitRounds(SQUAD_MESSAGES)
  assert.ok(attributedByName)
  assert.deepEqual(Object.fromEntries(Object.entries(transcripts).map(([r, t]) => [r, t.length])), { screening: 3, hr: 3, final: 2 })
  assert.equal(transcripts.screening[0].start, 0)
  assert.equal(transcripts.hr[0].start, 0)
  assert.equal(transcripts.hr[1].start, 6)
  assert.equal(transcripts.hr[0].role, 'agent')
  assert.equal(transcripts.final[1].role, 'user')
})

test('split rounds: falls back to time marks only when no message carries a name', () => {
  const unnamed = SQUAD_MESSAGES.map(({ name, ...m }) => (void name, m))
  const { transcripts, attributedByName } = splitRounds(unnamed, { hrStartSeconds: 300, finalStartSeconds: 500 })
  assert.ok(!attributedByName)
  assert.deepEqual([transcripts.screening.length, transcripts.hr.length, transcripts.final.length], [3, 2, 3])
})

test('outcome: report, dropped, incomplete', () => {
  const full = splitRounds(SQUAD_MESSAGES).transcripts
  assert.equal(decideOutcome({ endedReason: 'assistant-ended-call', transcripts: full }), 'report')
  assert.equal(decideOutcome({ endedReason: 'customer-ended-call', transcripts: full, candidateEnded: true }), 'report')
  const early = splitRounds(SQUAD_MESSAGES.slice(0, 5)).transcripts
  // hang-up / silence mid-interview is a finished (short) call, not a network drop
  assert.equal(decideOutcome({ endedReason: 'customer-ended-call', transcripts: early }), 'report')
  assert.equal(decideOutcome({ endedReason: 'silence-timed-out', transcripts: early }), 'report')
  // a real transport error before the final round, without the candidate pressing End
  assert.equal(decideOutcome({ endedReason: 'pipeline-error-openai-llm-failed', transcripts: early }), 'dropped')
  assert.equal(decideOutcome({ endedReason: 'pipeline-error-openai-llm-failed', transcripts: early, candidateEnded: true }), 'report')
  const silent = splitRounds([msg('assistant', 'Hi', 1, 'Sera – Screening')]).transcripts
  assert.equal(decideOutcome({ endedReason: 'customer-ended-call', transcripts: silent }), 'incomplete')
})

test('parse end-of-call-report; other server messages are ignored', () => {
  const body = { message: { type: 'end-of-call-report', endedReason: 'assistant-ended-call', call: { id: 'c1', metadata: { sessionId: 's-1' } }, artifact: { messages: SQUAD_MESSAGES } } }
  const parsed = parseEndOfCall(body)
  assert.equal(parsed.sessionId, 's-1')
  assert.equal(parsed.callId, 'c1')
  assert.equal(parsed.endedReason, 'assistant-ended-call')
  assert.equal(parsed.messages.length, SQUAD_MESSAGES.length)
  // metadata is not part of Vapi's Call schema: it can come back inside the overrides
  const viaOverrides = { message: { type: 'end-of-call-report', call: { id: 'c2', squadOverrides: { metadata: { sessionId: 's-9' } } } } }
  assert.equal(parseEndOfCall(viaOverrides).sessionId, 's-9')
  assert.equal(parseEndOfCall({ message: { type: 'end-of-call-report', call: { id: 'c3' } } }).sessionId, null)
  assert.equal(parseEndOfCall({ message: { type: 'status-update' } }), null)
  assert.equal(parseEndOfCall({}), null)
})
