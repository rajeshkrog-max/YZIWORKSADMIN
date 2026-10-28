import SeraWave from './SeraWave'
import { SERA_VISITOR_PLAN, formatRupees } from '../../config/seraPricing'
import { SERA_ROUNDS, INTERVIEW_LENGTH_LABEL } from '../../config/seraRounds'

// Meet Sera landing, under the hero slider: video → offer → why practise → what you get →
// how it works → offer again → FAQ → closing call. Every CTA calls onStart (sign in);
// the campus line calls onStudent (sign in on the Student tab, no payment).
// Prices come from the display plan; the amount charged comes from the server's order.
const NEON_RING = 'linear-gradient(135deg, #22D3EE 0%, #FF008A 38%, #8B5CF6 68%, #FF5E00 100%)'
const SUPPORT_EMAIL = 'works@youngzoneindia.com'
const OVERVIEW_VIDEO_SRC = '/sera-overview.mp4'

// "Screening with Sera, HR round with Vinit and Final round with Sonia"
const ROUND_LINE = SERA_ROUNDS.filter((r) => r.interviewer)
  .map((r) => `${r.label} with ${r.interviewer.name}`)
  .join(', ')
  .replace(/, ([^,]*)$/, ' and $1')

const PRICE = formatRupees(SERA_VISITOR_PLAN.pricePaise)
const MRP = formatRupees(SERA_VISITOR_PLAN.mrpPaise)
const SAVE_PERCENT = Math.round((1 - SERA_VISITOR_PLAN.pricePaise / SERA_VISITOR_PLAN.mrpPaise) * 100)

const BENEFITS = [
  {
    title: 'Practice before the real thing',
    body: 'Experience an AI interview rather than relying entirely on mental preparation.',
    icon: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3ZM5 11a7 7 0 0 0 14 0M12 18v3',
  },
  {
    title: 'Understand your performance',
    body: 'Review the assessment and feedback provided by our AI SERA.',
    icon: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  },
  {
    title: 'Know what to work on',
    body: 'Use your detailed PDF report to guide your next steps in preparation.',
    icon: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM12 12h.01',
  },
]

const INCLUDED = [
  {
    title: 'SERA Interview',
    body: 'An AI-powered interview practice experience, built from your own CV, to help you prepare for upcoming interviews. Completely private.',
  },
  {
    title: 'Detailed PDF Report',
    body: 'A report containing your assessment results and the feedback actually provided by our AI SERA, so you can review your performance after the interview.',
  },
]

const STEPS = [
  { title: 'Get started', body: `Sign in, upload your CV and purchase SERA Interview for ${PRICE}.` },
  {
    title: 'Practice',
    body: `SERA reads your CV and builds three role offers for you. Then complete three voice rounds: ${ROUND_LINE}, ${INTERVIEW_LENGTH_LABEL} in all.`,
  },
  {
    title: 'Review your report',
    body: 'Access your detailed PDF report and use it to guide your preparation, and your next step with YZI Works.',
  },
]

const FAQS = [
  {
    q: 'Who is this interview for?',
    a: 'Students, fresh graduates and job seekers who want to practice for interviews and review their performance.',
  },
  {
    q: 'What do I receive?',
    a: 'An AI interview practice experience and a detailed PDF report, as described on this page.',
  },
  {
    q: 'Does this guarantee a job or interview selection?',
    a: 'No. SERA Interview is a preparation tool. Your interview outcome depends on many factors, and results are not guaranteed.',
  },
  {
    q: 'How much does it cost?',
    a: `The introductory purchase price is ${PRICE}, against the stated ${MRP} actual price.`,
  },
  {
    q: 'When will I receive my report?',
    a: 'Immediately after the interview ends. SERA might take 1–2 minutes for processing.',
  },
  {
    q: 'What happens if I experience a technical issue?',
    a: (
      <>
        Please email us at{' '}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="text-accent-cyan-fg underline underline-offset-2">
          {SUPPORT_EMAIL}
        </a>{' '}
        with a screenshot of the error message or your session ID, and our team will help you recover your session, or
        with a refund if applicable.
      </>
    ),
  },
]

