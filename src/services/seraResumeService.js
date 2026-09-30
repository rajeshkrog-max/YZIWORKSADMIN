// The ONLY place the résumé step talks to the backend: upload to R2, then the
// résumé check, which ALSO generates the 3 offers (netlify/lib/seraOffers —
// one read of the résumé, offers ready before screening ends).
// Contract: docs/sera-interview-contract.md ("Résumé + offers").
import { uploadResumeToR2 } from '../utils/seraUpload'
import { isMockMode } from './seraAuthService'

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// → { ok: true, resume: { objectKey, highlight, field }, offers: [3] }
//   | { ok: false, rejected: true, error }  — not a résumé: ask for another file
//   | { ok: false, rejected: false, error } — our side failed: don't blame the file
export async function prepareResume(file) {
  if (import.meta.env.DEV && isMockMode()) {
    // DEV ONLY — the real offers module on the sample résumé. A file name
    // containing "bad" simulates a rejected résumé.
    await wait(900)
    if (/bad/i.test(file.name)) return { ok: false, rejected: true, error: "That doesn't look like a résumé — please try another file." }
    const { mockPreparedResume } = await import('./seraMockReport')
    return { ok: true, ...(await mockPreparedResume(file.name)) }
  }

  const uploaded = await uploadResumeToR2(file)
  let data
  let httpOk = false
  try {
    const res = await fetch('/.netlify/functions/sera-extract-resume', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ objectKey: uploaded.objectKey }),
    })
    httpOk = res.ok
    data = await res.json()
  } catch {
    data = null
  }

  if (!httpOk || !data) {
    return { ok: false, rejected: false, error: data?.error || 'Something went wrong reading your résumé — please try again in a moment.' }
  }
  if (!data.valid) return { ok: false, rejected: true, error: data.reason || "That doesn't look like a résumé — please try another file." }
  // TODO(backend): sera-extract-resume must return `offers` (generateOffers).
  if (!Array.isArray(data.offers) || data.offers.length !== 3) {
    return { ok: false, rejected: false, error: "We couldn't prepare your offers — please try again in a moment." }
  }
  return {
    ok: true,
    resume: { objectKey: uploaded.objectKey, highlight: data.highlight ?? '', field: data.field ?? '' },
    offers: data.offers,
  }
}
