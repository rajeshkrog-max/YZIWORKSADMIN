const CapIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M22 10 12 5 2 10l10 5 10-5z" />
    <path d="M6 12v5c3 2 9 2 12 0v-5" />
    <path d="M22 10v6" />
  </svg>
)

// status.state: idle | checking | valid | rejoin | full | invalid | unavailable
//               | expired | used | mismatch (rejoin code problems)
const ERRORS = {
  full: 'No seats left for this code',
  invalid: "This code isn't valid. Check with your campus.",
  unavailable: "Couldn't check the code right now. Please try again in a minute.",
  expired: 'This code has expired.',
  used: 'This code has already been used.',
  mismatch: "This code doesn't match this account.",
}

function StatusLine({ status }) {
  if (status.state === 'checking') {
    return <p className="mt-1.5 text-xs text-left text-fg/50">Checking code…</p>
  }
  if (status.state === 'valid') {
    const seats = `${status.seatsLeft} ${status.seatsLeft === 1 ? 'seat' : 'seats'} left`
    return (
      <p className="mt-1.5 text-xs text-left text-emerald-500 light:text-emerald-600">
        ✓ {status.instituteName} · {seats}
      </p>
    )
  }
  if (status.state === 'rejoin') {
    return (
      <p className="mt-1.5 text-xs text-left text-emerald-500 light:text-emerald-600">
        ✓ Rejoin code · you'll continue where you left off
      </p>
    )
  }
  const message = ERRORS[status.state]
  return message ? <p className="mt-1.5 text-xs text-left text-red-400 light:text-red-600">{message}</p> : null
}

// Student step 2 — code input, checked while typing (debounce lives in SeraLogin).
function StudentCodeStep({ code, status, locked, onCodeChange }) {
  const border =
    status.state === 'valid' || status.state === 'rejoin'
      ? 'border-emerald-500/50'
      : ERRORS[status.state]
        ? 'border-red-500/50'
        : 'border-fg/10 focus-within:border-yzi-cyan/60'

  return (
    <div className={locked ? 'opacity-45' : ''}>
      <label
        className={`flex items-center h-[50px] px-4 rounded-[14px] border bg-fg/5 light:bg-white/60 transition-colors ${border}`}
      >
        <span className="sr-only">Student code</span>
        <input
          type="text"
          value={code}
          disabled={locked}
          onChange={(e) => onCodeChange(e.target.value.toUpperCase())}
          placeholder="Student code"
          autoComplete="off"
          spellCheck={false}
          className="flex-1 min-w-0 bg-transparent outline-none text-sm text-fg placeholder:text-fg/40 tracking-wide disabled:cursor-not-allowed"
        />
        <span className="text-fg/45">
          <CapIcon />
        </span>
      </label>
      <StatusLine status={status} />
    </div>
  )
}

export default StudentCodeStep
