import { useEffect, useRef, useState } from 'react'
import partner1 from '../assets/partner1.png'
import partner2 from '../assets/partner2.png'
import partner3 from '../assets/partner3.png'
import partner4 from '../assets/partner4.png'
import partner5 from '../assets/partner5.png'
import partner6 from '../assets/partner6.png'

function PoweredBy() {
  const partners = [
    { src: partner1, alt: 'DPU FIIE' },
    { src: partner2, alt: 'DPIIT Startup India' },
    { src: partner3, alt: 'Razorpay' },
    { src: partner4, alt: 'AWS Startups' },
    { src: partner5, alt: 'Google for Startups' },
    { src: partner6, alt: 'Microsoft for Startups' },
  ]

  // Duplicate the list a few times so the loop always has enough
  // tiles on screen, however wide the container is.
  const REPEATS = 4
  const logos = Array.from({ length: REPEATS }, () => partners).flat()

  const containerRef = useRef(null)
  const trackRef = useRef(null)
  const tileRefs = useRef([])
  const xRef = useRef(0)
  const rafRef = useRef(null)
  const [isPaused, setIsPaused] = useState(false)
  const isPausedRef = useRef(false)

  const TILE_WIDTH = 176      // px, matches w-44 below
  const GAP = 40               // px, matches gap-10 below
  const STEP = TILE_WIDTH + GAP
  const SPEED = 40             // px per second — tune to taste
  const MAX_SCALE = 1.6        // how big the centered tile grows
  const RADIUS = STEP * 0.75   // how wide the "spotlight" zone is (tighter = punchier)

  useEffect(() => {
    isPausedRef.current = isPaused
  }, [isPaused])

  useEffect(() => {
    const singleSetWidth = STEP * partners.length
    let lastTime = performance.now()

    const tick = (now) => {
      const dt = (now - lastTime) / 1000
      lastTime = now

      if (!isPausedRef.current) {
        xRef.current += SPEED * dt
        // Loop seamlessly once we've scrolled one full set of partners
        if (xRef.current >= singleSetWidth) {
          xRef.current -= singleSetWidth
        }
      }

      if (trackRef.current) {
        trackRef.current.style.transform = `translateX(${-xRef.current}px)`
      }

      // Scale each tile based on distance from the container's center
      const containerWidth = containerRef.current?.offsetWidth || 0
      const center = containerWidth / 2

      tileRefs.current.forEach((el, i) => {
        if (!el) return
        const tileCenter = i * STEP + TILE_WIDTH / 2 - xRef.current
        const distance = Math.abs(tileCenter - center)
        const falloff = Math.max(0, Math.min(1, 1 - distance / RADIUS))
        // ease the falloff so it's sharper near the peak (feels more "focused")
        const eased = falloff * falloff
        const scale = 1 + (MAX_SCALE - 1) * eased
        el.style.transform = `scale(${scale})`
        el.style.zIndex = Math.round(eased * 100)
        const glow = 0.25 + eased * 0.55 // 0.25 -> 0.8
        const spread = 20 + eased * 40   // 20px -> 60px
        el.style.boxShadow = `0 ${8 + eased * 20}px ${spread}px rgba(0,0,0,${glow})`
      })

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  return (
    <section className="py-24 bg-[#05050A] border-t border-white/5 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-20">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Powered By
          </h2>
          <div className="w-24 h-1.5 bg-gradient-to-r from-orange-500 via-pink-500 to-purple-500 mx-auto rounded-full"></div>
        </div>

        <div
          ref={containerRef}
          className="relative py-6"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          <div
            ref={trackRef}
            className="flex items-center gap-10 will-change-transform"
            style={{ width: 'max-content' }}
          >
            {logos.map((partner, i) => (
              <div
                key={i}
                ref={(el) => (tileRefs.current[i] = el)}
                className="flex-shrink-0 w-44 h-24 flex items-center justify-center
                           bg-white rounded-2xl px-4 py-3
                           border border-white/10
                           shadow-[0_8px_30px_rgba(0,0,0,0.35)]
                           transition-shadow duration-200"
                style={{ transition: 'transform 60ms linear' }}
              >
                <img
                  src={partner.src}
                  alt={partner.alt}
                  className="max-h-full max-w-full w-auto h-auto object-contain"
                  draggable={false}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

export default PoweredBy
