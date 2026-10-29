// Chosen offer, shown under the round rail once the student has picked one.
function OfferChip({ offer }) {
  return (
    <div className="sera-chip-in inline-flex items-center gap-2.5 max-w-full pl-1.5 pr-4 py-1.5 rounded-full border border-white/10 light:border-white/80 bg-card/50 light:bg-white/60 backdrop-blur-[18px] text-sm">
      <span className="w-7 h-7 shrink-0 rounded-lg grid place-items-center bg-gradient-to-br from-yzi-cyan to-yzi-purple text-white text-xs font-bold">
        {offer.logoLetter}
      </span>
      <span className="min-w-0 truncate text-fg">
        <b className="font-semibold">{offer.company}</b>
        <span className="text-fg/60"> · {offer.role}</span>
      </span>
      <style>{`
        .sera-chip-in { animation: sera-chip-in 0.45s ease-out both; }
        @keyframes sera-chip-in { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: none; } }
        @media (prefers-reduced-motion: reduce) { .sera-chip-in { animation: none; } }
      `}</style>
    </div>
  )
}

export default OfferChip
