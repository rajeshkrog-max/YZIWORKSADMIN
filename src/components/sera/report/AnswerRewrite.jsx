import { ROUND_LABELS, formatTimestamp } from '../../../shared/seraReportSchema'
import { PANEL, SECTION_LABEL, SECTION_TITLE } from './reportStyles'

// One real answer, and a stronger version built only from what was said.
function AnswerRewrite({ rewrite }) {
  return (
    <section className={PANEL} aria-labelledby="sera-rewrite">
      <p className={SECTION_LABEL}>One answer, improved</p>
      <h2 id="sera-rewrite" className={`${SECTION_TITLE} mt-1`}>“{rewrite.question}”</h2>
      <p className="mt-1 text-xs font-mono text-fg/45">
        Sera's question · {ROUND_LABELS[rewrite.round]} · {formatTimestamp(rewrite.timestamp)}
      </p>
      <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-fg/10 bg-fg/[0.03] p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-fg/50">You said</p>
          <p className="mt-2 text-sm text-fg/80 italic leading-relaxed">“{rewrite.youSaid}”</p>
        </div>
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.07] p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-400 light:text-emerald-700">
            A stronger answer
          </p>
          <p className="mt-2 text-sm text-fg/90 leading-relaxed">{rewrite.stronger}</p>
        </div>
      </div>
    </section>
  )
}

export default AnswerRewrite
