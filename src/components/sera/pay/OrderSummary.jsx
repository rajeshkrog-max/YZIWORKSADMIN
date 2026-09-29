import { SERA_VISITOR_PLAN } from '../../../config/seraPricing'

const INCLUDES = [
  'Questions based on your résumé',
  'Your strengths and areas to work on',
  'A 3-step roadmap for your next role',
]

const Tick = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 text-emerald-500">
    <path d="M5 12.5 10 17l9-10" />
  </svg>
)

const SoundBars = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
    <path d="M4 10v4M8 7v10M12 4v16M16 8v8M20 11v2" />
  </svg>
)

function Row({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-fg/55 shrink-0">{label}</span>
      <span className="min-w-0 flex items-center gap-1.5 text-fg">{children}</span>
    </div>
  )
}

// Pay card sections 1 (what you get) and 2 (account + résumé).
function OrderSummary({ email, fileName }) {
  return (
    <>
      <section className="pb-5">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-fg/45 mb-3">Your session</p>
        <div className="flex items-center gap-3.5">
          <span className="w-12 h-12 shrink-0 rounded-[14px] grid place-items-center bg-gradient-to-br from-yzi-cyan via-yzi-purple to-yzi-pink shadow-[0_8px_24px_rgba(139,92,246,0.35)]">
            <SoundBars />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-fg leading-tight">Sera AI Interview</h2>
            <p className="text-xs text-fg/55 mt-0.5">{SERA_VISITOR_PLAN.minutes}-minute live voice interview · 1 session</p>
          </div>
        </div>
        <ul className="mt-4 flex flex-col gap-2">
          {INCLUDES.map((line) => (
            <li key={line} className="flex items-center gap-2.5 text-sm text-fg/80">
              <Tick />
              {line}
            </li>
          ))}
        </ul>
      </section>

      <section className="py-5 border-t border-fg/10 flex flex-col gap-2.5">
        <Row label="Account">
          <span className="truncate">{email}</span>
        </Row>
        <Row label="Résumé">
          <span className="truncate" title={fileName}>{fileName}</span>
          <Tick />
        </Row>
      </section>
    </>
  )
}

export default OrderSummary
