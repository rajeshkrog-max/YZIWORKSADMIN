import SeraOrb from './SeraOrb'

const PHASES = [
  { key: 'warmup', label: 'Warm-up' },
  { key: 'skills', label: 'Skills' },
  { key: 'goal', label: 'Goal' },
]

const STATE_TEXT = {
  'sera-speaking': 'Sera is speaking…',
  'your-turn': 'Your turn — speak naturally.',
  'wrapping-up': 'Wrapping up…',
}

function formatClock(totalSeconds) {
  const m = String(Math.floor(totalSeconds / 60)).padStart(2, '0')
  const s = String(totalSeconds % 60).padStart(2, '0')
  return `${m}:${s}`
}

function SeraInterview({
  sessionSecondsLeft,
  phase,
  turnState,
  turnElapsed,
  turnSeconds,
  muted,
  onToggleMute,
  onEndCall,
}) {
  const orbState = turnState === 'sera-speaking' ? 'speaking' : turnState === 'your-turn' ? 'listening' : 'thinking'
  const ringLeft = Math.max(0, turnSeconds - turnElapsed)
  const ringProgress = turnState === 'your-turn' ? turnElapsed / turnSeconds : 0
  const ringAmber = turnState === 'your-turn' && ringLeft <= 10

  return (
    <div className="flex flex-col items-center text-center w-full max-w-md mx-auto gap-8">
      <div className="flex items-center gap-2">
        {PHASES.map((p) => (
          <span
            key={p.key}
            className={`flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wide ${
              p.key === phase ? 'text-yzi-cyan' : 'text-white/30'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${p.key === phase ? 'bg-yzi-cyan' : 'bg-white/20'}`} />
            {p.label}
          </span>
        ))}
      </div>

      <SeraOrb state={orbState} size={220} />

      <div className="font-mono text-sm text-white/60 tabular-nums">{formatClock(sessionSecondsLeft)}</div>

      <p className="text-sm text-white/70">{STATE_TEXT[turnState]}</p>

      {turnState === 'your-turn' && (
        <div className="w-40">
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ease-linear ${
                ringAmber ? 'bg-amber-400' : 'bg-yzi-cyan'
              }`}
              style={{ width: `${Math.min(100, ringProgress * 100)}%` }}
            />
          </div>
          <p className="mt-1.5 text-[11px] font-mono text-white/40 tabular-nums">
            {String(turnElapsed).padStart(2, '0')} / {turnSeconds}s
          </p>
        </div>
      )}

      <div className="flex items-center gap-4">
        <button
          onClick={onToggleMute}
          aria-label={muted ? 'Unmute microphone' : 'Mute microphone'}
          aria-pressed={muted}
          className={`w-13 h-13 rounded-full flex items-center justify-center border transition ${
            muted
              ? 'bg-yzi-cyan border-yzi-cyan text-yzi-black shadow-[0_0_0_5px_rgba(34,211,238,0.18),0_0_20px_rgba(34,211,238,0.5)]'
              : 'bg-white/5 border-white/15 text-white hover:border-white/30'
          }`}
          style={{ width: 52, height: 52 }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z" />
            <path d="M19 11a7 7 0 0 1-14 0M12 18v3" />
          </svg>
        </button>
        <button
          onClick={onEndCall}
          aria-label="End interview"
          className="rounded-full flex items-center justify-center border border-red-400/40 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition"
          style={{ width: 52, height: 52 }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M4.5 15.5c1-4 5.6-6 7.5-6s6.5 2 7.5 6c.3 1-1 1.5-1.7.9-1.2-1-2.9-1.9-5.8-1.9s-4.6.9-5.8 1.9c-.7.6-2-.1-1.7-.9Z" />
          </svg>
        </button>
      </div>
    </div>
  )
}

export default SeraInterview
