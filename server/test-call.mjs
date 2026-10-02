// Test script to test Retell create-web-call from live backend
async function testCall() {
  const base = 'http://127.0.0.1:4005'

  // 1. Create a test session
  const loginRes = await fetch(`${base}/api/sera/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      route: 'student',
      google: { name: 'Test Candidate', email: 'testcandidate@example.com' },
      phone: '9399977437',
      studentCode: 'YZI-PUNE-OCT26',
    }),
  }).then((r) => r.json())

  console.log('Login:', loginRes)
  const sessionId = loginRes.login?.sessionId

  // 2. Start screening call
  const callRes = await fetch(`${base}/api/sera/start-call`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId,
      round: 'screening',
      route: 'student',
      email: 'testcandidate@example.com',
      studentCode: 'YZI-PUNE-OCT26',
    }),
  }).then((r) => r.json())

  console.log('Start call result:', callRes)
}

testCall().catch(console.error)
