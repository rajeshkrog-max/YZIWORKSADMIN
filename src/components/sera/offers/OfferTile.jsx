const formatCtc = (min, max) => `₹${min}–${max} LPA`

// One practice offer. The whole tile is a button; `color` is its neon edge.
// state: 'idle' | 'chosen' | 'faded'
function OfferTile({ offer, color, delayMs, state, onChoose }) {
  return (
    <button
      type="button"
      onClick={() => onChoose(offer)}
      disabled={state !== 'idle'}
      style={{ '--tile': color, animationDelay: `${delayMs}ms` }}
      className={`sera-tile sera-tile-rise group w-full text-left rounded-[22px] p-5 bg-card/55 light:bg-white/65 backdrop-blur-[20px] outline-none disabled:cursor-default ${
        state === 'chosen' ? 'sera-tile-chosen' : state === 'faded' ? 'sera-tile-faded' : ''
      }`}
    >
      {/* Own line above the header so it never overlaps a long company name. */}
      <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-fg/45">Practice offer</span>

      <span className="mt-2.5 flex items-start gap-3">
        <span
          className="w-11 h-11 shrink-0 rounded-xl grid place-items-center text-white text-lg font-bold"
          style={{ background: `linear-gradient(135deg, ${color}, #8B5CF6)` }}
          aria-hidden="true"
        >
          {offer.logoLetter}
        </span>
        <span className="min-w-0">
          <span className="block font-semibold text-fg leading-snug break-words">{offer.company}</span>
          <span className="block mt-0.5 text-xs text-fg/55">
            {offer.city} · {offer.workMode}
          </span>
        </span>
      </span>

      <span className="block mt-4 text-lg font-bold text-fg leading-tight">{offer.role}</span>
      <span className="block mt-1 text-sm font-semibold tabular-nums" style={{ color }}>
        {formatCtc(offer.ctcMinLpa, offer.ctcMaxLpa)}
      </span>

      <span className="mt-3 flex flex-wrap gap-1.5">
        {offer.skills.slice(0, 3).map((skill) => (
          <span key={skill} className="px-2 py-0.5 rounded-md border border-fg/15 bg-fg/5 text-[11px] text-fg/75">
            {skill}
          </span>
        ))}
      </span>

      <span className="block mt-3 text-xs text-fg/60 leading-relaxed">{offer.whyFit}</span>

      <span className="sera-tile-bar block mt-5 py-2.5 rounded-xl border border-fg/15 text-center text-sm font-semibold text-fg">
        Choose this offer
      </span>
    </button>
  )
}

export default OfferTile
