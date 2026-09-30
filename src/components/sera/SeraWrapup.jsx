import { useEffect, useState } from 'react'
import SeraWave from './SeraWave'
import GlassCard from './glass/GlassCard'

const STEPS = ['Interview received', 'Reviewing your answers', 'Building your plan']
const RECEIVED_AFTER_MS = 700 // the call has ended, so we do have the interview
const REVIEWING_AFTER_MS = 4000 // time-based: we can't see this stage from here

// After the call: Sera prepares the report. The checklist follows what we
// actually know — the last step only ticks once the report really exists
// (reportReady), never on a timer.
function SeraWrapup({ session, reportReady = false }) {
  const firstName = session?.firstName || ''
  const [timedDone, setTimedDone] = useState(0)

  useEffect(() => {
    const t1 = setTimeout(() => setTimedDone((n) => Math.max(n, 1)), RECEIVED_AFTER_MS)
    const t2 = setTimeout(() => setTimedDone((n) => Math.max(n, 2)), REVIEWING_AFTER_MS)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [])

  const done = reportReady ? STEPS.length : timedDone

  return (
    <div className={`w-full flex flex-col items-center text-center transition-opacity duration-500 ${reportReady ? 'sera-wrap-out' : ''}`}>
      <SeraWave state="thinking" bleed className="w-full h-[140px] md:h-[200px] mb-6" />

      <GlassCard>
        <h2 className="text-2xl font-bold text-fg">That's the interview{firstName ? `, ${firstName}` : ''}.</h2>
        <p className="mt-1.5 text-sm text-fg/60">Sera is preparing your report. This usually takes under a minute.</p>

        <ol className="mt-6 flex flex-col gap-3 text-left">
          {STEPS.map((label, i) => {
            const state = i < done ? 'done' : i === done ? 'active' : 'waiting'
            return (
              <li key={label} className="flex items-center gap-3">
                {state === 'done' ? (
                  <span className="sera-check w-6 h-6 shrink-0 rounded-full grid place-items-center bg-emerald-500 text-white" aria-hidden="true">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                      <path className="sera-check-path" d="M5 12.5 10 17l9-10" />
                    </svg>
                  </span>
                ) : state === 'active' ? (
                  <span className="w-6 h-6 shrink-0 rounded-full border-2 border-yzi-cyan/30 border-t-yzi-cyan animate-spin motion-reduce:animate-none" aria-hidden="true" />
                ) : (
                  <span className="w-6 h-6 shrink-0 rounded-full border-2 border-fg/15" aria-hidden="true" />
                )}
                <span className={`text-sm ${state === 'waiting' ? 'text-fg/40' : 'text-fg'}`}>
                  {label}
                  <span className="sr-only">{state === 'done' ? ' — done' : state === 'active' ? ' — in progress' : ''}</span>
                </span>
              </li>
            )
          })}
        </ol>
      </GlassCard>

      <style>{`
        .sera-check { animation: sera-check-pop 0.35s ease-out both; }
        .sera-check-path { stroke-dasharray: 24; stroke-dashoffset: 24; animation: sera-check-draw 0.35s 0.1s ease-out forwards; }
        @keyframes sera-check-pop { from { transform: scale(0.6); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        @keyframes sera-check-draw { to { stroke-dashoffset: 0; } }
        .sera-wrap-out { animation: sera-wrap-out 0.45s 0.45s ease-in forwards; }
        @keyframes sera-wrap-out { to { opacity: 0; transform: translateY(-6px); } }
        @media (prefers-reduced-motion: reduce) {
          .sera-check, .sera-wrap-out { animation: none; }
          .sera-check-path { animation: none; stroke-dashoffset: 0; }
        }
      `}</style>
    </div>
  )
}

export default SeraWrapup
