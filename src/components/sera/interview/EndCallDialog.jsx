import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

// Glass confirm before ending — the interview can only be taken once.
// Portalled to <body> so no glass/backdrop-filter parent can trap it.
function EndCallDialog({ onKeepGoing, onEnd }) {
  const keepRef = useRef(null)

  useEffect(() => {
    keepRef.current?.focus()
    const onKey = (e) => e.key === 'Escape' && onKeepGoing()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onKeepGoing])

  return createPortal(
    <div className="fixed inset-0 z-[300] grid place-items-center bg-black/55 backdrop-blur-sm px-6" onClick={onKeepGoing}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="sera-end-title"
        aria-describedby="sera-end-text"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-[24px] border border-white/10 light:border-white/80 bg-card/70 light:bg-white/75 backdrop-blur-[22px] shadow-[0_24px_60px_rgba(0,0,0,0.5)] p-6 text-center"
      >
        <h2 id="sera-end-title" className="text-xl font-bold text-fg">End your interview?</h2>
        <p id="sera-end-text" className="mt-2 text-sm text-fg/65 leading-relaxed">
          Your interview can only be taken once. If you end it now, it can't be restarted.
        </p>
        <div className="mt-6 flex flex-col gap-2.5">
          <button
            ref={keepRef}
            type="button"
            onClick={onKeepGoing}
            className="h-12 rounded-full bg-gradient-to-r from-yzi-orange via-yzi-pink to-yzi-purple text-white font-semibold hover:brightness-110 transition"
          >
            Keep going
          </button>
          <button
            type="button"
            onClick={onEnd}
            className="h-12 rounded-full border border-red-500/50 bg-red-500/10 text-red-400 light:text-red-600 font-semibold hover:bg-red-500/20 transition"
          >
            End interview
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export default EndCallDialog
