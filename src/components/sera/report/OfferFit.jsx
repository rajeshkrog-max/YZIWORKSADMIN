import { ROUND_LABELS, formatTimestamp } from '../../../shared/seraReportSchema'
import { PANEL, SECTION_LABEL, SECTION_TITLE } from './reportStyles'

// Student only: each requirement of the chosen practice offer, and whether the
// interview showed it (only with a word-for-word quote).
function OfferFit({ offerFit }) {
  return (
    <section className={PANEL} aria-labelledby="sera-fit">
      <p className={SECTION_LABEL}>Offer fit</p>
      <h2 id="sera-fit" className={`${SECTION_TITLE} mt-1`}>
        Fit for the {offerFit.company} offer
      </h2>
      <p className="mt-1 text-sm text-fg/55">{offerFit.role} · practice offer</p>
      <ul className="mt-5 flex flex-col gap-3">
        {offerFit.items.map((item) => (
          <li key={item.requirement} className="flex items-start gap-3 rounded-2xl border border-fg/10 bg-fg/[0.03] p-4">
            <span
              className={`w-6 h-6 shrink-0 rounded-full grid place-items-center text-xs font-bold ${
                item.shown ? 'bg-emerald-500/15 text-emerald-500' : 'bg-amber-400/15 text-amber-500'
              }`}
              aria-hidden="true"
            >
              {item.shown ? '✓' : '!'}
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-fg">{item.requirement}</p>
              <p className={`text-xs font-medium ${item.shown ? 'text-emerald-400 light:text-emerald-700' : 'text-amber-300 light:text-amber-700'}`}>
                {item.shown ? 'Shown in interview' : 'Not shown yet'}
              </p>
              {item.quote && (
                <p className="mt-1.5 text-sm text-fg/70 italic">
                  “{item.quote.text}”{' '}
                  <span className="not-italic text-xs font-mono text-fg/45">
                    {ROUND_LABELS[item.quote.round]} · {formatTimestamp(item.quote.timestamp)}
                  </span>
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default OfferFit
