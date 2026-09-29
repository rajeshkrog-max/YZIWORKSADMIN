import { ROUND_LABELS, formatTimestamp } from '../../../shared/seraReportSchema'
import { PANEL, SECTION_LABEL, SECTION_TITLE } from './reportStyles'

const EXPECTED_LABEL = 'Expected level for this role'

// Five skills: bar + value + expected-level marker + the candidate's own words.
// A skill with no evidence shows no bar (never a guessed number).
function SkillEvidence({ skills, showBar }) {
  return (
    <section className={PANEL} aria-labelledby="sera-skills">
      <p className={SECTION_LABEL}>Skills, with what you said</p>
      <h2 id="sera-skills" className={`${SECTION_TITLE} mt-1`}>Where you stand on each skill</h2>
      <p className="mt-2 flex items-center gap-2 text-xs text-fg/55">
        <span className="inline-block w-0.5 h-3.5 bg-fg/70 rounded" aria-hidden="true" />
        {EXPECTED_LABEL} (YZI's own target)
      </p>

      <ul className="mt-5 flex flex-col gap-6">
        {skills.map((skill) => (
          <li key={skill.id}>
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="font-semibold text-fg">{skill.label}</h3>
              {showBar(skill) ? (
                <span className="text-sm font-bold text-fg tabular-nums">{skill.score}/100</span>
              ) : (
                <span className="text-xs text-fg/50">Not enough evidence in this interview</span>
              )}
            </div>
            {showBar(skill) && (
              <>
                <div className="relative mt-2 h-2.5 rounded-full bg-fg/10">
                  <div className="h-full rounded-full bg-gradient-to-r from-yzi-cyan to-yzi-purple" style={{ width: `${skill.score}%` }} />
                  <span
                    className="absolute -top-1 -bottom-1 w-0.5 rounded bg-fg/80"
                    style={{ left: `calc(${skill.expected}% - 1px)` }}
                    title={`${EXPECTED_LABEL}: ${skill.expected}`}
                    aria-label={`${EXPECTED_LABEL}: ${skill.expected}`}
                  />
                </div>
                {skill.quote && (
                  <blockquote className="mt-3 pl-3 border-l-2 border-yzi-cyan/50">
                    <p className="text-sm text-fg/80 italic">“{skill.quote.text}”</p>
                    <footer className="mt-1 text-xs font-mono text-fg/45">
                      {ROUND_LABELS[skill.quote.round]} · {formatTimestamp(skill.quote.timestamp)}
                    </footer>
                  </blockquote>
                )}
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

export default SkillEvidence
