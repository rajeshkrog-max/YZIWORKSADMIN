import { getEligibilityStore } from '../lib/eligibilityStore.js'

// Releases an in-progress 'reserved' eligibility slot when the client
// detects the call itself never really got going (see useSeraInterview's
// stall-recovery handler) — mirrors the same release sera-start-call.js
// already does when Retell's own call-creation fails outright. Only
// releases a record that's still 'reserved'; never touches a completed
// or already-incomplete record, so this can't be used to wipe someone's
// real result.
export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  try {
    const { email } = JSON.parse(event.body || '{}')

    if (typeof email !== 'string' || !email.includes('@')) {
      return { statusCode: 400, body: JSON.stringify({ error: 'A valid email is required' }) }
    }

    const store = getEligibilityStore()
    const record = await store.get(email.toLowerCase(), { type: 'json' })

    if (record?.status === 'reserved') {
      await store.delete(email.toLowerCase())
    }

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({ released: true }),
    }
  } catch (error) {
    console.error('Sera release reservation error:', error)
    return { statusCode: 500, body: JSON.stringify({ error: 'Unable to release reservation' }) }
  }
}
