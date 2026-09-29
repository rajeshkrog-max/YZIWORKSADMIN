import { formatRoundLength } from '../../../config/seraRounds'

const RAIL_GLASS =
  'rounded-2xl border border-white/10 light:border-white/80 bg-card/45 light:bg-white/55 backdrop-blur-[18px] shadow-[0_12px_40px_rgba(0,0,0,0.35)] light:shadow-[0_12px_40px_rgba(76,29,149,0.1)]'

const PulseStyle = () => (
  <style>{`
    .sera-rail-pulse { animation: sera-rail-pulse 1.8s ease-in-out infinite; }
    @keyframes sera-rail-pulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(34,211,238,0.55), 0 0 12px rgba(34,211,238,0.5); }
      50%      { box-shadow: 0 0 0 6px rgba(34,211,238,0), 0 0 20px rgba(34,211,238,0.8); }
    }
    @media (prefers-reduced-motion: reduce) {
      .sera-rail-pulse { animation: none; box-shadow: 0 0 14px rgba(34,211,238,0.6); }
    }
  `}</style>
)

function Dot({ index, state }) {
  if (state === 'done') {
    return (
      <span className="w-7 h-7 rounded-full grid place-items-center bg-emerald-500 text-white text-sm font-bold shadow-[0_0_14px_rgba(16,185,129,0.45)]">
        ✓
      </span>
    )
  }
  if (state === 'current') {
    return (
      <span className="sera-rail-pulse w-7 h-7 rounded-full grid place-items-center bg-yzi-cyan text-[#05050A] text-xs font-bold">
        {index + 1}
      </span>
    )
  }
  return (
    <span className="w-7 h-7 rounded-full grid place-items-center border border-fg/20 bg-fg/5 text-fg/50 text-xs font-semibold">
      {index + 1}
    </span>
  )
}

// Glass milestone rail for the interview rounds (from src/config/seraRounds.js).
function RoundRail({ rounds, currentIndex }) {
  // Visitors have a single round: a slim one-step pill, not an empty rail.
  if (rounds.length === 1) {
    const [round] = rounds
    return (
      <div className={`${RAIL_GLASS} inline-flex items-center gap-2.5 px-4 py-2 rounded-full`}>
        <span className="sera-rail-pulse w-2.5 h-2.5 rounded-full bg-yzi-cyan" />
        <span className="text-sm font-semibold text-fg">{round.label}</span>
        <span className="text-xs font-mono text-fg/50">· {formatRoundLength(round.seconds)}</span>
        <PulseStyle />
      </div>
    )
  }

  const progress = rounds.length > 1 ? (Math.min(currentIndex, rounds.length - 1) / (rounds.length - 1)) * 100 : 0

  return (
    <div className={`${RAIL_GLASS} w-full max-w-xl px-3 sm:px-6 pt-4 pb-3`}>
      <ol className="relative flex justify-between">
        {/* Track + gradient fill between the first and last dot centres. */}
        <span aria-hidden="true" className="absolute top-3.5 left-[12.5%] right-[12.5%] h-0.5 -translate-y-1/2 rounded-full bg-fg/10">
          <span
            className="block h-full rounded-full bg-gradient-to-r from-emerald-500 via-yzi-cyan to-yzi-purple transition-[width] duration-700 ease-out motion-reduce:transition-none"
            style={{ width: `${progress}%` }}
          />
        </span>
        {rounds.map((round, i) => {
          const state = i < currentIndex ? 'done' : i === currentIndex ? 'current' : 'upcoming'
          return (
            <li
              key={round.id}
              aria-current={state === 'current' ? 'step' : undefined}
              className="relative z-10 w-1/4 flex flex-col items-center text-center"
            >
              <Dot index={i} state={state} />
              <span className={`mt-1.5 text-[11px] sm:text-xs font-semibold leading-tight ${state === 'upcoming' ? 'text-fg/45' : 'text-fg'}`}>
                {round.label}
              </span>
              <span className="hidden sm:block mt-0.5 text-[10px] font-mono text-fg/40">{formatRoundLength(round.seconds)}</span>
            </li>
          )
        })}
      </ol>
      <PulseStyle />
    </div>
  )
}

export default RoundRail
