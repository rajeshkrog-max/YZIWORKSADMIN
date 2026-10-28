import { Link } from 'react-router-dom'
import { SERA_VISITOR_PLAN, formatRupees } from '../config/seraPricing'
import { SERA_ROUNDS, INTERVIEW_LENGTH_LABEL } from '../config/seraRounds'

// Home page teaser for Meet Sera: copy, price and one link to /meet-sera on the
// left, the interview journey on the right. Prices and rounds come from the
// same config as the Sera page, so the two never disagree.
const PRICE = formatRupees(SERA_VISITOR_PLAN.pricePaise)
const MRP = formatRupees(SERA_VISITOR_PLAN.mrpPaise)
const SAVE_PERCENT = Math.round((1 - SERA_VISITOR_PLAN.pricePaise / SERA_VISITOR_PLAN.mrpPaise) * 100)

const AVATAR_TINTS = [
  'from-yzi-cyan to-yzi-purple',
  'from-yzi-pink to-yzi-purple',
  'from-yzi-orange to-yzi-pink',
]

// Stroke icon paths (24×24): a voice screening, a people round, the final, the report.
const ICONS = {
  screening: ['M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z', 'M19 10v2a7 7 0 0 1-14 0v-2', 'M12 19v3'],
  hr: [
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
    'M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z',
    'M22 21v-2a4 4 0 0 0-3-3.87',
    'M16 3.13a4 4 0 0 1 0 7.75',
  ],
  final: [
    'M6 9H4.5a2.5 2.5 0 0 1 0-5H6',
    'M18 9h1.5a2.5 2.5 0 0 0 0-5H18',
    'M4 22h16',
    'M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22',
    'M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22',
    'M18 2H6v7a6 6 0 0 0 12 0V2Z',
  ],
  report: [
    'M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z',
    'M14 2v4a2 2 0 0 0 2 2h4',
    'M10 9H8',
    'M16 13H8',
    'M16 17H8',
  ],
}

function StepIcon({ paths }) {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths.map((d) => <path key={d} d={d} />)}
    </svg>
  )
}

const JOURNEY = [
  ...SERA_ROUNDS.filter((r) => r.interviewer).map((r, i) => ({
    key: r.id,
    icon: ICONS[r.id] ?? ICONS.screening,
    tint: AVATAR_TINTS[i % AVATAR_TINTS.length],
    title: r.label,
    detail: `with ${r.interviewer.name} · ${Math.round(r.seconds / 60)} min`,
  })),
  { key: 'report', icon: ICONS.report, tint: 'from-emerald-400 to-yzi-cyan', title: 'Detailed PDF report', detail: 'Ready right after the interview' },
]

function SeraPromo() {
  return (
    <section className="relative py-24 md:py-32 bg-yzi-dark overflow-hidden">
      <div className="absolute -top-24 right-0 w-[480px] h-[480px] bg-yzi-pink/10 rounded-full blur-[120px]"></div>
      <div className="absolute bottom-0 -left-24 w-[400px] h-[400px] bg-yzi-cyan/10 rounded-full blur-[120px]"></div>

      <div className="relative z-10 max-w-6xl mx-auto px-6 grid lg:grid-cols-[1.1fr_1fr] gap-14 lg:gap-20 items-center">

        {/* Copy, price, the one action */}
        <div className="text-center lg:text-left">
          <p className="inline-flex items-center gap-2 text-sm text-accent-cyan-fg tracking-widest uppercase mb-5 font-medium">
            <span className="relative flex w-2 h-2">
              <span className="absolute inset-0 rounded-full bg-yzi-cyan opacity-75 animate-ping"></span>
              <span className="relative w-2 h-2 rounded-full bg-yzi-cyan"></span>
            </span>
            SERA Interview by YZI Works
          </p>

          <h2 className="text-4xl md:text-5xl font-bold leading-[1.1] tracking-tight mb-5 text-balance">
            Practice before the{' '}
            <span className="bg-gradient-to-r from-yzi-orange via-yzi-pink to-yzi-purple bg-clip-text text-transparent">
              real interview.
            </span>
          </h2>

          <p className="text-base md:text-lg text-yzi-muted max-w-lg mx-auto lg:mx-0 mb-10 leading-relaxed">
            AI Interview Practice + Detailed PDF Report
          </p>

          <div className="flex flex-col sm:flex-row items-center lg:items-end justify-center lg:justify-start gap-6 sm:gap-8">
            <div className="tabular-nums">
              <p className="text-xs font-semibold tracking-widest uppercase text-emerald-400 light:text-emerald-700 mb-1">
                {SERA_VISITOR_PLAN.offerLabel} · Save {SAVE_PERCENT}%
              </p>
              <p className="flex items-baseline justify-center lg:justify-start gap-3">
                <span className="text-5xl font-extrabold leading-none">{PRICE}</span>
                <span className="text-lg text-fg/40 line-through decoration-2">{MRP}</span>
              </p>
            </div>

            <Link
              to="/meet-sera"
              className="group inline-flex items-center gap-2 px-8 py-3.5 rounded-full bg-gradient-to-r from-yzi-orange to-yzi-pink text-white font-semibold shadow-lg shadow-yzi-pink/25 hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-yzi-pink transition-transform duration-300"
            >
              Meet Ai Sera
              <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">→</span>
            </Link>
          </div>

          <p className="mt-5 text-sm text-fg/45">One-time purchase · no recurring charges</p>
        </div>

        {/* The interview journey */}
        <div className="relative w-full max-w-md mx-auto lg:mr-0">
          <div className="absolute -inset-px rounded-3xl bg-gradient-to-br from-yzi-cyan/40 via-yzi-pink/30 to-yzi-orange/40"></div>
          <div className="relative rounded-3xl bg-yzi-card p-6 sm:p-8">
            <div className="flex items-center justify-between mb-6">
              <p className="text-xs font-semibold tracking-widest uppercase text-fg/55">Your interview</p>
              <p className="text-xs text-fg/45">{INTERVIEW_LENGTH_LABEL}</p>
            </div>

            <ol className="relative space-y-5">
              <span className="absolute left-5 top-5 bottom-5 w-px bg-fg/10" aria-hidden="true"></span>
              {JOURNEY.map((step) => (
                <li key={step.key} className="relative flex items-center gap-4">
                  <span className={`shrink-0 w-10 h-10 rounded-full bg-gradient-to-br ${step.tint} flex items-center justify-center text-white ring-4 ring-yzi-card`}>
                    <StepIcon paths={step.icon} />
                  </span>
                  <div className="text-left">
                    <p className="font-semibold leading-tight">{step.title}</p>
                    <p className="text-sm text-yzi-muted">{step.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  )
}

export default SeraPromo
