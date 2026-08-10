import productionsLogo from '../assets/aboutus/verticals/yzi-productions.png'
import eventsLogo from '../assets/aboutus/verticals/yzi-events.png'
import studiosLogo from '../assets/aboutus/verticals/yzi-studios.png'
import skillzoneLogo from '../assets/aboutus/verticals/skillzone.png'
import worksLogo from '../assets/aboutus/verticals/yzi-works.png'

const wings = [
  {
    key: 'skillzone',
    logo: skillzoneLogo,
    name: 'SkillZone',
    tagline: 'AI-Powered Skilling Portal',
    // Standalone wordmark, not the shared YZI glyph — needs different sizing.
    logoClass: 'h-8 md:h-9'
  },
  {
    key: 'works',
    logo: worksLogo,
    name: 'YZI Works',
    tagline: 'The Community Platform',
    logoClass: 'h-11 md:h-13'
  },
  {
    key: 'events',
    logo: eventsLogo,
    name: 'YZI Events',
    tagline: 'Experiences & Live Entertainment',
    logoClass: 'h-11 md:h-13'
  },
  {
    key: 'studios',
    logo: studiosLogo,
    name: 'YZI Studios',
    tagline: 'Film, Content & Production',
    logoClass: 'h-11 md:h-13'
  }
]

// x-positions (as % of container width) for the 4 branch endpoints —
// centers of a 4-column grid: 12.5 / 37.5 / 62.5 / 87.5
const BRANCH_X = [100, 300, 500, 700] // out of an 800-wide viewBox
const VIEW_W = 800
const VIEW_H = 84

/**
 * Rotating conic-gradient "holographic" edge, shared by every card.
 */
function HoloCard({ children, className = '', spinClass = 'animate-holo-spin' }) {
  return (
    <div
      className={`group relative rounded-[26px] p-[1.5px] ${spinClass} ${className}`}
      style={{
        background:
          'conic-gradient(from var(--holo-angle, 0deg), #FF5E00, #FF008A, #8B5CF6, #3B82F6, #22D3EE, #FF5E00)'
      }}
    >
      <div className="relative h-full rounded-[24.5px] bg-yzi-card/95 backdrop-blur-xl overflow-hidden transition-transform duration-500 ease-out group-hover:-translate-y-1.5">
        <div
          className="pointer-events-none absolute inset-0 -translate-x-[130%] group-hover:translate-x-[130%] transition-transform duration-[1100ms] ease-out"
          style={{
            background:
              'linear-gradient(115deg, transparent 42%, rgba(255,255,255,0.14) 50%, transparent 58%)'
          }}
        />
        {children}
      </div>
    </div>
  )
}

/**
 * Energy-flow connector: an SVG fan of 4 curved branches running from the
 * parent card down into each of the 4 wing cards, with a flowing dash
 * pattern on the stroke itself plus a small pulse travelling along every
 * branch — visually "fuel" moving out from YZI Productions into each
 * vertical, on a continuous, staggered loop.
 */
function FlowConnector() {
  const paths = BRANCH_X.map((x) => `M400,0 C400,${VIEW_H * 0.45} ${x},${VIEW_H * 0.45} ${x},${VIEW_H}`)

  return (
    <div className="hidden md:block w-full" style={{ height: VIEW_H }} aria-hidden="true">
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="none"
        className="w-full h-full overflow-visible"
      >
        <defs>
          <linearGradient id="flowGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FF5E00" />
            <stop offset="35%" stopColor="#FF008A" />
            <stop offset="70%" stopColor="#8B5CF6" />
            <stop offset="100%" stopColor="#22D3EE" />
          </linearGradient>
          <radialGradient id="dotGlow">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </radialGradient>
        </defs>

        {paths.map((d, i) => (
          <g key={i}>
            {/* base faint line */}
            <path d={d} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" />
            {/* flowing dashed current */}
            <path
              d={d}
              fill="none"
              stroke="url(#flowGradient)"
              strokeWidth="1.5"
              strokeDasharray="8 14"
              strokeLinecap="round"
              opacity="0.85"
              className="flow-dash"
              style={{ animationDelay: `${i * 0.25}s` }}
            />
            {/* travelling pulse */}
            <circle r="5" fill="url(#dotGlow)">
              <animateMotion
                dur="2.4s"
                repeatCount="indefinite"
                begin={`${i * 0.3}s`}
                path={d}
                keyPoints="0;1"
                keyTimes="0;1"
                calcMode="linear"
              />
            </circle>
          </g>
        ))}
      </svg>
    </div>
  )
}

