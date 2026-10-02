// Complete Life-Cycle Integration Test for Meet Sera
// Tests: Login, Student Codes, Resume/Offers, Screening, HR, Final, Transcripts, Report, Dropped Call & Rejoin
import crypto from 'node:crypto'

const BASE = 'http://127.0.0.1:4005'
const RETELL_WEBHOOK_SECRET = 'key_e7eff6b92154401ed5b7d9438c1a'

async function post(path, body, extraHeaders = {}) {
  const rawBody = JSON.stringify(body)
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
    body: rawBody,
  })
  return res.json()
}

async function get(path) {
  const res = await fetch(`${BASE}${path}`)
  return res.json()
}

function createRetellSignature(payloadStr) {
  const timestamp = Date.now().toString()
  const digest = crypto
    .createHmac('sha256', RETELL_WEBHOOK_SECRET)
    .update(payloadStr + timestamp)
    .digest('hex')
  return `v=${timestamp},d=${digest}`
}

async function postWebhook(callPayload) {
  const body = { event: 'call_ended', call: callPayload }
  const raw = JSON.stringify(body)
  const sig = createRetellSignature(raw)
  const res = await fetch(`${BASE}/api/sera/retell-webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-retell-signature': sig,
    },
    body: raw,
  })
  return res.json()
}

async function run() {
  console.log('====================================================')
  console.log('🚀 RUNNING COMPREHENSIVE MEET SERA FULL-SYSTEM CHECK')
  console.log('====================================================\n')

  let passed = 0
  let failed = 0

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`)
      passed++
    } else {
      console.error(`  ❌ FAIL: ${message}`)
      failed++
    }
  }

  // 1. Health
  console.log('1. Health Check:')
  const health = await get('/health')
  assert(health.ok === true, 'Server responds to /health')

  // 2. Student Code Checks
  console.log('\n2. Student Code Verification:')
  const validCode = await post('/api/sera/student-code/check', { code: 'YZI-PUNE-OCT26' })
  assert(validCode.valid === true && validCode.seatsLeft > 0, `Valid student code accepted (${validCode.instituteName})`)

  const invalidCode = await post('/api/sera/student-code/check', { code: 'INVALID-CODE-999' })
  assert(invalidCode.valid === false && invalidCode.reason === 'not_found', 'Invalid code rejected with not_found')

  // 3. Login
  console.log('\n3. Candidate Login (Student Route):')
  const loginRes = await post('/api/sera/login', {
    route: 'student',
    google: { name: 'Aarav Patel', email: 'aarav.patel@test.com' },
    phone: '9876543210',
    studentCode: 'YZI-PUNE-OCT26',
  })
  assert(loginRes.ok === true && !!loginRes.login?.sessionId, 'Student login succeeded, session created')
  const sessionId = loginRes.login?.sessionId

  // 4. Résumé Preparation & Offers
  console.log('\n4. Résumé Extraction & Offer Generation:')
  const resumeRes = await post('/.netlify/functions/sera-extract-resume', {
    objectKey: 'sera-interviews/mock/Aarav_Patel_Resume.pdf',
    sessionId,
  })
  assert(resumeRes.valid === true && Array.isArray(resumeRes.offers) && resumeRes.offers.length === 3, '3 job offers generated and attached to session')
  const chosenOffer = resumeRes.offers[0]
  console.log(`     Chosen Offer: "${chosenOffer.role}" at ${chosenOffer.company}`)

  // 5. Call 1: Screening Round
  console.log('\n5. Round 0 - Screening Call Initiation:')
  const screeningCall = await post('/api/sera/start-call', {
    sessionId,
    round: 'screening',
    route: 'student',
    email: 'aarav.patel@test.com',
    studentCode: 'YZI-PUNE-OCT26',
  })
  assert((screeningCall.success || screeningCall.ok) && (screeningCall.accessToken || screeningCall.callId), 'Screening call started (Retell web-call created)')

  // 6. Webhook Transcript for Screening Round
  console.log('\n6. Ingesting Screening Round Transcript (Retell Webhook):')
  const screeningWebhook = await postWebhook({
    call_id: screeningCall.callId || 'call_screening_123',
    transcript: 'Hello Sera, I am Aarav Patel. I have built full stack apps in Node.js and React.',
    transcript_object: [
      { role: 'agent', content: 'Welcome to YZI Works! Tell me about yourself.', start_timestamp: 1000, end_timestamp: 4000 },
      { role: 'user', content: 'I am a passionate software developer experienced in full stack development.', start_timestamp: 5000, end_timestamp: 12000 },
    ],
    metadata: {
      sessionId,
      round: 'screening',
    },
  })
  assert(screeningWebhook.received === true, 'Screening round transcript webhook processed')

  // 7. Offer Choice
  console.log('\n7. Candidate Picks Job Offer:')
  const offerChoice = await post('/api/sera/offers/choose', {
    sessionId,
    offerId: chosenOffer.id,
  })
  assert(offerChoice.ok === true, `Offer "${chosenOffer.role}" successfully saved to session`)

  // 8. Call 2: HR Round with Vinit
  console.log('\n8. Round 2 - HR Round Initiation:')
  const hrCall = await post('/api/sera/start-call', {
    sessionId,
    round: 'hr',
    route: 'student',
    email: 'aarav.patel@test.com',
    studentCode: 'YZI-PUNE-OCT26',
    chosenOfferId: chosenOffer.id,
  })
  assert((hrCall.success || hrCall.ok) && (hrCall.accessToken || hrCall.callId), 'HR call with Vinit initiated successfully')

  // 9. Webhook Transcript for HR Round
  console.log('\n9. Ingesting HR Round Transcript:')
  const hrWebhook = await postWebhook({
    call_id: hrCall.callId || 'call_hr_456',
    transcript: 'I work very well under tight deadlines and prioritize clear team communication.',
    transcript_object: [
      { role: 'agent', content: 'How do you handle difficult deadlines with ambiguous requirements?', start_timestamp: 1000, end_timestamp: 4000 },
      { role: 'user', content: 'I break down the problem, set milestones, and proactively sync with stakeholders.', start_timestamp: 5000, end_timestamp: 14000 },
    ],
    metadata: {
      sessionId,
      round: 'hr',
    },
  })
  assert(hrWebhook.received === true, 'HR round transcript webhook processed')

  // 10. Call 3: Final Technical/Leadership Round with Arvind
  console.log('\n10. Round 3 - Final Round Initiation:')
  const finalCall = await post('/api/sera/start-call', {
    sessionId,
    round: 'final',
    route: 'student',
    email: 'aarav.patel@test.com',
    studentCode: 'YZI-PUNE-OCT26',
    chosenOfferId: chosenOffer.id,
  })
  assert((finalCall.success || finalCall.ok) && (finalCall.accessToken || finalCall.callId), 'Final round with Arvind initiated successfully')

  // 11. Webhook Transcript for Final Round
  console.log('\n11. Ingesting Final Round Transcript:')
  const finalWebhook = await postWebhook({
    call_id: finalCall.callId || 'call_final_789',
    transcript: 'I designed the caching layer using Redis which reduced response times by 65%.',
    transcript_object: [
      { role: 'agent', content: 'Explain a technical decision where you faced a significant performance bottleneck.', start_timestamp: 1000, end_timestamp: 5000 },
      { role: 'user', content: 'Our API was CPU-bound on repeated queries; introducing Redis cache solved it with minimal overhead.', start_timestamp: 6000, end_timestamp: 18000 },
    ],
    metadata: {
      sessionId,
      round: 'final',
    },
  })
  assert(finalWebhook.received === true, 'Final round transcript webhook processed')

  // 12. Evaluation & Report Generation
  console.log('\n12. Fetching & Generating Evaluated Candidate Report:')
  const reportRes = await post('/api/sera/get-report', { sessionId })
  assert(reportRes.ready === true && !!reportRes.report, 'Report ready and successfully generated')
  const score = reportRes.report?.overall?.score || reportRes.report?.overallScore || reportRes.score
  assert(typeof score === 'number' && score > 0, `Overall score computed: ${score}/100`)
  assert(
    Array.isArray(reportRes.report?.skills) && reportRes.report?.skills.length > 0,
    'Report contains evaluated skills benchmarks, strengths, and radar scores'
  )

  // 13. Dropped Call & Rejoin Flow
  console.log('\n13. Simulating Dropped Call & Rejoin Flow:')
  const dropRes = await post('/api/sera/session/lost', {
    sessionId,
    round: 'hr',
  })
  assert(dropRes.ok === true && dropRes.rejoinIssued === true && !!dropRes.code, `Rejoin code issued: ${dropRes.code}`)

  const rejoinCheck = await post('/api/sera/student-code/check', { code: dropRes.code })
  assert(rejoinCheck.valid === true && rejoinCheck.kind === 'rejoin', 'Rejoin code verified as valid rejoin token')

  // 14. Session Verification
  console.log('\n14. Verifying Session State:')
  const sessionData = await get(`/api/sera/session?sessionId=${sessionId}`)
  assert(sessionData.sessionId === sessionId, 'Session persisted and retrievable by ID')
  assert(sessionData.rounds?.screening?.status === 'completed', 'Screening status marked completed')
  assert(sessionData.rounds?.hr?.status === 'completed', 'HR status marked completed')
  assert(sessionData.rounds?.final?.status === 'completed', 'Final status marked completed')

  console.log('\n====================================================')
  console.log(`SUMMARY: ${passed} passed, ${failed} failed`)
  console.log('====================================================')

  if (failed > 0) process.exit(1)
}

run().catch((err) => {
  console.error('Test execution failed:', err)
  process.exit(1)
})
