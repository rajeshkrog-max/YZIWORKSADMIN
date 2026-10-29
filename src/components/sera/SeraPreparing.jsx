import SeraWave from './SeraWave'
import GlassCard from './glass/GlassCard'

// Résumé upload + check in progress. Same look family as login/upload: the
// full-width wave (thinking: flatter, slower, breathing glow) over a glass card.
function SeraPreparing() {
  return (
    <div className="w-full flex flex-col items-center text-center">
      <SeraWave state="thinking" bleed className="w-full h-[140px] md:h-[200px] mb-6" />

      <GlassCard>
        <h2 className="text-xl font-bold text-fg">Sera is reading your résumé…</h2>
        <p className="mt-1.5 text-sm text-fg/60">This takes a few seconds.</p>

        <div
          role="progressbar"
          aria-label="Reading your résumé"
          className="mt-6 h-1.5 rounded-full bg-fg/10 overflow-hidden"
        >
          <div className="sera-shimmer h-full w-full rounded-full" />
        </div>
      </GlassCard>

      <style>{`
        .sera-shimmer {
          background: linear-gradient(90deg, transparent 0%, rgba(34,211,238,0.9) 35%, rgba(139,92,246,0.9) 55%, transparent 90%);
          background-size: 50% 100%;
          background-repeat: no-repeat;
          animation: sera-shimmer 1.6s ease-in-out infinite;
        }
        @keyframes sera-shimmer {
          0%   { background-position: -60% 0; }
          100% { background-position: 160% 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .sera-shimmer { animation: none; background-size: 100% 100%; opacity: 0.5; }
        }
      `}</style>
    </div>
  )
}

export default SeraPreparing
