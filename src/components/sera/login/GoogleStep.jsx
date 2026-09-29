import { useState } from 'react'
import { createPortal } from 'react-dom'
import { signInWithGoogle } from '../../../utils/googleAuth'
import { isMockMode } from '../../../services/seraAuthService'

const MOCK_ACCOUNTS = [
  { name: 'Priya Sharma', email: 'priya.sharma@gmail.com' },
  { name: 'Arjun Mehta', email: 'arjun.mehta@gmail.com' },
  // DEV ONLY — same accounts as ?testlogin=visitor|student, so a test session
  // can be rejoined. Stripped from production builds.
  ...(import.meta.env.DEV
    ? [
        { name: 'Test Visitor', email: 'visitor.test@gmail.com' },
        { name: 'Test Student', email: 'student.test@gmail.com' },
      ]
    : []),
]

const GoogleLogo = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
    <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62z" />
    <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.96v2.33A9 9 0 0 0 9 18z" />
    <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.66 9c0-.59.1-1.17.29-1.7V4.97H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.03l2.99-2.33z" />
    <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.97l2.99 2.33C4.66 5.17 6.65 3.58 9 3.58z" />
  </svg>
)

function Avatar({ google }) {
  if (google.picture) {
    return <img src={google.picture} alt="" referrerPolicy="no-referrer" className="w-7 h-7 rounded-full shrink-0" />
  }
  return (
    <span className="w-7 h-7 rounded-full shrink-0 grid place-items-center bg-gradient-to-br from-yzi-cyan to-yzi-purple text-white text-xs font-bold">
      {(google.name || google.email || '?').charAt(0).toUpperCase()}
    </span>
  )
}

// Mock mode only: stands in for Google's account chooser.
function MockGooglePopup({ onPick, onCancel }) {
  // Portalled to <body>: the glass card's backdrop-filter would otherwise
  // trap this fixed overlay inside the card.
  return createPortal(
    <div className="fixed inset-0 z-[300] grid place-items-center bg-black/50 backdrop-blur-sm px-6" onClick={onCancel}>
      <div
        role="dialog"
        aria-label="Choose an account (mock)"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xs rounded-2xl bg-card border border-fg/10 p-5 text-left shadow-2xl"
      >
        <p className="text-[11px] font-semibold uppercase tracking-widest text-accent-orange-fg mb-1">Mock Google</p>
        <h3 className="text-fg font-semibold mb-3">Choose an account</h3>
        {MOCK_ACCOUNTS.map((account) => (
          <button
            key={account.email}
            type="button"
            onClick={() => onPick(account)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-fg/5 text-left"
          >
            <Avatar google={account} />
            <span className="min-w-0">
              <span className="block text-sm text-fg">{account.name}</span>
              <span className="block text-xs text-fg/55 truncate">{account.email}</span>
            </span>
          </button>
        ))}
        <button type="button" onClick={onCancel} className="mt-3 text-sm text-fg/60 hover:text-fg">
          Cancel
        </button>
      </div>
    </div>,
    document.body,
  )
}

// Step 1 — Google button, or the verified email row once signed in.
function GoogleStep({ google, onSignedIn, onChange }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [mockOpen, setMockOpen] = useState(false)

  const start = async () => {
    setError(null)
    if (isMockMode()) {
      setMockOpen(true)
      return
    }
    setBusy(true)
    try {
      // { name, email, picture, accessToken } — the server re-checks the email with the token.
      onSignedIn(await signInWithGoogle())
    } catch (err) {
      setError(err.message || 'Google sign-in failed. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const pickMock = (account) => {
    setMockOpen(false)
    onSignedIn({ ...account, picture: null, accessToken: 'mock-google-token' })
  }

  if (google) {
    return (
      <div className="flex items-center gap-3 h-[50px] px-3.5 rounded-[14px] border border-emerald-500/40 bg-emerald-500/10">
        <Avatar google={google} />
        <span className="flex-1 min-w-0 truncate text-sm text-fg text-left">{google.email}</span>
        <span className="text-emerald-500 font-bold" aria-label="Verified">✓</span>
        <button type="button" onClick={onChange} className="text-xs text-fg/60 underline underline-offset-2 hover:text-fg">
          Change
        </button>
      </div>
    )
  }

  return (
    <div>
      <button
        type="button"
        onClick={start}
        disabled={busy}
        className="w-full h-[50px] flex items-center justify-center gap-3 rounded-[14px] bg-fg/5 border border-fg/10 hover:bg-fg/10 hover:border-fg/25 light:bg-white/70 text-fg text-sm font-medium transition disabled:opacity-50"
      >
        {busy ? <span className="w-4 h-4 rounded-full border-2 border-fg/30 border-t-fg animate-spin" /> : <GoogleLogo />}
        {busy ? 'Signing you in…' : 'Continue with Google'}
      </button>
      {error && <p className="mt-1.5 text-xs text-left text-red-400 light:text-red-600">{error}</p>}
      {mockOpen && <MockGooglePopup onPick={pickMock} onCancel={() => setMockOpen(false)} />}
    </div>
  )
}

export default GoogleStep
