// The ONLY place the offer tiles talk to the backend. Contract:
// docs/sera-interview-contract.md
//
// The 3 offers themselves arrive with the résumé check (seraResumeService) and
// live on the session (src/shared/seraSession.js); this only saves the choice.
import { isMockMode } from './seraAuthService'

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function postJson(path, body) {
  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.headers.get('content-type')?.includes('application/json')) return null
    return await res.json()
  } catch {
    return null
  }
}

// → { ok: true } | { ok: false, error }
export async function saveOfferChoice(sessionId, offerId) {
  if (import.meta.env.DEV && isMockMode()) {
    await wait(150)
    return { ok: true }
  }
  // TODO(backend): POST /api/sera/offers/choose — not built yet.
  const data = await postJson('/api/sera/offers/choose', { sessionId, offerId })
  if (typeof data?.ok !== 'boolean') return { ok: false, error: "We couldn't save your choice. Please try again." }
  return data
}
