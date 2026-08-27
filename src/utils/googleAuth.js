// Google Sign-In via Google Identity Services (token client flow).
// Mirrors the loadMsg91Script() pattern already used in src/utils/msg91.js —
// load the external script once, then call the global it exposes.

export function loadGoogleScript() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) {
      resolve()
      return
    }

    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Google sign-in script'))
    document.head.appendChild(script)
  })
}

export async function signInWithGoogle() {
  await loadGoogleScript()

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID

  if (!clientId) {
    throw new Error('Google sign-in is not configured')
  }

  const accessToken = await new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'openid email profile',
      callback: (response) => {
        if (response.error) {
          reject(new Error(response.error))
          return
        }
        resolve(response.access_token)
      },
      error_callback: (error) => {
        reject(new Error(error?.type || 'Google sign-in failed'))
      },
    })

    client.requestAccessToken()
  })

  const profileResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!profileResponse.ok) {
    throw new Error('Unable to load your Google profile')
  }

  const profile = await profileResponse.json()

  return {
    name: profile.name || profile.given_name || 'there',
    email: profile.email,
    picture: profile.picture || null,
  }
}
