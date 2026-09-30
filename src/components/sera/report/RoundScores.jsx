import { PANEL, SECTION_LABEL, SECTION_TITLE } from './reportStyles'

const clock = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`

// One card per timed round. A cut-short round shows no number.
function RoundScores({ rounds }) {
  return (
    <section className={PANEL} aria-labelledby="sera-rounds">
      <p className={SECTION_LABEL}>Round by round</p>
      <h2 id="sera-rounds" className={`${SECTION_TITLE} mt-1`}>How each round went</h2>
      <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
        {rounds.map((round) => (
          <div key={round.id} className="rounded-2xl border border-fg/10 bg-fg/[0.03] p-4">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="font-semibold text-fg">{round.label}</h3>
              <span className="text-xs font-mono text-fg/45">{clock(round.durationSeconds)}</span>
            </div>
            {round.score !== null ? (
              <>
                <p className="mt-2 text-3xl font-extrabold text-fg tabular-nums">
                  {round.score}
                  <span className="text-sm font-medium text-fg/45">/100</span>
                </p>
                <div className="mt-2 h-2 rounded-full bg-fg/10 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-yzi-orange via-yzi-pink to-yzi-purple" style={{ width: `${round.score}%` }} />
                </div>
              </>
            ) : (
              <p className="mt-2 text-sm font-semibold text-fg/60">Not enough to score</p>
            )}
            {round.note && <p className="mt-3 text-sm text-fg/70 leading-relaxed">{round.note}</p>}
          </div>
        ))}
      </div>
    </section>
  )
}

export default RoundScores
