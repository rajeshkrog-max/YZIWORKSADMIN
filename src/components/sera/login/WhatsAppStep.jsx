import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useOtpLaunchGuard } from '../../../hooks/useOtpLaunchGuard'
import { loadMsg91Script, openMsg91OTP } from '../../../utils/msg91'
import { isMockMode } from '../../../services/seraAuthService'

const PHONE_PATTERN = /^[6-9]\d{9}$/

const WhatsAppIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.4-1.48-.88-.79-1.48-1.76-1.66-2.06-.17-.3-.02-.46.13-.6.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.7.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2-1.41.25-.7.25-1.29.18-1.41-.07-.13-.27-.2-.57-.35zM12.04 21.5h-.01a9.44 9.44 0 0 1-4.81-1.32l-.35-.2-3.58.94.96-3.49-.23-.36a9.43 9.43 0 0 1-1.45-5.03c0-5.21 4.24-9.45 9.47-9.45a9.4 9.4 0 0 1 6.69 2.78 9.4 9.4 0 0 1 2.77 6.69c0 5.21-4.24 9.45-9.46 9.45zm8.05-17.5A11.32 11.32 0 0 0 12.04.67C5.77.67.66 5.77.66 12.04c0 2 .52 3.96 1.52 5.68L.57 23.33l5.74-1.5a11.36 11.36 0 0 0 5.73 1.46h.01c6.27 0 11.38-5.1 11.38-11.37 0-3.04-1.18-5.9-3.33-8.05z" />
  </svg>
)

const formatPhone = (digits) => `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`

// Mock mode only: stands in for the MSG91 WhatsApp OTP popup.
// Any 4 digits verify, except 0000, which fails (to show the error line).
function MockOtpPopup({ phone, onSuccess, onFailure, onCancel }) {
  const [otp, setOtp] = useState('')
  // Portalled to <body>: the glass card's backdrop-filter would otherwise
  // trap this fixed overlay inside the card.
  return createPortal(
    <div className="fixed inset-0 z-[300] grid place-items-center bg-black/50 backdrop-blur-sm px-6" onClick={onCancel}>
      <div
        role="dialog"
        aria-label="WhatsApp OTP (mock)"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xs rounded-2xl bg-card border border-fg/10 p-5 text-left shadow-2xl"
      >
        <p className="text-[11px] font-semibold uppercase tracking-widest text-accent-orange-fg mb-1">Mock MSG91</p>
        <h3 className="text-fg font-semibold">Enter the WhatsApp OTP</h3>
        <p className="text-xs text-fg/55 mt-1 mb-3">Sent to {formatPhone(phone)}. Any 4 digits work; 0000 fails.</p>
        <input
          autoFocus
          inputMode="numeric"
          maxLength={4}
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
          className="w-full h-11 px-3 rounded-xl bg-fg/5 border border-fg/15 text-fg tracking-[0.5em] text-center outline-none focus:border-yzi-cyan/60"
        />
        <div className="mt-4 flex justify-end gap-3">
          <button type="button" onClick={onCancel} className="text-sm text-fg/60 hover:text-fg">Cancel</button>
          <button
            type="button"
            disabled={otp.length !== 4}
            onClick={() => (otp === '0000' ? onFailure() : onSuccess({ message: `mock-msg91-${phone}` }))}
            className="px-4 py-2 rounded-full bg-emerald-500 text-white text-sm font-semibold disabled:opacity-40"
          >
            Verify
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

// WhatsApp number + Verify (MSG91 popup, same widget as the Early Builder form),
// or the verified phone row once done. `phone` is { number, token } when verified.
function WhatsAppStep({ phone, locked, onVerified, onChange }) {
  const [value, setValue] = useState('')
  const [error, setError] = useState(null)
  const [mockOpen, setMockOpen] = useState(false)
  const { isOtpLaunching, acquireLock } = useOtpLaunchGuard(3000)

  const succeed = (data) => {
    setMockOpen(false)
    // MSG91's widget returns the verification token in `message`.
    onVerified({ number: value, token: data?.message ?? null })
  }
  const fail = () => {
    setMockOpen(false)
    setError("Couldn't verify this number. Please try again.")
  }

  const verify = async () => {
    setError(null)
    if (!PHONE_PATTERN.test(value)) {
      setError('Enter a valid 10-digit Indian mobile number.')
      return
    }
    if (isMockMode()) {
      setMockOpen(true)
      return
    }

    const releaseOtpLaunch = acquireLock()
    // Ignore accidental double-clicks while the popup is opening.
    if (!releaseOtpLaunch) return

    try {
      await loadMsg91Script()
      openMsg91OTP({
        phone: value,
        onSuccess: (data) => {
          releaseOtpLaunch()
          succeed(data)
        },
        onFailure: () => {
          releaseOtpLaunch()
          fail()
        },
      })
    } catch {
      releaseOtpLaunch()
      setError("Couldn't open the verification popup. Please try again.")
    }
  }

  if (phone) {
    return (
      <div className="flex items-center gap-3 h-[50px] px-3.5 rounded-[14px] border border-emerald-500/40 bg-emerald-500/10">
        <span className="w-7 h-7 rounded-full shrink-0 grid place-items-center bg-[#25D366] text-white">
          <WhatsAppIcon size={15} />
        </span>
        <span className="flex-1 min-w-0 truncate text-sm text-fg text-left">{formatPhone(phone.number)}</span>
        <span className="text-emerald-500 font-bold" aria-label="Verified">✓</span>
        <button type="button" onClick={onChange} className="text-xs text-fg/60 underline underline-offset-2 hover:text-fg">
          Change
        </button>
      </div>
    )
  }

  return (
    <div className={locked ? 'opacity-45' : ''}>
      <div
        className={`flex items-center h-[50px] pl-4 pr-1.5 rounded-[14px] border bg-fg/5 light:bg-white/60 transition-colors ${
          error ? 'border-red-500/50' : 'border-fg/10 focus-within:border-yzi-cyan/60'
        }`}
      >
        <span className="text-sm text-fg/60 pr-2 mr-2 border-r border-fg/15">+91</span>
        <input
          type="tel"
          inputMode="numeric"
          aria-label="WhatsApp number"
          placeholder="WhatsApp number"
          maxLength={10}
          value={value}
          disabled={locked}
          onChange={(e) => {
            setValue(e.target.value.replace(/\D/g, ''))
            setError(null)
          }}
          onKeyDown={(e) => e.key === 'Enter' && !locked && verify()}
          className="flex-1 min-w-0 bg-transparent outline-none text-sm text-fg placeholder:text-fg/40 tracking-wide disabled:cursor-not-allowed"
        />
        <button
          type="button"
          onClick={verify}
          disabled={locked || isOtpLaunching}
          className="h-[38px] px-3.5 flex items-center gap-1.5 rounded-[10px] bg-[#25D366] hover:bg-[#1ebe5b] text-white text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <WhatsAppIcon size={14} />
          {isOtpLaunching ? 'Opening…' : 'Verify'}
        </button>
      </div>
      {error && <p className="mt-1.5 text-xs text-left text-red-400 light:text-red-600">{error}</p>}
      {mockOpen && (
        <MockOtpPopup phone={value} onSuccess={succeed} onFailure={fail} onCancel={() => setMockOpen(false)} />
      )}
    </div>
  )
}

export default WhatsAppStep
