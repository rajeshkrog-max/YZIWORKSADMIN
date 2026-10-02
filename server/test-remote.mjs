// Test script to verify local backend endpoints
async function runTests() {
  const base = 'http://127.0.0.1:4005'

  console.log('1. Health check:')
  const health = await fetch(`${base}/health`).then((r) => r.json())
  console.log('Health:', health)

  console.log('\n2. Student code check:')
  const student = await fetch(`${base}/api/sera/student-code/check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'YZI-PUNE-OCT26' }),
  }).then((r) => r.json())
  console.log('Student code check:', student)

  console.log('\n3. Rejoin code check:')
  const rejoin = await fetch(`${base}/api/sera/student-code/check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'REJOIN-ABC' }),
  }).then((r) => r.json())
  console.log('Rejoin check:', rejoin)

  console.log('\n4. Login creation:')
  const login = await fetch(`${base}/api/sera/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      route: 'student',
      google: { name: 'Vaibhav Sharma', email: 'vaibhav@example.com' },
      phone: '9399977437',
      studentCode: 'YZI-PUNE-OCT26',
    }),
  }).then((r) => r.json())
  console.log('Login result:', login)

  if (login.login?.sessionId) {
    console.log('\n5. Offers choose test:')
    const choose = await fetch(`${base}/api/sera/offers/choose`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: login.login.sessionId,
        offerId: 'offer_1',
      }),
    }).then((r) => r.json())
    console.log('Offers choose result:', choose)

    console.log('\n6. Connection lost test (rejoin issue):')
    const lost = await fetch(`${base}/api/sera/session/lost`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: login.login.sessionId,
        round: 'screening',
      }),
    }).then((r) => r.json())
    console.log('Connection lost result:', lost)

    console.log('\n7. Report fetch test (before completion):')
    const report = await fetch(`${base}/api/sera/get-report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: login.login.sessionId,
      }),
    }).then((r) => r.json())
    console.log('Get report result:', report)
  }
}

runTests().catch(console.error)
