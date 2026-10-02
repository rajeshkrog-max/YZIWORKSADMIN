// Test the FULL end-to-end production user flow directly on the LIVE domain: https://yziworks.com
import crypto from 'node:crypto'

const BASE = 'https://yziworks.com'
const RETELL_SECRET = 'key_e7eff6b92154401ed5b7d9438c1a'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'

function hmacSign(body) {
  const timestamp = Date.now().toString()
  const digest = crypto.createHmac('sha256', RETELL_SECRET).update(body + timestamp).digest('hex')
  return `v=${timestamp},d=${digest}`
}

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': UA,
    },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  let data
  try { data = JSON.parse(text) } catch { data = text }
  return { status: res.status, data }
}

async function run() {
  console.log('=== STARTING LIVE PRODUCTION END-TO-END FLOW TEST ON https://yziworks.com ===\n')

  // 1. Homepage & SPA Routing check
  console.log('1. Checking Live SPA entrypoint (https://yziworks.com/meet-sera)...')
  const homeRes = await fetch(`${BASE}/meet-sera`, { headers: { 'User-Agent': UA } })
  console.log('   HTTP Status:', homeRes.status)
  const homeHtml = await homeRes.text()
  const hasAppRoot = homeHtml.includes('<div id="root"></div>')
  const hasBundle = homeHtml.includes('/assets/index-B8MdC9WA.js')
  console.log('   Has Root Container:', hasAppRoot)
  console.log('   Loads Latest Production Bundle (index-B8MdC9WA.js):', hasBundle)
  if (homeRes.status !== 200 || !hasAppRoot || !hasBundle) {
    throw new Error('Live SPA routing check failed')
  }

  // 2. Check invalid code
  console.log('\n2. User enters invalid campus code "INVALID123"...')
  const r1 = await post('/api/sera/student-code/check', { code: 'INVALID123' })
  console.log('   Response:', r1.data)
  if (r1.data.valid !== false) throw new Error('Expected invalid code to fail')
  console.log('   ✓ Properly rejected with reason:', r1.data.reason)

  // 3. Check valid campus code
  console.log('\n3. User enters valid campus code "YZI-PUNE-OCT26"...')
  const r2 = await post('/api/sera/student-code/check', { code: 'YZI-PUNE-OCT26' })
  console.log('   Response:', r2.data)
  if (!r2.data.valid) throw new Error('Valid code failed')
  console.log(`   ✓ Institute: "${r2.data.instituteName}", Seats: ${r2.data.seatsLeft}`)

  // 4. User Login
  console.log('\n4. User logs in with Google + Campus Code...')
  const r3 = await post('/api/sera/login', {
    route: 'student',
    studentCode: 'YZI-PUNE-OCT26',
    google: {
      name: 'Pooja Verma',
      email: 'pooja.verma.live@gmail.com',
      picture: 'https://lh3.googleusercontent.com/a/default-user',
    },
    phone: '919811223344',
  })
  console.log('   Response:', r3.data)
  const sessionId = r3.data.sessionId || r3.data.login?.sessionId
  if (!r3.data.ok || !sessionId) throw new Error('Login failed')
  console.log('   ✓ Live Session created with ID:', sessionId)

  // 5. Resume upload ticket
  console.log('\n5. User uploads résumé PDF...')
  const r4 = await post('/.netlify/functions/sera-create-upload', {
    filename: 'Pooja_Verma_Resume.pdf',
    contentType: 'application/pdf',
    size: 42000,
  })
  console.log('   Upload URL generated:', r4.data.uploadUrl ? 'Yes' : 'No', 'Key:', r4.data.objectKey)
  const objectKey = r4.data.objectKey

  // 6. Resume extraction & 3 corporate job offers
  console.log('\n6. Backend extracts résumé and generates 3 corporate offers on Live Server...')
  const r5 = await post('/.netlify/functions/sera-extract-resume', { objectKey })
  console.log('   Valid Résumé:', r5.data.valid)
  console.log('   Domain Field:', r5.data.field)
  console.log('   Spoken Highlight:', r5.data.highlight)
  console.log('   Generated Offers Count:', r5.data.offers?.length)
  if (!r5.data.offers || r5.data.offers.length !== 3) throw new Error('Offers generation failed')
  r5.data.offers.forEach((o, i) => {
    console.log(`     [Offer ${i + 1}] ${o.company} - ${o.role} (${o.ctc || (o.ctcMinLpa ? '₹' + o.ctcMinLpa + '–' + o.ctcMaxLpa + ' LPA' : '')})`)
  })
  const chosenOffer = r5.data.offers[0]

  // 7. Round 0: Screening Call with Sera
  console.log('\n7. User clicks "Start Interview" (Round: screening with Sera)...')
  const r6 = await post('/.netlify/functions/sera-start-call', {
    sessionId,
    round: 'screening',
    route: 'student',
    email: 'pooja.verma.live@gmail.com',
    name: 'Pooja Verma',
    studentCode: 'YZI-PUNE-OCT26',
    objectKey,
    highlight: r5.data.highlight,
    field: r5.data.field,
  })
  console.log('   Call ID:', r6.data?.callId)
  console.log('   Live WebRTC Access Token received:', !!r6.data?.accessToken)
  if (!r6.data?.accessToken) throw new Error('Retell call creation failed')
  const callId0 = r6.data?.callId

  // 8. Retell Webhook for Screening Round
  console.log('\n8. Live Retell Webhook receives Round: screening transcript...')
  const webhook0Body = JSON.stringify({
    event: 'call_ended',
    call: {
      call_id: callId0,
      metadata: { sessionId, round: 'screening' },
      disconnection_reason: 'user_hangup',
      transcript_object: [
        { role: 'agent', content: 'Hi Pooja, welcome! Can you tell me about yourself and your tech stack?' },
        { role: 'user', content: 'Hi Sera, I am a software engineer focused on cloud infrastructure, React, and Python services.' },
        { role: 'agent', content: 'What was a challenging system you designed recently?' },
        { role: 'user', content: 'I engineered an automated data ingestion pipeline processing 2 million records daily.' },
        { role: 'agent', content: 'Excellent technical depth. You have successfully cleared this screening round.' },
      ],
    },
  })
  const sig0 = hmacSign(webhook0Body)
  const r7 = await fetch(`${BASE}/api/sera/retell-webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': UA,
      'x-retell-signature': sig0,
    },
    body: webhook0Body,
  })
  console.log('   Live Webhook HTTP Status:', r7.status)
  if (r7.status !== 200) throw new Error('Webhook processing failed')

  // 9. User chooses an offer
  console.log('\n9. User chooses Offer 1 (' + chosenOffer.company + ')...')
  const r8 = await post('/api/sera/offers/choose', {
    sessionId,
    offerId: chosenOffer.id,
  })
  console.log('   Response:', r8.data)
  if (!r8.data.ok) throw new Error('Offer selection failed')

  // 10. Round 1: HR Interview with Vinit
  console.log('\n10. User starts Round: hr (HR with Vinit)...')
  const r9 = await post('/.netlify/functions/sera-start-call', {
    sessionId,
    round: 'hr',
    route: 'student',
    email: 'pooja.verma.live@gmail.com',
    name: 'Pooja Verma',
  })
  console.log('   HR Call ID:', r9.data?.callId)
  console.log('   HR WebRTC Token:', !!r9.data?.accessToken)
  const callId1 = r9.data?.callId

  // 11. Retell Webhook for HR Round
  console.log('\n11. Live Retell Webhook receives Round: hr transcript...')
  const webhook1Body = JSON.stringify({
    event: 'call_ended',
    call: {
      call_id: callId1,
      metadata: { sessionId, round: 'hr' },
      disconnection_reason: 'user_hangup',
      transcript_object: [
        { role: 'agent', content: 'Hello Pooja, I am Vinit. Why are you interested in ' + chosenOffer.company + '?' },
        { role: 'user', content: 'Your mission and rapid engineering cycles strongly resonate with my career goals.' },
        { role: 'agent', content: 'How do you handle deadlines and changing priorities?' },
        { role: 'user', content: 'I prioritize using an impact matrix and communicate blockers early.' },
      ],
    },
  })
  const sig1 = hmacSign(webhook1Body)
  const r10 = await fetch(`${BASE}/api/sera/retell-webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': UA,
      'x-retell-signature': sig1,
    },
    body: webhook1Body,
  })
  console.log('   Live Webhook HTTP Status:', r10.status)
  if (r10.status !== 200) throw new Error('HR webhook failed')

  // 12. Round 2: Final / Technical Interview with Arvind
  console.log('\n12. User starts Round: final (Final with Arvind)...')
  const r11 = await post('/.netlify/functions/sera-start-call', {
    sessionId,
    round: 'final',
    route: 'student',
    email: 'pooja.verma.live@gmail.com',
    name: 'Pooja Verma',
  })
  console.log('   Final Call ID:', r11.data?.callId)
  console.log('   Final WebRTC Token:', !!r11.data?.accessToken)
  const callId2 = r11.data?.callId

  // 13. Retell Webhook for Final Round (triggers full evaluation & PDF generation)
  console.log('\n13. Live Retell Webhook receives Final Round transcript & triggers evaluation...')
  const webhook2Body = JSON.stringify({
    event: 'call_ended',
    call: {
      call_id: callId2,
      metadata: { sessionId, round: 'final' },
      disconnection_reason: 'user_hangup',
      transcript_object: [
        { role: 'agent', content: 'Welcome Pooja. Let us discuss high availability and failover strategies.' },
        { role: 'user', content: 'We can utilize multi-region database replication, DNS failover with Cloudflare, and automated health checks.' },
        { role: 'agent', content: 'Excellent technical depth. We are concluding the interview now.' },
      ],
    },
  })
  const sig2 = hmacSign(webhook2Body)
  const r12 = await fetch(`${BASE}/api/sera/retell-webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': UA,
      'x-retell-signature': sig2,
    },
    body: webhook2Body,
  })
  console.log('   Live Webhook HTTP Status:', r12.status)
  if (r12.status !== 200) throw new Error('Final webhook failed')

  // 14. Frontend polls report on /api/sera/get-report
  console.log('\n14. Frontend polls /api/sera/get-report on Live Server...')
  const r13 = await post('/api/sera/get-report', {
    sessionId,
    email: 'pooja.verma.live@gmail.com',
  })
  console.log('   Report Ready:', r13.data.ready)
  if (!r13.data.ready || !r13.data.report) throw new Error('Report not ready')
  const rep = r13.data.report
  console.log(`   Overall Score: ${rep.overall?.score}/100 (Band: ${rep.overall?.band})`)
  console.log(`   Executive Summary: "${rep.overall?.summary}"`)
  console.log('   Assessed Skills:')
  rep.skills?.forEach((s) => {
    console.log(`     - ${s.label}: ${s.score}/10 (Expected: ${s.expected}/10)`)
  })
  console.log('   Rounds Assessed:')
  rep.rounds?.forEach((r) => {
    console.log(`     - ${r.label}: Duration ${r.durationSeconds}s, CutShort: ${r.cutShort}`)
  })
  console.log('   Actionable Roadmap:')
  rep.plan?.forEach((p) => {
    console.log(`     [${p.horizon}] ${p.title}: ${p.text}`)
  })

  // 15. Report Download Verification
  console.log('\n15. User clicks Download Report PDF...')
  const r14 = await post('/api/sera/report/download', { sessionId })
  console.log('   Download Response:', r14.data)
  if (!r14.data.ok) throw new Error('Download report failed')
  console.log('   ✓ Live R2 Report Download URL ready:', r14.data.url)

  // 16. Dropped call handling and Rejoin
  console.log('\n16. Testing resilience on Live Server: Disconnection / Drop handling...')
  const r15 = await post('/api/sera/session/lost', { sessionId, round: 'hr' })
  console.log('   Drop Reported. Response:', r15.data)
  const rejoinCode = r15.data.code || r15.data.rejoinCode
  console.log('   ✓ Single-use 48h Rejoin Code issued:', rejoinCode)

  console.log('\n17. User re-enters rejoin code at campus code prompt on Live Server...')
  const r16 = await post('/api/sera/student-code/check', { code: rejoinCode })
  console.log('   Rejoin Code Check:', r16.data)
  if (!r16.data.valid || r16.data.kind !== 'rejoin') throw new Error('Rejoin code check failed')
  console.log('   ✓ Rejoin code recognized as valid continuation!')

  console.log('\n18. User redeems rejoin code on Live Server...')
  const r17 = await post('/api/sera/rejoin', {
    code: rejoinCode,
    email: 'pooja.verma.live@gmail.com',
    phone: '919811223344',
  })
  console.log('   Rejoin Redemption:', r17.data.ok ? 'Success' : 'Failed', 'Round to resume:', r17.data.round)
  if (!r17.data.ok) throw new Error('Rejoin redemption failed')

  console.log('\n🎉 ALL LIVE PRODUCTION FLOW TESTS ON https://yziworks.com PASSED WITH 100% SUCCESS!')
}

run().catch((err) => {
  console.error('\n❌ LIVE TEST FAILED:', err)
  process.exit(1)
})
