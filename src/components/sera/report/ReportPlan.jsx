import { PANEL, SECTION_LABEL, SECTION_TITLE } from './reportStyles'

const HORIZON = {
  '30d': { label: 'Next 30 days', dot: 'bg-yzi-orange' },
  '1-3m': { label: '1–3 months', dot: 'bg-yzi-pink' },
  '6-12m': { label: '6–12 months', dot: 'bg-yzi-purple' },
}

function ReportPlan({ plan }) {
  return (
    <section className={PANEL} aria-labelledby="sera-plan">
      <p className={SECTION_LABEL}>Your plan</p>
      <h2 id="sera-plan" className={`${SECTION_TITLE} mt-1`}>What to do next</h2>
      <ol className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
        {plan.map((step) => (
          <li key={step.horizon} className="rounded-2xl border border-fg/10 bg-fg/[0.03] p-4 flex flex-col">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-fg/60">
              <span className={`w-2 h-2 rounded-full ${HORIZON[step.horizon].dot}`} aria-hidden="true" />
              {HORIZON[step.horizon].label}
            </p>
            <h3 className="mt-2 font-bold text-fg">{step.title}</h3>
            <p className="mt-1.5 text-sm text-fg/70 leading-relaxed flex-1">{step.text}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {step.skills.map((skill) => (
                <span key={skill} className="px-2 py-0.5 rounded-md border border-fg/15 bg-fg/5 text-[11px] text-fg/75">
                  {skill}
                </span>
              ))}
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}

export default ReportPlan
