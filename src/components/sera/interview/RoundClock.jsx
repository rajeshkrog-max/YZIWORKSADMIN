const RING_R = 22
const RING_C = 2 * Math.PI * RING_R

const formatClock = (total) =>
  `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`

// Big countdown for the current round, plus the turn-timer ring — shown only
// while Sera is listening, amber in the last 10 seconds.
function RoundClock({ secondsLeft, listening, turnElapsed, turnSeconds }) {
  const turnLeft = Math.max(0, turnSeconds - turnElapsed)
  const amber = turnLeft <= 10
  const progress = Math.min(1, turnElapsed / turnSeconds)

  return (
    <div className="flex items-center justify-center gap-5">
      <span className="font-mono text-5xl sm:text-6xl font-semibold tabular-nums text-fg tracking-tight">
        {formatClock(secondsLeft ?? 0)}
      </span>

      {listening && (
        <span className="relative w-14 h-14 shrink-0" aria-label={`${turnLeft} seconds left for this answer`}>
          <svg viewBox="0 0 52 52" className="w-full h-full -rotate-90" aria-hidden="true">
            <circle cx="26" cy="26" r={RING_R} fill="none" strokeWidth="4" className="stroke-fg/10" />
            <circle
              cx="26"
              cy="26"
              r={RING_R}
              fill="none"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={RING_C}
              strokeDashoffset={RING_C * progress}
              className={`transition-[stroke-dashoffset] duration-1000 ease-linear motion-reduce:transition-none ${amber ? 'stroke-amber-400' : 'stroke-yzi-cyan'}`}
            />
          </svg>
          <span className={`absolute inset-0 grid place-items-center font-mono text-sm tabular-nums ${amber ? 'text-amber-400' : 'text-fg/80'}`}>
            {turnLeft}
          </span>
        </span>
      )}
    </div>
  )
}

export default RoundClock
