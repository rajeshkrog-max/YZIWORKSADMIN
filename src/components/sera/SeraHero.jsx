import SeraOrb from './SeraOrb'

function SeraHero({ onStart }) {
  return (
    <div className="flex flex-col items-center text-center max-w-xl mx-auto">
      <SeraOrb state="idle" size={200} className="mb-2" />
      <span className="text-xs font-medium tracking-widest uppercase text-yzi-cyan mb-4">
        YZI Works &middot; AI Interviewer
      </span>
      <h1 className="text-4xl md:text-5xl font-bold uppercase tracking-tight text-white">Sera</h1>
      <p className="mt-4 text-white/70 text-base md:text-lg leading-relaxed max-w-md">
        She reads your résumé before you say a word, asks the questions that actually matter,
        and tells you — honestly — where you stand. Five minutes, spoken, private.
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
