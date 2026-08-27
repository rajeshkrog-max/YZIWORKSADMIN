import { getEligibilityStore } from '../lib/eligibilityStore.js'

const RETELL_CREATE_CALL_URL = 'https://api.retellai.com/v2/create-web-call'

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }
}

// Comma-separated allowlist (env var, not hardcoded) so test/admin accounts
// can run the interview repeatedly without tripping the one-per-account gate.
function isAdminEmail(email) {
  const allowlist = (process.env.SERA_ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  return allowlist.includes(email.toLowerCase())
}

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' })
  }

  try {
    const { email, name, resumeText, highlight, field, objectKey } = JSON.parse(event.body || '{}')

    if (typeof email !== 'string' || !email.includes('@')) {
      return jsonResponse(400, { error: 'A valid Google account is required' })
    }
    if (typeof objectKey !== 'string' || !objectKey.startsWith('sera-interviews/')) {
      return jsonResponse(400, { error: 'Invalid attachment location' })
    }

    const store = getEligibilityStore()
    const isAdmin = isAdminEmail(email)

    if (!isAdmin) {
      const existing = await store.get(email.toLowerCase())
      if (existing) {
        return jsonResponse(403, {
          error: 'already-used',
          message: "You've already completed your interview with Sera — thanks for stopping by!",
        })
      }
    }

    // Reserve immediately so two tabs / a double-click can't both slip through
    // before the call is actually created. resumeText is stashed here too so
    // the webhook can build the report without re-parsing the PDF.
    await store.setJSON(email.toLowerCase(), {
      status: 'reserved',
      name,
      objectKey,
      resumeText: resumeText || '',
      startedAt: new Date().toISOString(),
    })

    const apiKey = process.env.RETELL_API_KEY
    const agentId = process.env.RETELL_AGENT_ID

    if (!apiKey || !agentId) {
      return jsonResponse(500, { error: 'Interview service is not configured' })
    }

    const retellResponse = await fetch(RETELL_CREATE_CALL_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        agent_id: agentId,
        retell_llm_dynamic_variables: {
          candidate_name: name || 'there',
          resume_highlight: highlight || '',
          field: field || '',
        },
        metadata: {
          email,
          objectKey,
        },
      }),
    })

    if (!retellResponse.ok) {
      const errorBody = await retellResponse.text().catch(() => '')
      console.error('Retell create-web-call failed:', retellResponse.status, errorBody)
      // Release the reservation since the call never actually started.
      await store.delete(email.toLowerCase())
      return jsonResponse(502, { error: 'Unable to start the interview — please try again' })
    }

    const retellData = await retellResponse.json()

    return jsonResponse(200, {
      success: true,
      accessToken: retellData.access_token,
      callId: retellData.call_id,
    })
  } catch (error) {
    console.error('Sera start call error:', error)
    return jsonResponse(500, { error: 'Unable to start the interview' })
  }
}
