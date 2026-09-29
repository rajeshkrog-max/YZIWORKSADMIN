import { SCORE_BANDS, SERA_SKILLS } from '../../../config/seraRubric'
import { PANEL, SECTION_LABEL, formatDuration } from './reportStyles'

const VERDICT = {
  needs_work: { icon: '!', text: 'Needs work', cls: 'border-amber-400/50 bg-amber-400/10 text-amber-300 light:text-amber-700' },
  getting_there: { icon: '↗', text: 'Getting there', cls: 'border-yzi-cyan/50 bg-yzi-cyan/10 text-accent-cyan-fg' },
  ready: { icon: '✓', text: 'Ready', cls: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400 light:text-emerald-700' },
}

// Semicircle gauge (0–100) with a brand gradient and band ticks.
function Gauge({ score, band }) {
  const arc = 'M 20 110 A 90 90 0 0 1 200 110'
  return (
    <div className="w-[220px] max-w-full" role="img" aria-label={`Overall score ${score} out of 100`}>
      <div className="relative">
      <svg viewBox="0 0 220 124" className="w-full">
        <defs>
          <linearGradient id="sera-gauge" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#FF5E00" />
            <stop offset="45%" stopColor="#FF008A" />
            <stop offset="75%" stopColor="#8B5CF6" />
            <stop offset="100%" stopColor="#22D3EE" />
          </linearGradient>
        </defs>
        <path d={arc} fill="none" strokeWidth="14" strokeLinecap="round" className="stroke-fg/10" pathLength="100" />
        <path d={arc} fill="none" stroke="url(#sera-gauge)" strokeWidth="14" strokeLinecap="round" pathLength="100" strokeDasharray={`${score} 100`} />
        {SCORE_BANDS.slice(1).map((b) => {
          const a = Math.PI * (1 - b.min / 100)
          const x = 110 + 90 * Math.cos(a)
          const y = 110 - 90 * Math.sin(a)
          return <circle key={b.id} cx={x} cy={y} r="2.5" className="fill-fg/60" />
        })}
      </svg>
      <div className="absolute inset-x-0 bottom-0 text-center leading-none">
        <span className="text-5xl font-extrabold text-fg tabular-nums">{score}</span>
        <span className="text-sm text-fg/50">/100</span>
      </div>
      </div>
      <div className="mt-3 flex justify-between text-[10px] font-medium uppercase tracking-wide">
        {SCORE_BANDS.map((b) => (
          <span key={b.id} className={b.id === band ? 'text-fg' : 'text-fg/35'}>
            {b.label}
          </span>
        ))}
      </div>
    </div>
  )
}

function Fact({ label, value }) {
  return (
    <div className="flex-1 min-w-[110px] rounded-2xl border border-fg/10 bg-fg/[0.03] px-4 py-3">
      <p className="text-lg font-bold text-fg tabular-nums">{value}</p>
      <p className="text-xs text-fg/55">{label}</p>
    </div>
  )
}

function ScoreSummary({ report, sections }) {
  const { overall, facts } = report
  const verdict = overall.band ? VERDICT[overall.band] : null

  return (
    <section className={PANEL} aria-labelledby="sera-summary">
      <h2 id="sera-summary" className={SECTION_LABEL}>
        Summary
      </h2>
      <div className="mt-4 flex flex-col md:flex-row md:items-center gap-6 md:gap-10">
        {sections.gauge && (
          <div className="flex flex-col items-center shrink-0">
            <Gauge score={overall.score} band={overall.band} />
            {verdict && (
              <span className={`mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full border text-sm font-semibold ${verdict.cls}`}>
                <span aria-hidden="true">{verdict.icon}</span>
                {verdict.text}
              </span>
            )}
          </div>
        )}
        <div className="flex-1 min-w-0">
          {sections.summary && <p className="text-base sm:text-lg text-fg/85 leading-relaxed">{overall.summary}</p>}
          <div className="mt-5 flex flex-wrap gap-3">
            <Fact label="Time you spoke" value={formatDuration(facts.secondsSpoken)} />
            <Fact label="Questions answered" value={facts.questionsAnswered} />
            <Fact label="Rounds completed" value={`${facts.roundsCompleted} of ${facts.roundsTotal}`} />
          </div>
        </div>
      </div>

      <details className="mt-6 group rounded-2xl border border-fg/10 bg-fg/[0.03] px-4 py-3">
        <summary className="cursor-pointer text-sm font-semibold text-fg list-none flex items-center justify-between">
          How Sera scores
          <span className="text-fg/50 transition-transform group-open:rotate-45 motion-reduce:transition-none" aria-hidden="true">+</span>
        </summary>
        <div className="mt-3 text-sm text-fg/70 leading-relaxed space-y-2">
          <p>
            Sera rates each of your answers from 1 to 5 on five skills ({SERA_SKILLS.map((s) => s.label.toLowerCase()).join(', ')}),
            using a written description of what each level looks like for an entry-level candidate.
          </p>
          <p>
            The numbers are then worked out in code, not by the AI: each skill is the average of its ratings, turned into 0–100,
            and your overall score is a weighted average of the skills. Below 50 is "Needs work", 50–69 "Getting there", 70 and above "Ready".
          </p>
          <p>
            If an answer doesn't show a skill, that skill isn't rated — it's never guessed. Every quote on this page is copied
            word for word from your interview. The "expected level" marks are YZI's own targets for this kind of role, not data about other candidates.
          </p>
        </div>
      </details>
    </section>
  )
}

export default ScoreSummary
