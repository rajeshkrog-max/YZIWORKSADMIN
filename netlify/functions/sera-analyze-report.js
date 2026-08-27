import { generateJson } from '../lib/gemini.js'
import { REPORT_SCHEMA, buildReportPrompt } from '../lib/seraReport.js'

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  try {
    const { candidateName, resumeText, transcript } = JSON.parse(event.body || '{}')

    if (typeof transcript !== 'string' || transcript.trim().length < 20) {
      return { statusCode: 400, body: JSON.stringify({ error: 'A transcript is required' }) }
    }

    const report = await generateJson({
      schema: REPORT_SCHEMA,
      prompt: buildReportPrompt({ candidateName, resumeText, transcript }),
    })

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, report }),
    }
  } catch (error) {
    console.error('Sera analyze report error:', error)
    return { statusCode: 500, body: JSON.stringify({ error: 'Unable to prepare your report' }) }
  }
}
