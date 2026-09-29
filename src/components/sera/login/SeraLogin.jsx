import { useEffect, useRef, useState } from 'react'
import SeraWave from '../SeraWave'
import GlassBlobs from './GlassBlobs'
import LoginTabs from './LoginTabs'
import GoogleStep from './GoogleStep'
import StudentCodeStep from './StudentCodeStep'
import WhatsAppStep from './WhatsAppStep'
import { checkStudentCode, completeLogin } from '../../../services/seraAuthService'

const CODE_DEBOUNCE_MS = 450
const SUBTITLES = {
  visitor: 'Sign in to start your interview.',
  student: 'Use the code your campus shared with you.',
}

// Glass login card. Steps unlock in order and each turns into a green ✓ row:
//   Visitor: Google → WhatsApp OTP → Continue
//   Student: Google → student code → WhatsApp OTP → Continue
// The WhatsApp step stays locked until the code is valid, so no OTP is spent
// on a bad code. Google and phone survive a tab switch; only the code row toggles.
function SeraLogin({ onDone }) {
  const [tab, setTab] = useState('visitor')
  const [google, setGoogle] = useState(null) // { name, email, picture, accessToken }
  const [phone, setPhone] = useState(null) // { number, token }
  const [code, setCode] = useState('')
  const [codeStatus, setCodeStatus] = useState({ state: 'idle' })
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  const timerRef = useRef(null)
  const checkIdRef = useRef(0)

  useEffect(() => () => clearTimeout(timerRef.current), [])

  const isStudent = tab === 'student'
  const codeOk = codeStatus.state === 'valid'
  const canContinue = Boolean(google && phone && (!isStudent || codeOk)) && !submitting

  const changeCode = (next) => {
    setCode(next)
    setSubmitError(null)
    clearTimeout(timerRef.current)
    const id = ++checkIdRef.current
    if (next.trim().length < 4) {
      setCodeStatus({ state: 'idle' })
      return
    }
    setCodeStatus({ state: 'checking' })
    timerRef.current = setTimeout(async () => {
      const result = await checkStudentCode(next)
      if (id !== checkIdRef.current) return // a newer keystroke superseded this check
      if (!result.valid) {
        setCodeStatus({ state: result.reason === 'unavailable' ? 'unavailable' : 'invalid' })
      } else if (result.seatsLeft > 0) {
        setCodeStatus({ state: 'valid', instituteName: result.instituteName, seatsLeft: result.seatsLeft })
      } else {
        setCodeStatus({ state: 'full' })
      }
    }, CODE_DEBOUNCE_MS)
  }

  const submit = async () => {
    if (!canContinue) return
    setSubmitting(true)
    setSubmitError(null)
    const result = await completeLogin({
      route: tab,
      google,
      phone: phone.number,
      msg91Token: phone.token,
      studentCode: isStudent ? code.trim() : null,
    })
    setSubmitting(false)
    if (result.ok) onDone(result.session)
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
          <h2 className="text-2xl font-bold text-fg">Meet Sera</h2>
          <p className="mt-1.5 mb-6 text-sm text-fg/60">{SUBTITLES[tab]}</p>

          <LoginTabs value={tab} onChange={(next) => { setTab(next); setSubmitError(null) }} />

          <div className="mt-5 flex flex-col gap-3">
            <GoogleStep google={google} onSignedIn={setGoogle} onChange={() => setGoogle(null)} />

            {isStudent && (
              <StudentCodeStep code={code} status={codeStatus} locked={!google} onCodeChange={changeCode} />
            )}

            <WhatsAppStep
              phone={phone}
              locked={!google || (isStudent && !codeOk)}
              onVerified={setPhone}
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
    </div>
  )
}

export default SeraLogin
