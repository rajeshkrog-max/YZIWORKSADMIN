import SeraOrb from './SeraOrb'

// "Engine" block under the Meet Sera hero slider. The orb always sits in a
// dark well — its particles are drawn for a black background — while the copy
// beside it follows the page theme. The whole block sits in a neon frame:
// a 1.5px brand-gradient ring plus an outer glow that pulses softly.
const NEON_RING = 'linear-gradient(135deg, #22D3EE 0%, #FF008A 38%, #8B5CF6 68%, #FF5E00 100%)'

function SeraHero({ onStart }) {
  return (
    <section className="px-6 py-16 md:py-24">
      <div className="sera-neon relative max-w-5xl mx-auto rounded-[32px] p-[1.5px]" style={{ background: NEON_RING }}>
      <div className="relative rounded-[30.5px] bg-surface px-6 py-8 md:p-12 grid md:grid-cols-2 items-center gap-10 md:gap-16">
        <div
          className="relative mx-auto w-full max-w-[420px] aspect-square rounded-[28px] overflow-hidden bg-[#05050A] border border-white/10 grid place-items-center light:shadow-2xl light:shadow-black/25"
          style={{
            backgroundImage:
              'radial-gradient(55% 55% at 50% 50%, rgba(139,92,246,0.22), transparent 70%)',
          }}
        >
          <SeraOrb state="idle" size={280} tone="dark" />
        </div>

        <div className="flex flex-col items-center md:items-start text-center md:text-left">
          <span className="text-xs font-medium tracking-widest uppercase text-accent-cyan-fg mb-4">
            YZI Works &middot; AI Interviewer
          </span>
          <h1
            className="text-5xl md:text-6xl font-extrabold uppercase tracking-tight leading-none"
            style={{
              background:
                'linear-gradient(90deg, var(--theme-fg) 0%, var(--theme-fg) 38%, var(--color-yzi-cyan) 70%, var(--color-yzi-purple) 100%)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
              filter: 'drop-shadow(0 0 34px rgba(139,92,246,0.35))',
            }}
          >
            Sera
          </h1>
          <p className="mt-5 text-fg/70 text-base md:text-lg leading-relaxed max-w-md">
            Practice the interview <b className="text-fg font-semibold">before</b> the real one.
            Sera reads your resume, asks what actually matters, and tells you straight where you
            stand — five honest minutes, completely private.
          </p>
          <button
            onClick={onStart}
            className="mt-9 w-full sm:w-auto px-8 py-3.5 rounded-full bg-gradient-to-r from-yzi-orange via-yzi-pink to-yzi-purple text-white font-semibold hover:scale-105 transition-transform duration-300"
          >
            Meet Sera
          </button>
        </div>
      </div>
      </div>

      <style>{`
        .sera-neon::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
          pointer-events: none;
          box-shadow:
            0 0 18px rgba(34, 211, 238, 0.45),
            0 0 38px rgba(255, 0, 138, 0.30),
            0 0 64px rgba(139, 92, 246, 0.30),
            0 0 90px rgba(255, 94, 0, 0.18);
          animation: sera-neon-pulse 3.2s ease-in-out infinite;
        }
        @keyframes sera-neon-pulse {
          0%, 100% { opacity: 0.55; }
          50%      { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .sera-neon::before { animation: none; opacity: 0.8; }
        }
      `}</style>
    </section>
  )
}

export default SeraHero