/** Simple animated vertical drip for mobile, where the SVG fan is hidden. */
function MobileFlowLine() {
  return (
    <div className="md:hidden relative flex justify-center h-10" aria-hidden="true">
      <div className="w-px h-full bg-gradient-to-b from-white/25 via-white/10 to-white/25 overflow-hidden">
        <div className="w-full h-3 bg-gradient-to-b from-yzi-orange via-yzi-pink to-yzi-cyan animate-mobile-flow" />
      </div>
    </div>
  )
}

function OurVerticals() {
  return (
    <section className="relative py-24 md:py-28 bg-yzi-black border-t border-white/5 overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-yzi-purple/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative max-w-5xl mx-auto px-6">
        <div className="text-center mb-16 md:mb-20">
          <p className="text-yzi-cyan text-xs md:text-sm tracking-[0.3em] uppercase mb-4 font-medium">
            Our Ecosystem
          </p>
          <h2 className="text-3xl md:text-5xl font-bold mb-4">
            One Parent.{' '}
            <span className="bg-gradient-to-r from-yzi-orange via-yzi-pink to-yzi-purple bg-clip-text text-transparent">
              Four Verticals.
            </span>
          </h2>
          <p className="text-yzi-muted text-base md:text-lg max-w-xl mx-auto leading-relaxed">
            YZI Productions Pvt. Ltd. is the company behind every brand you see
            here — fueling each vertical with the same mission, team and values.
          </p>
        </div>

        {/* ===== Parent: YZI Productions ===== */}
        <div className="flex justify-center mb-2">
          <HoloCard className="w-full max-w-sm" spinClass="animate-holo-spin-slow">
            <div className="relative flex flex-col items-center text-center px-8 py-10">
              {/* pulsing core ring — the "power source" */}
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-16 h-16 rounded-full animate-core-pulse pointer-events-none" />
              <span className="inline-block px-3 py-1 rounded-full bg-gradient-to-r from-yzi-orange to-yzi-pink text-[10px] tracking-widest uppercase font-semibold mb-6">
                Parent Company
              </span>
              <img
                src={productionsLogo}
                alt="YZI Productions Private Limited"
                className="h-16 md:h-20 w-auto object-contain mb-5"
                draggable={false}
              />
              <h3 className="text-lg md:text-xl font-bold">
                YZI Productions Pvt. Ltd.
              </h3>
              <p className="text-yzi-muted text-sm mt-1">
                The company behind every YZI vertical
              </p>
            </div>
          </HoloCard>
        </div>

        <FlowConnector />
        <MobileFlowLine />

        {/* ===== Wings: SkillZone / YZI Works / Events / Studios ===== */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {wings.map((wing) => (
            <HoloCard key={wing.key}>
              <div className="flex flex-col items-center text-center px-4 py-8 md:px-6 md:py-10 h-full">
                <div className="flex-1 flex items-center justify-center mb-4 md:mb-5">
                  <img
                    src={wing.logo}
                    alt={wing.name}
                    className={`${wing.logoClass} w-auto object-contain`}
                    draggable={false}
                  />
                </div>
                <h3 className="text-sm md:text-base font-semibold leading-tight">
                  {wing.name}
                </h3>
                <p className="text-yzi-muted text-[11px] md:text-xs mt-1 leading-snug">
                  {wing.tagline}
                </p>
              </div>
            </HoloCard>
          ))}
        </div>
      </div>

      <style>{`
        @property --holo-angle {
          syntax: '<angle>';
          initial-value: 0deg;
          inherits: false;
        }
        @keyframes holo-rotate {
          to { --holo-angle: 360deg; }
        }
        .animate-holo-spin { animation: holo-rotate 6s linear infinite; }
        .animate-holo-spin-slow { animation: holo-rotate 10s linear infinite; }
        .animate-holo-spin:hover,
        .animate-holo-spin-slow:hover { animation-duration: 2s; }

        @keyframes flow-dash-move {
          to { stroke-dashoffset: -44; }
        }
        .flow-dash {
          animation: flow-dash-move 1.4s linear infinite;
        }

        @keyframes core-pulse {
          0% { box-shadow: 0 0 0 0 rgba(255,94,0,0.45); opacity: 1; }
          70% { box-shadow: 0 0 0 26px rgba(255,94,0,0); opacity: 0; }
          100% { box-shadow: 0 0 0 0 rgba(255,94,0,0); opacity: 0; }
        }
        .animate-core-pulse {
          background: radial-gradient(circle, rgba(255,94,0,0.5), transparent 70%);
          animation: core-pulse 2.4s ease-out infinite;
        }

        @keyframes mobile-flow-move {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(250%); }
        }
        .animate-mobile-flow {
          animation: mobile-flow-move 1.8s linear infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .animate-holo-spin,
          .animate-holo-spin-slow,
          .flow-dash,
          .animate-core-pulse,
          .animate-mobile-flow {
            animation: none;
          }
        }
      `}</style>
    </section>
  )
}

export default OurVerticals
