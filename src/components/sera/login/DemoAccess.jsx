import { useState } from 'react'
import { completeDemoLogin } from '../../../services/seraAuthService'

// A quiet "demo code" door under the login card, for showcasing Sera without a Google
// account or WhatsApp number. The code is checked on the server and each demo is a real
// (capped) interview; the normal login above is unchanged.
function DemoAccess({ onDone }) {
  const [open, setOpen] = useState(false)
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const submit = async (event) => {
    event.preventDefault()
    if (busy || code.trim().length < 4) return
    setBusy(true)
    setError(null)
    const result = await completeDemoLogin({ code, name })
    setBusy(false)
    if (result.ok) onDone(result.login)
    else setError(result.error || 'Something went wrong. Please try again.')
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-5 text-xs text-fg/50 hover:text-fg/80 underline underline-offset-4 decoration-fg/25 transition-colors"
      >
        Showcasing Sera? Use a demo code
      </button>
    )
  }

  return (
    <form
      onSubmit={submit}
      className="mt-5 w-full max-w-[420px] rounded-[20px] border border-white/10 light:border-white/80 bg-card/45 light:bg-white/50 backdrop-blur-[18px] p-4 flex flex-col gap-3 text-left"
    >
      <p className="text-xs text-fg/60">
        Demo access skips Google and WhatsApp. It runs the full student interview, so it only works with a demo code.
      </p>
      <label className="flex items-center h-[46px] px-4 rounded-[14px] border border-fg/10 bg-fg/5 light:bg-white/60 focus-within:border-yzi-cyan/60 transition-colors">
        <span className="sr-only">Your name (optional)</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          placeholder="Your name (optional)"
          autoComplete="off"
          className="flex-1 min-w-0 bg-transparent outline-none text-sm text-fg placeholder:text-fg/40"
        />
      </label>
      <label className="flex items-center h-[46px] px-4 rounded-[14px] border border-fg/10 bg-fg/5 light:bg-white/60 focus-within:border-yzi-cyan/60 transition-colors">
        <span className="sr-only">Demo code</span>
        <input
          type="text"
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase())
            setError(null)
          }}
          placeholder="Demo code"
          autoComplete="off"
          spellCheck={false}
          className="flex-1 min-w-0 bg-transparent outline-none text-sm text-fg placeholder:text-fg/40 tracking-wide"
        />
      </label>
      <button
        type="submit"
        disabled={busy || code.trim().length < 4}
        className="h-[46px] rounded-full bg-gradient-to-r from-yzi-orange via-yzi-pink to-yzi-purple text-white text-sm font-semibold transition hover:brightness-110 disabled:from-fg/15 disabled:via-fg/15 disabled:to-fg/15 disabled:text-fg/40 disabled:cursor-not-allowed disabled:hover:brightness-100"
      >
        {busy ? 'Starting…' : 'Start demo'}
      </button>
      {error && <p className="text-xs text-red-400 light:text-red-600">{error}</p>}
    </form>
  )
}

export default DemoAccess
