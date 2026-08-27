// Single-PDF R2 upload for the Meet Sera flow.
// Deliberately separate from src/utils/r2Upload.js (used by the application
// funnel) — different folder namespace, single file, PDF-only.

const SERA_CREATE_UPLOAD_ENDPOINT = '/.netlify/functions/sera-create-upload'

const MAX_SIZE = 10 * 1024 * 1024

export async function uploadResumeToR2(file) {
  if (!file) {
    throw new Error('Please select a résumé to upload')
  }

  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
  if (!isPdf) {
    throw new Error('Sera only reads PDF résumés — please upload a .pdf file')
  }

  if (file.size > MAX_SIZE) {
    throw new Error('That file is over 10 MB — please upload a smaller PDF')
  }

  const prepareResponse = await fetch(SERA_CREATE_UPLOAD_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type || 'application/pdf',
      size: file.size,
    }),
  })

  const prepareResult = await prepareResponse.json()

  if (!prepareResponse.ok || !prepareResult.success || !prepareResult.uploadUrl) {
    throw new Error(prepareResult.error || 'Unable to prepare the upload')
  }

  const uploadResponse = await fetch(prepareResult.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type || 'application/pdf' },
    body: file,
  })

  if (!uploadResponse.ok) {
    throw new Error(`Upload failed (${uploadResponse.status})`)
  }

  return {
    objectKey: prepareResult.objectKey,
    originalFilename: file.name,
    size: file.size,
  }
}
