import { getStore } from '@netlify/blobs'

// Netlify is supposed to auto-inject siteID/token into every Function's
// environment so getStore() needs no config — but that auto-injection was
// confirmed not reaching functions in this project (MissingBlobsEnvironmentError
// on sera-start-call.js AND sera-get-report.js). This explicit fallback
// unblocks all Blobs usage; it requires NETLIFY_SITE_ID (usually already
// present) and a manually created Personal Access Token stored as
// NETLIFY_BLOBS_TOKEN.
export function getEligibilityStore() {
  const siteID = process.env.NETLIFY_SITE_ID
  const token = process.env.NETLIFY_BLOBS_TOKEN

  if (siteID && token) {
    return getStore({ name: 'sera-eligibility', siteID, token })
  }

  // Falls through to automatic config in case it starts working again —
  // this keeps the explicit path as an opt-in fallback, not a replacement.
  return getStore('sera-eligibility')
}
