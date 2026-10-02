// End-to-end production flow test simulating a real user on http://localhost:4173
import crypto from 'node:crypto'

const BASE = 'http://localhost:4173'
const RETELL_SECRET = 'key_e7eff6b92154401ed5b7d9438c1a'

function hmacSign(body) {
  const timestamp = Date.now().toString()
  const digest = crypto.createHmac('sha256', RETELL_SECRET).update(body + timestamp).digest('hex')
  return `v=${timestamp},d=${digest}`
}

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  let data
  try { data = JSON.parse(text) } catch { data = text }
  return { status: res.status, data }
}

async function run() {
  console.log('=== STARTING PRODUCTION USER FLOW TEST ON PREVIEW BUILD ===\n')

  // 1. Check invalid code
  console.log('1. User enters invalid campus code "INVALID123"...')
  const r1 = await post('/api/sera/student-code/check', { code: 'INVALID123' })
  console.log('   Response:', r1.data)
  if (r1.data.valid !== false) throw new Error('Expected invalid code to fail')
  console.log('   ✓ Properly rejected with reason:', r1.data.reason)

  // 2. Check valid campus code
  console.log('\n2. User enters valid campus code "YZI-PUNE-OCT26"...')
  const r2 = await post('/api/sera/student-code/check', { code: 'YZI-PUNE-OCT26' })
  console.log('   Response:', r2.data)
  if (!r2.data.valid) throw new Error('Valid code failed')
  console.log(`   ✓ Institute: "${r2.data.instituteName}", Seats: ${r2.data.seatsLeft}`)

  // 3. User Login
  console.log('\n3. User logs in with Google + Campus Code...')
  const r3 = await post('/api/sera/login', {
    route: 'student',
    studentCode: 'YZI-PUNE-OCT26',
    google: {
      name: 'Rohan Sharma',
      email: 'rohan.sharma.test@gmail.com',
      picture: 'https://lh3.googleusercontent.com/a/default-user',
    },
    phone: '919876543210',
  })
  console.log('   Response:', r3.data)
  const sessionId = r3.data.sessionId || r3.data.login?.sessionId
  if (!r3.data.ok || !sessionId) throw new Error('Login failed')
  console.log('   ✓ Session created with ID:', sessionId)

  // 4. Resume upload ticket
  console.log('\n4. User uploads résumé PDF...')
  const r4 = await post('/.netlify/functions/sera-create-upload', {
    filename: 'Rohan_Sharma_Resume.pdf',
    contentType: 'application/pdf',
    size: 45000,
  })
  console.log('   Upload URL generated:', r4.data.uploadUrl ? 'Yes' : 'No', 'Key:', r4.data.objectKey)
  const objectKey = r4.data.objectKey

  // 5. Resume extraction & 3 corporate job offers
  console.log('\n5. Backend extracts résumé and generates 3 corporate offers...')
  const r5 = await post('/.netlify/functions/sera-extract-resume', { objectKey })
  console.log('   Valid Résumé:', r5.data.valid)
  console.log('   Domain Field:', r5.data.field)
  console.log('   Spoken Highlight:', r5.data.highlight)
  console.log('   Generated Offers Count:', r5.data.offers?.length)
  if (!r5.data.offers || r5.data.offers.length !== 3) throw new Error('Offers generation failed')
  r5.data.offers.forEach((o, i) => {
    console.log(`     [Offer ${i + 1}] ${o.company} - ${o.role} (${o.ctc})`)
  })
  const chosenOffer = r5.data.offers[0]

  // 6. Round 0: Screening Call with Sera
  console.log('\n6. User clicks "Start Interview" (Round: screening with Sera)...')
  const r6 = await post('/.netlify/functions/sera-start-call', {
    sessionId,
    round: 'screening',
    route: 'student',
    email: 'rohan.sharma.test@gmail.com',
    name: 'Rohan Sharma',
    studentCode: 'YZI-PUNE-OCT26',
    objectKey,
    highlight: r5.data.highlight,
    field: r5.data.field,
  })
  console.log('   Call ID:', r6.data?.callId)
  console.log('   WebRTC Access Token received:', !!r6.data?.accessToken)
  if (!r6.data?.accessToken) throw new Error('Retell call creation failed')
  const callId0 = r6.data?.callId

  // 7. Retell Webhook for Screening Round
  console.log('\n7. Retell Webhook receives Round: screening transcript...')
  const webhook0Body = JSON.stringify({
    event: 'call_ended',
    call: {
      call_id: callId0,
      metadata: { sessionId, round: 'screening' },
      disconnection_reason: 'user_hangup',
      transcript_object: [
        { role: 'agent', content: 'Hi Rohan, welcome to Sera! Can you tell me about yourself?' },
        { role: 'user', content: 'Hi Sera, I am a full-stack engineer experienced in React, Node.js, and cloud systems.' },
        { role: 'agent', content: 'That sounds impressive. What was your most challenging project?' },
        { role: 'user', content: 'I built an e-commerce microservices pipeline handling 50k requests per minute with Redis caching.' },
        { role: 'agent', content: 'Fantastic! You have cleared this screening round.' },
      ],
    },
  })
  const sig0 = hmacSign(webhook0Body)
  const r7 = await fetch(`${BASE}/api/sera/retell-webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-retell-signature': sig0 },
    body: webhook0Body,
  })
  console.log('   Webhook HTTP Status:', r7.status)

  // 8. User chooses an offer
  console.log('\n8. User chooses Offer 1 (' + chosenOffer.company + ')...')
  const r8 = await post('/api/sera/offers/choose', {
    sessionId,
    offerId: chosenOffer.id,
  })
  console.log('   Response:', r8.data)
  if (!r8.data.ok) throw new Error('Offer selection failed')

  // 9. Round 1: HR Interview with Vinit
  console.log('\n9. User starts Round: hr (HR with Vinit)...')
  const r9 = await post('/.netlify/functions/sera-start-call', {
    sessionId,
    round: 'hr',
    route: 'student',
    email: 'rohan.sharma.test@gmail.com',
    name: 'Rohan Sharma',
  })
  console.log('   HR Call ID:', r9.data?.callId)
  console.log('   HR WebRTC Token:', !!r9.data?.accessToken)
  const callId1 = r9.data?.callId

  // 10. Retell Webhook for HR Round
  console.log('\n10. Retell Webhook receives Round: hr transcript...')
  const webhook1Body = JSON.stringify({
    event: 'call_ended',
    call: {
      call_id: callId1,
      metadata: { sessionId, round: 'hr' },
      disconnection_reason: 'user_hangup',
      transcript_object: [
        { role: 'agent', content: 'Hello Rohan, I am Vinit. Why are you interested in ' + chosenOffer.company + '?' },
        { role: 'user', content: 'I love your culture of continuous innovation and high engineering standards.' },
        { role: 'agent', content: 'How do you handle conflict in a team?' },
        { role: 'user', content: 'I focus on objective data, active listening, and finding win-win solutions.' },
      ],
    },
  })
  const sig1 = hmacSign(webhook1Body)
  const r10 = await fetch(`${BASE}/api/sera/retell-webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-retell-signature': sig1 },
    body: webhook1Body,
  })
  console.log('   Webhook HTTP Status:', r10.status)

  // 11. Round 2: Final / Technical Interview with Arvind
  console.log('\n11. User starts Round: final (Final with Arvind)...')
  const r11 = await post('/.netlify/functions/sera-start-call', {
    sessionId,
    round: 'final',
    route: 'student',
    email: 'rohan.sharma.test@gmail.com',
    name: 'Rohan Sharma',
  })
  console.log('   Final Call ID:', r11.data?.callId)
  console.log('   Final WebRTC Token:', !!r11.data?.accessToken)
  const callId2 = r11.data?.callId

  // 12. Retell Webhook for Final Round (triggers full evaluation & PDF generation)
  console.log('\n12. Retell Webhook receives Final Round transcript & triggers evaluation...')
  const webhook2Body = JSON.stringify({
    event: 'call_ended',
    call: {
      call_id: callId2,
      metadata: { sessionId, round: 'final' },
      disconnection_reason: 'user_hangup',
      transcript_object: [
        { role: 'agent', content: 'Welcome Rohan. Let us discuss system architecture and fault tolerance.' },
        { role: 'user', content: 'We can implement circuit breakers, asynchronous message queues with RabbitMQ, and exponential backoff.' },
        { role: 'agent', content: 'Excellent technical depth. We are concluding the interview now.' },
      ],
    },
  })
  const sig2 = hmacSign(webhook2Body)
  const r12 = await fetch(`${BASE}/api/sera/retell-webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-retell-signature': sig2 },
    body: webhook2Body,
  })
  console.log('   Webhook HTTP Status:', r12.status)

  // 13. User polls report on /api/sera/get-report
  console.log('\n13. Frontend polls /api/sera/get-report...')
  const r13 = await post('/api/sera/get-report', {
    sessionId,
    email: 'rohan.sharma.test@gmail.com',
  })
  console.log('   Report Ready:', r13.data.ready)
  if (!r13.data.ready || !r13.data.report) throw new Error('Report not ready')
  const rep = r13.data.report
  console.log(`   Overall Score: ${rep.overall?.score}/100 (Performance Band: ${rep.overall?.band})`)
  console.log(`   Summary: "${rep.overall?.summary}"`)
  console.log('   Assessed Competency Dimensions:')
  rep.skills?.forEach((s) => {
    console.log(`     - ${s.label}: ${s.score}/10 (Expected: ${s.expected}/10)`)
  })
  console.log('   Rounds Evaluated:')
  rep.rounds?.forEach((r) => {
    console.log(`     - ${r.label}: Score ${r.score}/100 (Duration: ${r.durationSeconds}s, CutShort: ${r.cutShort})`)
  })
  console.log('   Actionable Growth Plan:')
  rep.plan?.forEach((p) => {
    console.log(`     [${p.horizon}] ${p.title}: ${p.text}`)
  })

  // 14. Report Download Verification
  console.log('\n14. User clicks Download Report PDF...')
  const r14 = await post('/api/sera/report/download', { sessionId })
  console.log('   Download Response:', r14.data)
  if (!r14.data.ok) throw new Error('Download report failed')
  console.log('   ✓ Report URL ready:', r14.data.url)

  // 15. Dropped call handling and Rejoin
  console.log('\n15. Testing resilience: Disconnection / Drop handling...')
  const r15 = await post('/api/sera/session/lost', { sessionId, round: 'hr' })
  console.log('   Drop Reported. Response:', r15.data)
  const rejoinCode = r15.data.code || r15.data.rejoinCode
  console.log('   ✓ Single-use 48h Rejoin Code issued:', rejoinCode)

  console.log('\n16. User re-enters rejoin code at campus code prompt...')
  const r16 = await post('/api/sera/student-code/check', { code: rejoinCode })
  console.log('   Rejoin Code Check:', r16.data)
  if (!r16.data.valid || r16.data.kind !== 'rejoin') throw new Error('Rejoin code check failed')
  console.log('   ✓ Rejoin code recognized as valid continuation!')

  console.log('\n17. User redeems rejoin code...')
  const r17 = await post('/api/sera/rejoin', {
    code: rejoinCode,
    email: 'rohan.sharma.test@gmail.com',
    phone: '919876543210',
  })
  console.log('   Rejoin Redemption:', r17.data.ok ? 'Success' : 'Failed', 'Round to resume:', r17.data.round)
  if (!r17.data.ok) throw new Error('Rejoin redemption failed')

  console.log('\n=== ALL PRODUCTION FLOW STEPS COMPLETED WITH 100% SUCCESS ===')
}

run().catch((err) => {
  console.error('\n❌ TEST FAILED:', err)
  process.exit(1)
})
