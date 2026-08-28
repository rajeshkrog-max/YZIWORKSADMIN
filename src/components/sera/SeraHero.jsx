import SeraOrb from './SeraOrb'

function SeraHero({ onStart }) {
  return (
    <div className="flex flex-col items-center text-center max-w-xl mx-auto">
      <SeraOrb state="idle" size={280} className="mb-2" />
      <span className="text-xs font-medium tracking-widest uppercase text-yzi-cyan mb-4">
        YZI Works &middot; AI Interviewer
      </span>
      <h1
        className="text-5xl md:text-6xl font-extrabold uppercase tracking-tight leading-none"
        style={{
          background:
            'linear-gradient(90deg, #fff 0%, #fff 38%, var(--color-yzi-cyan) 70%, var(--color-yzi-purple) 100%)',
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          color: 'transparent',
          filter: 'drop-shadow(0 0 34px rgba(139,92,246,0.35))',
        }}
      >
        Sera
      </h1>
      <p className="mt-5 text-white/70 text-base md:text-lg leading-relaxed max-w-md">
        Practice the interview <b className="text-white font-semibold">before</b> the real one.
        Sera reads your resume, asks what actually matters, and tells you straight where you
        stand — five honest minutes, completely private.
      </p>
      <button
        onClick={onStart}
        className="mt-9 px-8 py-3.5 rounded-full bg-gradient-to-r from-yzi-orange via-yzi-pink to-yzi-purple text-white font-semibold hover:scale-105 transition-transform duration-300"
      >
        Meet Sera
      </button>
    </div>
  )
}

export default SeraHero
