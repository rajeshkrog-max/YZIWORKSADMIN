import { useEffect, useRef, useState } from 'react'
import SeraWave from '../SeraWave'
import GlassBlobs from './GlassBlobs'
import LoginTabs from './LoginTabs'
import GoogleStep from './GoogleStep'
import StudentCodeStep from './StudentCodeStep'
import WhatsAppStep from './WhatsAppStep'
import ManualIdentityStep from './ManualIdentityStep'
import { typedIdentityOrNull } from './typedIdentity'
import DemoAccess from './DemoAccess'
import { checkStudentCode, completeLogin } from '../../../services/seraAuthService'
import { redeemRejoin } from '../../../services/seraSessionService'

const CODE_DEBOUNCE_MS = 450
const SUBTITLES = {
  visitor: 'Sign in to start your interview.',
  student: 'Use the code your campus shared with you.',
}
const REJOIN_LINK_ERRORS = {
  expired: 'This link has expired.',
  used: 'This link has already been used.',
  mismatch: "This link doesn't match this account. Use the same Google account and WhatsApp number as before.",
  invalid: "This link isn't valid.",
}

// Glass login card. Steps unlock in order and each turns into a green ✓ row:
//   New User (route 'visitor'): Google → WhatsApp OTP → Continue
//   Student: Google → student code → WhatsApp OTP → Continue
// Without Google, "Use WhatsApp" swaps the Google row for a typed name and email
// (not verified; the server keeps it to one interview per email).
// The WhatsApp step stays locked until the code is valid, so no OTP is spent
// on a bad code. Google and phone survive a tab switch; only the code row toggles.
//
// Rejoin after a dropped call (both must match the original Google + WhatsApp):
//   New User: rejoinToken from /meet-sera?rejoin=TOKEN → banner, no tabs.
//   Student: a one-time rejoin code typed in the Student code field.
// Either way onRejoin({ session, round }) resumes the interview (no upload, no pay).
// initialCode (DEV ONLY) pre-fills the Student tab with a code.
function SeraLogin({ onDone, onRejoin, rejoinToken = null, initialCode = null, initialTab = 'visitor' }) {
  const [tab, setTab] = useState(initialCode ? 'student' : initialTab)
  const [google, setGoogle] = useState(null) // { name, email, picture, accessToken }
  const [useTyped, setUseTyped] = useState(false) // no Google: name and email typed in
  const [typed, setTyped] = useState({ name: '', email: '' })
  const [phone, setPhone] = useState(null) // { number, token }
  const [code, setCode] = useState(initialCode ?? '')
  const [codeStatus, setCodeStatus] = useState({ state: initialCode ? 'checking' : 'idle' })
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  const timerRef = useRef(null)
  const checkIdRef = useRef(0)

  const isStudent = !rejoinToken && tab === 'student'
  const codeOk = codeStatus.state === 'valid' || codeStatus.state === 'rejoin'
  const manual = useTyped ? typedIdentityOrNull(typed) : null
  const identity = useTyped ? manual : google
  const canContinue = Boolean(identity && phone && (!isStudent || codeOk)) && !submitting

  // Debounced server check; state updates happen only in the timer callback.
  const scheduleCheck = (next) => {
    clearTimeout(timerRef.current)
    const id = ++checkIdRef.current
    timerRef.current = setTimeout(async () => {
      const result = await checkStudentCode(next)
      if (id !== checkIdRef.current) return // a newer keystroke superseded this check
      if (!result.valid) {
        const known = ['unavailable', 'expired', 'used'].includes(result.reason)
        setCodeStatus({ state: known ? result.reason : 'invalid' })
      } else if (result.kind === 'rejoin') {
        setCodeStatus({ state: 'rejoin' })
      } else if (result.seatsLeft > 0) {
        setCodeStatus({ state: 'valid', instituteName: result.instituteName, seatsLeft: result.seatsLeft })
      } else {
        setCodeStatus({ state: 'full' })
      }
    }, CODE_DEBOUNCE_MS)
  }

  useEffect(() => {
    if (initialCode) scheduleCheck(initialCode)
    return () => clearTimeout(timerRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once for the pre-filled code
  }, [])

  const changeCode = (next) => {
    setCode(next)
    setSubmitError(null)
    if (next.trim().length < 4) {
      clearTimeout(timerRef.current)
      ++checkIdRef.current
      setCodeStatus({ state: 'idle' })
      return
    }
    setCodeStatus({ state: 'checking' })
    scheduleCheck(next)
  }

  // A rejoin code rejected as "doesn't match this account" gets a fresh check
  // once the Google account or phone changes.
  const recheckMismatch = () => {
    if (codeStatus.state !== 'mismatch') return
    setCodeStatus({ state: 'checking' })
    scheduleCheck(code)
  }
  const signedIn = (next) => {
    setGoogle(next)
    recheckMismatch()
  }
  const phoneVerified = (next) => {
    setPhone(next)
    recheckMismatch()
  }

  const rejoin = async () => {
    const result = await redeemRejoin({
      token: rejoinToken ?? undefined,
      code: rejoinToken ? undefined : code.trim(),
      email: identity.email,
      phone: phone.number,
      name: identity.name,
    })
    setSubmitting(false)
    if (result.ok) {
      onRejoin(result)
    } else if (rejoinToken) {
      setSubmitError(REJOIN_LINK_ERRORS[result.reason] ?? REJOIN_LINK_ERRORS.invalid)
    } else {
      setCodeStatus({ state: ['expired', 'used', 'mismatch'].includes(result.reason) ? result.reason : 'invalid' })
    }
  }

  const submit = async () => {
    if (!canContinue) return
    setSubmitting(true)
    setSubmitError(null)
    if (rejoinToken || (isStudent && codeStatus.state === 'rejoin')) return rejoin()
    const result = await completeLogin({
      route: tab,
      google: useTyped ? null : google,
      manual,
      phone: phone.number,
      msg91Token: phone.token,
      studentCode: isStudent ? code.trim() : null,
    })
    setSubmitting(false)
    if (result.ok) onDone(result.login, { resumed: result.resumed === true })
    else setSubmitError(result.error || 'Something went wrong. Please try again.')
  }

  return (
    <div className="w-full flex flex-col items-center text-center">
      {/* Full-bleed band: stays in flow here, but the canvas stretches to the
          viewport's left and right edges. */}
      <SeraWave state="idle" bleed className="w-full h-[140px] md:h-[200px] mb-6" />

      <div className="relative w-full max-w-[420px]">
        <GlassBlobs />

        <div className="relative rounded-[26px] border border-white/10 light:border-white/80 bg-card/55 light:bg-white/55 backdrop-blur-[22px] shadow-[0_24px_60px_rgba(0,0,0,0.45)] light:shadow-[0_24px_60px_rgba(76,29,149,0.14)] p-6 sm:p-8">
          {rejoinToken && (
            <p className="mb-4 -mt-1 inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-yzi-cyan/40 bg-yzi-cyan/10 text-xs font-semibold text-accent-cyan-fg">
              <span className="w-1.5 h-1.5 rounded-full bg-yzi-cyan" aria-hidden="true" />
              Continue your interview
            </p>
          )}
          <h2 className="text-2xl font-bold text-fg">Meet Sera</h2>
          <p className="mt-1.5 mb-6 text-sm text-fg/60">
            {rejoinToken ? 'Sign in with the same Google account and WhatsApp number as before.' : SUBTITLES[tab]}
          </p>

          {!rejoinToken && <LoginTabs value={tab} onChange={(next) => { setTab(next); setSubmitError(null) }} />}

          <div className={`${rejoinToken ? '' : 'mt-5 '}flex flex-col gap-3`}>
            {useTyped ? (
              <ManualIdentityStep value={typed} onChange={(next) => { setTyped(next); setSubmitError(null) }} />
            ) : (
              <GoogleStep google={google} onSignedIn={signedIn} onChange={() => setGoogle(null)} />
            )}
            {!rejoinToken && (
              <button
                type="button"
                onClick={() => { setUseTyped(!useTyped); setSubmitError(null) }}
                className="-mt-1 self-start text-xs text-fg/60 underline underline-offset-2 hover:text-fg"
              >
                {useTyped ? 'Sign in with Google instead' : 'No Google account? Use WhatsApp and your email'}
              </button>
            )}

            {isStudent && (
              <StudentCodeStep code={code} status={codeStatus} locked={!identity} onCodeChange={changeCode} />
            )}

            <WhatsAppStep
              phone={phone}
              locked={!identity || (isStudent && !codeOk)}
              onVerified={phoneVerified}
              onChange={() => setPhone(null)}
            />
          </div>

          <button
            type="button"
            onClick={submit}
            disabled={!canContinue}
            className="mt-6 w-full h-[50px] rounded-full bg-gradient-to-r from-yzi-orange via-yzi-pink to-yzi-purple text-white font-semibold transition hover:brightness-110 disabled:from-fg/15 disabled:via-fg/15 disabled:to-fg/15 disabled:text-fg/40 disabled:cursor-not-allowed disabled:hover:brightness-100"
          >
            {submitting ? 'Signing you in…' : 'Continue'}
          </button>
          {submitError && <p className="mt-2 text-xs text-red-400 light:text-red-600">{submitError}</p>}

          <p className="mt-5 text-xs text-fg/45">We only use your number to verify it's you.</p>
        </div>
      </div>

      {!rejoinToken && <DemoAccess onDone={onDone} />}
    </div>
  )
}

export default SeraLogin
