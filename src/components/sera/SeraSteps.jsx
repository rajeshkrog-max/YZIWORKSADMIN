import { useEffect, useRef, useState } from 'react'

// Animated walkthrough of the Sera journey. Display only — no buttons here.
const STEPS = ['Sign up', 'Upload CV', 'Payment', 'Analysis', 'Interview', 'Report', 'Join YZI Works']
const STEP_MS = 1400        // time on each active step
const LOOP_HOLD_MS = 2200   // hold on the completed path before starting again
const USER_SCROLL_PAUSE_MS = 4000

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  )
}

function SeraSteps() {
  const [reduceMotion] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
  // 0–6 = active step; STEPS.length = every step complete (held, then loops to 0)
  const [active, setActive] = useState(0)
  const [inView, setInView] = useState(false)
  const sectionRef = useRef(null)
  const scrollerRef = useRef(null)
  const itemRefs = useRef([])
  const userScrolledAt = useRef(0)

  // Only animate while the section is on screen.
  useEffect(() => {
    if (reduceMotion || !sectionRef.current) return
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.25 })
    observer.observe(sectionRef.current)
    return () => observer.disconnect()
  }, [reduceMotion])

  useEffect(() => {
    if (reduceMotion || !inView) return
    const allDone = active >= STEPS.length
    const timer = setTimeout(
      () => setActive((a) => (a >= STEPS.length ? 0 : a + 1)),
      allDone ? LOOP_HOLD_MS : STEP_MS
    )
    return () => clearTimeout(timer)
  }, [active, inView, reduceMotion])

  // Mobile: keep the active step in view inside the horizontal scroller,
  // unless the visitor has just scrolled it themselves.
  useEffect(() => {
    const scroller = scrollerRef.current
    const item = itemRefs.current[Math.min(active, STEPS.length - 1)]
    if (reduceMotion || !inView || !scroller || !item) return
    if (scroller.scrollWidth <= scroller.clientWidth) return
    if (Date.now() - userScrolledAt.current < USER_SCROLL_PAUSE_MS) return
    scroller.scrollTo({
      left: item.offsetLeft - (scroller.clientWidth - item.offsetWidth) / 2,
      behavior: 'smooth',
    })
  }, [active, inView, reduceMotion])

  const progress = reduceMotion ? 1 : Math.min(active, STEPS.length - 1) / (STEPS.length - 1)

  const statusOf = (i) => {
    if (reduceMotion) return 'static'
    if (i < active) return 'done'
    if (i === active) return 'active'
    return 'upcoming'
  }

  const gradient = 'bg-gradient-to-br from-yzi-orange via-yzi-pink to-yzi-purple text-white'
  const circleClass = {
    upcoming: 'w-11 h-11 border-2 border-fg/15 bg-surface',
    done: `w-11 h-11 ${gradient}`,
    static: `w-11 h-11 ${gradient}`,
    active: `w-14 h-14 ${gradient} rotate-3 shadow-[0_0_0_6px_rgba(255,0,138,0.14),0_0_28px_rgba(139,92,246,0.55)]`,
  }

  return (
    <section ref={sectionRef} className="px-6 py-16 md:py-24 border-t border-fg/5">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">Try now in simple steps</h2>

        <div
          ref={scrollerRef}
          onPointerDown={() => { userScrolledAt.current = Date.now() }}
          onWheel={() => { userScrolledAt.current = Date.now() }}
          className="-mx-6 px-6 pb-2 overflow-x-auto snap-x snap-mandatory md:mx-0 md:px-0 md:overflow-visible md:snap-none"
        >
          <div className="relative min-w-[728px] md:min-w-0">
            {/* Track + fill run between the first and last circle centres */}
            <div
              aria-hidden="true"
              className="absolute top-8 -translate-y-1/2 h-0.5 bg-fg/15 rounded-full"
              style={{ left: 'calc(100% / 14)', right: 'calc(100% / 14)' }}
            />
            <div
              aria-hidden="true"
              className="absolute top-8 -translate-y-1/2 h-0.5 rounded-full bg-gradient-to-r from-yzi-orange via-yzi-pink to-yzi-purple transition-[width] duration-700 ease-out"
              style={{ left: 'calc(100% / 14)', width: `calc(${progress} * (100% - 100% / 7))` }}
            />

            <ol className="grid grid-cols-7">
            {STEPS.map((label, i) => {
              const status = statusOf(i)
              return (
                <li
                  key={label}
                  ref={(el) => { itemRefs.current[i] = el }}
                  aria-current={status === 'active' ? 'step' : undefined}
                  className="snap-center flex flex-col items-center text-center"
                >
                  <div className="h-16 grid place-items-center">
                    <span
                      className={`relative z-10 grid place-items-center rounded-full font-semibold transition-all duration-500 ${circleClass[status]}`}
                    >
                      {status === 'done' && <CheckIcon />}
                      {(status === 'active' || status === 'static') && <span aria-hidden="true">{i + 1}</span>}
                    </span>
                  </div>
                  <span
                    className={`mt-3 px-1 text-sm font-medium leading-snug transition-colors duration-500 ${
                      status === 'active' ? 'text-fg' : 'text-fg/60'
                    }`}
                  >
                    {label}
                  </span>
                </li>
              )
            })}
            </ol>
          </div>
        </div>
      </div>
    </section>
  )
}

export default SeraSteps
