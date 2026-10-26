// Checks the microphone BEFORE anything costs money (the résumé read, the payment, the call). A denied
// or missing mic used to surface only after the call was created, as "the call dropped unexpectedly".
// → { ok: true } | { ok: false, error }
export async function checkMicrophone() {
  if (typeof window === 'undefined' || !window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    return {
      ok: false,
      error:
        "This browser can't use your microphone here. Open yziworks.com/meet-sera in Chrome or Safari (not inside WhatsApp, Instagram or another app's browser).",
    }
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    stream.getTracks().forEach((track) => track.stop())
    return { ok: true }
  } catch (err) {
    const name = err?.name
    if (name === 'NotAllowedError' || name === 'SecurityError' || name === 'PermissionDeniedError') {
      return {
        ok: false,
        error: 'Sera needs your microphone. Allow microphone access for this site (the icon next to the address bar, or your phone settings), then try again.',
      }
    }
    if (name === 'NotFoundError' || name === 'OverconstrainedError' || name === 'DevicesNotFoundError') {
      return { ok: false, error: 'No microphone was found. Connect or turn on a microphone (or use your phone), then try again.' }
    }
    if (name === 'NotReadableError' || name === 'AbortError' || name === 'TrackStartError') {
      return { ok: false, error: 'Your microphone is busy in another app (a call, Zoom or Meet). Close it, then try again.' }
    }
    return { ok: false, error: "We couldn't turn on your microphone. Check it works in another app, then try again." }
  }
}
