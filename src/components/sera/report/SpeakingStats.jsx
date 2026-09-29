import { PANEL, SECTION_LABEL, SECTION_TITLE } from './reportStyles'

function Stat({ value, label, line }) {
  return (
    <div className="rounded-2xl border border-fg/10 bg-fg/[0.03] p-4">
      <p className="text-2xl font-extrabold text-fg tabular-nums">{value}</p>
      <p className="mt-0.5 text-sm font-semibold text-fg/80">{label}</p>
      <p className="mt-2 text-xs text-fg/55 leading-relaxed">{line}</p>
    </div>
  )
}

// Measured from the recording by code, not judged by the AI. No benchmarks.
function SpeakingStats({ speaking }) {
  return (
    <section className={PANEL} aria-labelledby="sera-speaking">
      <p className={SECTION_LABEL}>How you spoke</p>
      <h2 id="sera-speaking" className={`${SECTION_TITLE} mt-1`}>Measured from the interview</h2>
      <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Stat
          value={`${speaking.avgAnswerSeconds} s`}
          label="Average answer length"
          line="How long you usually spoke before Sera's next question."
        />
        <Stat
          value={speaking.fillerWords}
          label="Filler words"
          line={`Words like "um", "basically" or "matlab" — about ${speaking.fillersPerMinute} per minute of your speaking.`}
        />
        <Stat
          value={`${Math.round(speaking.talkShare * 100)}%`}
          label="Share of time you spoke"
          line="Of all the time either of you was talking, how much was you."
        />
      </div>
    </section>
  )
}

export default SpeakingStats
