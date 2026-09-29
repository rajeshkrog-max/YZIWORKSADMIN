import { useEffect, useRef, useState } from 'react'

const DownloadIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 4v11m0 0 4.5-4.5M12 15l-4.5-4.5M5 19h14" />
  </svg>
)

// "Download report" — default → "Preparing…" → "Downloaded ✓" for 3 s.
// onDownload() is async and throws on failure. Error line, never alert().
function DownloadReportButton({ onDownload, className = '' }) {
  const [state, setState] = useState('idle') // idle | preparing | done | error
  const timerRef = useRef(null)
  useEffect(() => () => clearTimeout(timerRef.current), [])

  const click = async () => {
    if (state === 'preparing') return
    setState('preparing')
    try {
      if (!onDownload) throw new Error('Download is not available')
      await onDownload()
      setState('done')
      clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setState('idle'), 3000)
    } catch {
      setState('error')
    }
  }

  return (
    <div className={`flex flex-col items-end ${className}`}>
      <button
        type="button"
        onClick={click}
        disabled={state === 'preparing'}
        aria-live="polite"
        className="inline-flex items-center gap-2 h-11 px-4 sm:px-5 rounded-full border border-white/15 light:border-black/10 bg-card/60 light:bg-white/70 backdrop-blur-[18px] text-sm font-semibold text-fg hover:border-yzi-cyan/60 hover:shadow-[0_0_20px_rgba(34,211,238,0.25)] transition disabled:opacity-70"
      >
        {state === 'preparing' ? (
          <span className="w-4 h-4 rounded-full border-2 border-fg/30 border-t-fg animate-spin motion-reduce:animate-none" aria-hidden="true" />
        ) : state === 'done' ? (
          <span className="text-emerald-500" aria-hidden="true">✓</span>
        ) : (
          <DownloadIcon />
        )}
        {state === 'preparing' ? 'Preparing…' : state === 'done' ? 'Downloaded' : 'Download report'}
      </button>
      {state === 'error' && (
        <p className="mt-1.5 text-xs text-red-400 light:text-red-600">Couldn't prepare your report. Try again.</p>
      )}
    </div>
  )
}

export default DownloadReportButton
