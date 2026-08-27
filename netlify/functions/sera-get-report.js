import { getStore } from '@netlify/blobs'

// Polled by the browser after a call ends. Zero LLM cost — just reads back
// whatever the webhook already computed, so the report is never generated
// twice for the same candidate.
export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  try {
    const { email } = JSON.parse(event.body || '{}')

    if (typeof email !== 'string' || !email.includes('@')) {
      return { statusCode: 400, body: JSON.stringify({ error: 'A valid email is required' }) }
    }

    const store = getStore('sera-eligibility')
    const record = await store.get(email.toLowerCase(), { type: 'json' })

    if (record?.status === 'completed' && record.report) {
      return {
        statusCode: 200,
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
        body: JSON.stringify({ ready: true, report: record.report }),
      }
    }

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({ ready: false }),
    }
  } catch (error) {
    console.error('Sera get report error:', error)
    return { statusCode: 500, body: JSON.stringify({ error: 'Unable to check your report' }) }
  }
}