function Icon({ d, className = 'w-5 h-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  )
}

function CtaButton({ onClick, children, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-8 py-4 rounded-full bg-gradient-to-r from-yzi-orange via-yzi-pink to-yzi-purple text-white font-semibold tracking-wide uppercase text-sm shadow-lg shadow-yzi-pink/25 hover:scale-[1.03] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-yzi-pink transition-transform duration-300 ${className}`}
    >
      {children}
    </button>
  )
}

function SaveBadge() {
  return (
    <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 light:text-emerald-700 border border-emerald-500/30">
      Save {SAVE_PERCENT}%
    </span>
  )
}

function SectionHeading({ eyebrow, title, children }) {
  return (
    <div className="max-w-2xl mx-auto text-center mb-12">
      {eyebrow && (
        <span className="text-xs font-semibold tracking-widest uppercase text-accent-cyan-fg">{eyebrow}</span>
      )}
      <h2 className="mt-3 text-3xl md:text-4xl font-bold tracking-tight leading-tight text-balance">{title}</h2>
      {children && <div className="mt-5 text-fg/70 text-base md:text-lg leading-relaxed space-y-3">{children}</div>}
    </div>
  )
}

// The offer card: what it is, the reference price against the offer, one action.
function PriceCard({ onStart, onStudent }) {
  return (
    <div className="w-full max-w-md mx-auto rounded-3xl border border-fg/10 bg-card p-6 sm:p-8 text-center shadow-2xl shadow-black/30 light:shadow-black/10">
      <span className="text-xs font-semibold tracking-widest uppercase text-fg/55">SERA Interview by YZI Works</span>
      <h3 className="mt-3 text-2xl sm:text-[28px] font-bold leading-tight">Practice before the real interview.</h3>
      <p className="mt-2 text-fg/60">AI Interview Practice + Detailed PDF Report</p>

      <div className="my-6 py-6 border-y border-fg/10 grid grid-cols-[1fr_auto_1fr] items-center gap-2 tabular-nums">
        <div>
          <p className="text-sm text-fg/50">Reference price</p>
          <p className="mt-1 text-2xl font-semibold text-fg/45 line-through decoration-2">{MRP}</p>
        </div>
        <Icon d="M5 12h14M13 6l6 6-6 6" className="w-5 h-5 text-fg/35" />
        <div>
          <p className="text-sm font-semibold text-emerald-400 light:text-emerald-700">{SERA_VISITOR_PLAN.offerLabel}</p>
          <p className="mt-1 text-4xl font-extrabold leading-none">{PRICE}</p>
          <div className="mt-2"><SaveBadge /></div>
        </div>
      </div>

      <CtaButton onClick={onStart} className="w-full px-4">Get my SERA Interview — {PRICE}</CtaButton>
      <p className="mt-4 text-sm text-fg/55">One-time purchase · no recurring charges</p>
      <p className="mt-5 pt-5 border-t border-fg/10 text-sm text-fg/70">
        Have a campus code?{' '}
        <button
          type="button"
          onClick={onStudent}
          className="font-semibold text-accent-cyan-fg underline underline-offset-4 hover:no-underline"
        >
          Use it here, no payment needed →
        </button>
      </p>
    </div>
  )
}

function SeraLanding({ onStart, onStudent }) {
  return (
    <>
      {/* Overview video */}
      <section className="px-6 pt-16 md:pt-24">
        <div className="max-w-4xl mx-auto text-center">
          <span className="text-xs font-semibold tracking-widest uppercase text-accent-cyan-fg">See how SERA works</span>
          <div className="mt-6 rounded-[24px] border border-fg/10 bg-[#0d0c16] p-2 sm:p-2.5 shadow-2xl shadow-black/40 light:shadow-black/15">
            <video
              src={`${OVERVIEW_VIDEO_SRC}#t=0.1`}
              controls
              playsInline
              preload="metadata"
              aria-label="SERA overview video"
              className="block w-full aspect-video rounded-[16px] bg-black object-contain"
            />
          </div>
        </div>
      </section>

      {/* 1. Offer */}
      <section className="px-6 py-16 md:py-24">
        <div className="sera-neon relative max-w-6xl mx-auto rounded-[32px] p-[1.5px]" style={{ background: NEON_RING }}>
          <div className="relative rounded-[30.5px] bg-surface px-6 py-10 md:p-14 grid lg:grid-cols-[1.1fr_1fr] items-center gap-12 lg:gap-16">
            <div className="text-center lg:text-left">
              <span className="text-xs font-semibold tracking-widest uppercase text-accent-cyan-fg">
                Prepare with AI SERA by YZI Works
              </span>
              <h1 className="mt-4 text-4xl md:text-5xl xl:text-[56px] font-extrabold tracking-tight leading-[1.05] text-balance">
                Your next interview deserves a{' '}
                <span className="bg-gradient-to-r from-yzi-cyan via-yzi-purple to-yzi-pink bg-clip-text text-transparent">
                  practice round
                </span>
              </h1>
              <p className="mt-6 text-fg/70 text-base md:text-lg leading-relaxed max-w-xl mx-auto lg:mx-0">
                An interview can open the door to your next opportunity. Before the real conversation, give yourself a
                chance to practice, review your performance and understand where you can improve.
              </p>
              <p className="mt-4 text-fg/70 text-base md:text-lg leading-relaxed max-w-xl mx-auto lg:mx-0">
                With SERA Interview, you can practice with an AI interviewer and receive a{' '}
                <b className="text-fg font-semibold">detailed PDF report</b> to guide your interview preparation.
              </p>
            </div>
            <PriceCard onStart={onStart} onStudent={onStudent} />
          </div>
        </div>
      </section>

      {/* 2. Why practise */}
      <section className="px-6 py-16 md:py-24 border-t border-fg/5">
        <div className="max-w-5xl mx-auto">
          <SectionHeading title="Don't leave your interview preparation to guesswork">
            <p>
              You may know your subject. You may have the right qualifications.{' '}
              <span className="text-fg font-medium">But do you know how you perform in an interview?</span>
            </p>
            <p>Practicing gives you an opportunity to prepare before the stakes are real.</p>
          </SectionHeading>
          <ul className="grid md:grid-cols-3 gap-5">
            {BENEFITS.map((b) => (
              <li key={b.title} className="rounded-2xl border border-fg/10 bg-card p-6">
                <span className="grid place-items-center w-11 h-11 rounded-xl bg-gradient-to-br from-yzi-orange via-yzi-pink to-yzi-purple text-white">
                  <Icon d={b.icon} />
                </span>
                <h3 className="mt-5 text-lg font-semibold">{b.title}</h3>
                <p className="mt-2 text-fg/65 leading-relaxed">{b.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 3. What you get */}
      <section className="px-6 py-16 md:py-24 border-t border-fg/5">
        <div className="max-w-5xl mx-auto">
          <SectionHeading
            eyebrow="What you get"
            title="Your interview practice. Your performance report. One simple purchase."
          />
          <ol className="grid md:grid-cols-2 gap-5">
            {INCLUDED.map((item, i) => (
              <li key={item.title} className="relative overflow-hidden rounded-2xl border border-fg/10 bg-card p-7 md:p-8">
                <span className="block text-5xl font-extrabold leading-none bg-gradient-to-br from-yzi-cyan to-yzi-purple bg-clip-text text-transparent tabular-nums">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h3 className="mt-5 text-xl font-semibold">{item.title}</h3>
                <p className="mt-2 text-fg/65 leading-relaxed">{item.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 4. How it works */}
      <section className="px-6 py-16 md:py-24 border-t border-fg/5">
        <div className="max-w-5xl mx-auto">
          <SectionHeading title="How it works" />
          <div className="relative">
          <div
            aria-hidden="true"
            className="hidden md:block absolute top-6 h-0.5 bg-gradient-to-r from-yzi-orange via-yzi-pink to-yzi-purple opacity-40"
            style={{ left: 'calc(100% / 6)', right: 'calc(100% / 6)' }}
          />
          <ol className="grid md:grid-cols-3 gap-10 md:gap-6">
            {STEPS.map((s, i) => (
              <li key={s.title} className="relative flex flex-col items-center text-center">
                <span className="relative z-10 grid place-items-center w-12 h-12 rounded-full bg-gradient-to-br from-yzi-orange via-yzi-pink to-yzi-purple text-white font-bold ring-8 ring-surface">
                  {i + 1}
                </span>
                <span className="mt-5 text-xs font-semibold tracking-widest uppercase text-fg/45">Step {i + 1}</span>
                <h3 className="mt-1 text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-fg/65 leading-relaxed max-w-xs">{s.body}</p>
              </li>
            ))}
          </ol>
          </div>
        </div>
      </section>

      {/* 5. Offer, again */}
      <section className="px-6 py-16 md:py-24 border-t border-fg/5">
        <div className="max-w-3xl mx-auto rounded-3xl border border-fg/10 bg-card px-6 py-12 md:px-14 text-center">
          <span className="text-xs font-semibold tracking-widest uppercase text-accent-cyan-fg">Your introductory offer</span>
          <div className="mt-5 flex items-baseline justify-center gap-4 tabular-nums">
            <span className="text-2xl md:text-3xl font-semibold text-fg/40 line-through decoration-2">{MRP}</span>
            <span className="text-5xl md:text-6xl font-extrabold leading-none">{PRICE}</span>
          </div>
          <div className="mt-4"><SaveBadge /></div>
          <p className="mt-5 text-fg/70 text-base md:text-lg">
            Get SERA Interview + Detailed PDF Report at {SAVE_PERCENT}% off the actual price.
          </p>
          <CtaButton onClick={onStart} className="mt-8 w-full sm:w-auto">Start my interview practice</CtaButton>
          <p className="mt-5 text-sm text-fg/55">Your next step towards better preparation starts here!</p>
        </div>
      </section>

      {/* 6. FAQ */}
      <section className="px-6 py-16 md:py-24 border-t border-fg/5">
        <div className="max-w-3xl mx-auto">
          <SectionHeading title="Frequently asked questions" />
          <div className="divide-y divide-fg/10 border-y border-fg/10">
            {FAQS.map((f) => (
              <details key={f.q} className="group py-5">
                <summary className="flex items-center justify-between gap-6 cursor-pointer list-none [&::-webkit-details-marker]:hidden text-left text-base md:text-lg font-medium">
                  {f.q}
                  <span className="shrink-0 grid place-items-center w-8 h-8 rounded-full border border-fg/15 text-fg/60 transition-transform duration-300 group-open:rotate-45">
                    <Icon d="M12 5v14M5 12h14" className="w-4 h-4" />
                  </span>
                </summary>
                <p className="mt-3 pr-14 text-fg/65 leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* 7. Closing call */}
      <section className="px-6 pt-8 pb-20 md:pb-28">
        <div className="max-w-5xl mx-auto rounded-[32px] overflow-hidden bg-[#05050A] border border-white/10 grid md:grid-cols-[1fr_auto] items-center">
          <div className="px-6 py-12 md:p-14 text-center md:text-left text-white">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight leading-tight text-balance">
              Take the first step towards a more prepared interview!
            </h2>
            <p className="mt-4 text-white/60">SERA Interview by YZI Works</p>
            <p className="mt-1 text-lg font-medium bg-gradient-to-r from-yzi-cyan via-yzi-purple to-yzi-pink bg-clip-text text-transparent">
              Practice. Review. Prepare.
            </p>
            <CtaButton onClick={onStart} className="mt-8 w-full sm:w-auto">Get started for {PRICE}</CtaButton>
          </div>
          <div
            className="hidden md:block w-[320px] h-full min-h-[320px]"
            style={{ backgroundImage: 'radial-gradient(55% 55% at 50% 50%, rgba(139,92,246,0.25), transparent 70%)' }}
          >
            <SeraWave state="idle" tone="dark" width="100%" height="100%" />
          </div>
        </div>
      </section>

      <style>{`
        .sera-neon::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
          pointer-events: none;
          box-shadow:
            0 0 18px rgba(34, 211, 238, 0.45),
            0 0 38px rgba(255, 0, 138, 0.30),
            0 0 64px rgba(139, 92, 246, 0.30),
            0 0 90px rgba(255, 94, 0, 0.18);
          animation: sera-neon-pulse 3.2s ease-in-out infinite;
        }
        @keyframes sera-neon-pulse {
          0%, 100% { opacity: 0.55; }
          50%      { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .sera-neon::before { animation: none; opacity: 0.8; }
        }
      `}</style>
    </>
  )
}

export default SeraLanding
