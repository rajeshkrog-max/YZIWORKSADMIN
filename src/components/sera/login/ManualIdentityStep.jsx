import { EMAIL_PATTERN } from './typedIdentity'

const FIELD = 'flex items-center h-[50px] px-4 rounded-[14px] border bg-fg/5 light:bg-white/60 transition-colors border-fg/10 focus-within:border-yzi-cyan/60'
const INPUT = 'flex-1 min-w-0 bg-transparent outline-none text-sm text-fg placeholder:text-fg/40'

// Step 1 without Google: the candidate types a name and an email. The email is not
// verified; it only names the interview (one per email) and is where the report belongs.
function ManualIdentityStep({ value, onChange }) {
  const set = (key) => (e) => onChange({ ...value, [key]: e.target.value })
  const emailTyped = value.email.trim().length > 0
  const emailBad = emailTyped && !EMAIL_PATTERN.test(value.email.trim())

  return (
    <div className="flex flex-col gap-3">
      <label className={FIELD}>
        <span className="sr-only">Your name</span>
        <input type="text" value={value.name} onChange={set('name')} placeholder="Your name" autoComplete="name" maxLength={60} className={INPUT} />
      </label>
      <div>
        <label className={`${FIELD} ${emailBad ? '!border-red-500/50' : ''}`}>
          <span className="sr-only">Email</span>
          <input
            type="email"
            inputMode="email"
            value={value.email}
            onChange={set('email')}
            placeholder="Email"
            autoComplete="email"
            spellCheck={false}
            maxLength={254}
            className={INPUT}
          />
        </label>
        <p className={`mt-1.5 text-xs text-left ${emailBad ? 'text-red-400 light:text-red-600' : 'text-fg/50'}`}>
          {emailBad ? 'Enter a valid email address.' : 'One interview per email. Use one you check.'}
        </p>
      </div>
    </div>
  )
}

export default ManualIdentityStep
