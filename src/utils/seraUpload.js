// Single-PDF R2 upload for the Meet Sera flow.
// Deliberately separate from src/utils/r2Upload.js (used by the application
// funnel) — different folder namespace, single file, PDF-only.

const SERA_CREATE_UPLOAD_ENDPOINT = '/api/sera/create-upload'

const MAX_SIZE = 10 * 1024 * 1024

// A PDF is a file whose first bytes are "%PDF-". Judged by content, not by name: phones,
// downloads and chat apps routinely save a real PDF as "Resume", "resume.pdf (1)" or "resume.pdf ".
export async function isPdfFile(file) {
  try {
    const head = new Uint8Array(await file.slice(0, 5).arrayBuffer())
    return String.fromCharCode(...head) === '%PDF-'
  } catch {
    return false
  }
}

export async function uploadResumeToR2(file) {
  if (!file) {
    throw new Error('Please select a résumé to upload')
  }

  if (!(await isPdfFile(file))) {
    throw new Error("Sera only reads PDF résumés — this file doesn't look like a PDF")
  }

  if (file.size > MAX_SIZE) {
    throw new Error('That file is over 10 MB — please upload a smaller PDF')
  }

  // Convert to base64 so upload goes directly to our server and into R2
  // completely bypassing browser-to-R2 CORS preflight issues
  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const res = reader.result
      const b64 = typeof res === 'string' && res.includes(',') ? res.split(',')[1] : res
      resolve(b64)
    }
    reader.onerror = () => reject(new Error('Failed to read résumé file'))
    reader.readAsDataURL(file)
  })

  const uploadResponse = await fetch(SERA_CREATE_UPLOAD_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filename: file.name,
      contentType: 'application/pdf', // verified above by content
      size: file.size,
      base64,
    }),
  })

  if (!uploadResponse.ok) {
    throw new Error(`Upload failed (${uploadResponse.status})`)
  }

  const result = await uploadResponse.json()

  if (!result.success || !result.objectKey) {
    throw new Error(result.error || 'Unable to upload résumé. Please try again.')
  }

  return {
    objectKey: result.objectKey,
    originalFilename: file.name,
    size: file.size,
  }
}

