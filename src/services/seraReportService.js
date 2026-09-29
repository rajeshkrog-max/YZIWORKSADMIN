// The ONLY place the report page talks to the backend for the PDF.
// Contract: docs/sera-report-spec.md ("Download report").
import { isMockMode } from './seraAuthService'

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

function saveFile(href, filename) {
  const a = document.createElement('a')
  a.href = href
  if (filename) a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

// Downloads the candidate's PDF. Throws on failure (the button shows the error).
// Server: returns a short-lived signed URL to the PDF that was generated once
// when the report was created, and emails the team a copy ONCE per report.
// `report` is only used by the DEV mock (to build the PDF in the browser).
export async function downloadReport(sessionId, { report } = {}) {
  if (import.meta.env.DEV && isMockMode()) {
    // DEV ONLY — build the PDF in the browser from the sample report.
    const [{ renderReportPdf, reportFilename }, { default: logoUrl }] = await Promise.all([
      import('../../netlify/lib/seraReport/renderReportPdf.js'),
      import('../assets/logo_light.jpeg'),
    ])
    const logoJpeg = new Uint8Array(await (await fetch(logoUrl)).arrayBuffer())
    const bytes = await renderReportPdf(report, { logoJpeg })
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
    saveFile(url, reportFilename(report))
    setTimeout(() => URL.revokeObjectURL(url), 60_000)

    // Idempotent team copy: only the first download "sends" it.
    const key = `sera-mock-team-copy-${sessionId ?? 'preview'}`
    let sent = false
    try {
      sent = sessionStorage.getItem(key) === '1'
      sessionStorage.setItem(key, '1')
    } catch {
      // Storage blocked: the log just repeats.
    }
    console.info(
      sent
        ? '[DEV mock] Team copy already sent for this report — download only.'
        : '[DEV mock] Would email a team copy of this PDF to RESEND_TO_EMAIL (first download only).',
    )
    return
  }

  // TODO(backend): POST /api/sera/report/download — not built yet.
  const data = await postJson('/api/sera/report/download', { sessionId })
  if (!data?.ok || !data.url) throw new Error(data?.error || "Couldn't prepare your report")
  saveFile(data.url, data.filename)
}
