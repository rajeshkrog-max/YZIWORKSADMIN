import { useState, useEffect, useRef } from 'react'
import slide1 from '../assets/slide1.png'
import slide2 from '../assets/slide2.png'
import slide3 from '../assets/slide3.png'
import slide4 from '../assets/slide4.png'

const slides = [slide1, slide2, slide3, slide4]
const SWIPE_THRESHOLD = 45 // px — how far a touch must move to count as a swipe, not a tap
const AUTOPLAY_MS = 3500   // desktop-only autoplay speed

function HeroSlider() {
  const [current, setCurrent] = useState(0)
  const [isViewerOpen, setIsViewerOpen] = useState(false)
  const [isDesktop, setIsDesktop] = useState(
    typeof window !== 'undefined' ? window.innerWidth >= 768 : true
  )

  const touchStartX = useRef(0)
  const touchStartY = useRef(0)
  const didSwipe = useRef(false)

  useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth >= 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Autoplay — desktop only
  useEffect(() => {
    if (!isDesktop) return
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % slides.length)
    }, AUTOPLAY_MS)
    return () => clearInterval(timer)
  }, [isDesktop])

  const goTo = (index) => setCurrent(((index % slides.length) + slides.length) % slides.length)
  const goNext = () => goTo(current + 1)
  const goPrev = () => goTo(current - 1)

  const handleTouchStart = (e) => {
    didSwipe.current = false
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }

  const handleTouchEnd = (e) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current
    const dy = e.changedTouches[0].clientY - touchStartY.current

    if (Math.abs(dx) < Math.abs(dy)) return // vertical scroll, not a swipe

    if (Math.abs(dx) > SWIPE_THRESHOLD) {
      didSwipe.current = true
      if (dx < 0) goNext()
      else goPrev()
    }
  }

  const handleSlideClick = () => {
    if (didSwipe.current) {
      didSwipe.current = false
      return
    }
    if (window.innerWidth < 768) {
      setIsViewerOpen(true)
    }
  }

  return (
    <>
      {/*
        No top padding here anymore — that "pt-16" was fighting your fixed
        header's real height on small screens and letting the slider slide
        under the nav. Give the <header> itself a fixed height class (e.g.
        h-16) and this section a matching margin instead, OR make the header
        non-fixed. If your header IS fixed/sticky, replace pt-16 below with
        whatever its real rendered height is on mobile.
      */}
      <section className="relative w-full">
        <div
          className="relative w-full overflow-hidden bg-black
                     aspect-[21/9] md:aspect-auto md:h-[78vh] lg:h-[85vh]"
        >
          {/* Sliding Track */}
          <div
            className="flex h-full transition-transform duration-700 ease-in-out"
            style={{ transform: `translateX(-${current * 100}%)` }}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {slides.map((slide, index) => (
              <div
                key={index}
                className="w-full h-full flex-shrink-0 relative cursor-pointer md:cursor-default"
                onClick={handleSlideClick}
              >
                {/*
                  All 4 slides are the exact same 1915x821 (21:9) image, so the
                  outer box above is locked to aspect-[21/9] on mobile — the
                  image fills it edge-to-edge with zero cropping AND zero
                  height jump between slides. Desktop keeps your original
                  full-bleed h-[78vh]/h-[85vh] + object-cover look.
                */}
                <img
                  src={slide}
                  alt={`YZI Works slide ${index + 1}`}
                  className="w-full h-full object-cover object-center block"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/40 pointer-events-none"></div>

                {/* Small hint only on mobile */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 md:hidden pointer-events-none">
                  <span className="text-[11px] text-white/70 tracking-wide bg-black/30 px-3 py-1 rounded-full">
                    Swipe or tap to view
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Indicators */}
          <div className="absolute bottom-2 md:bottom-5 left-1/2 -translate-x-1/2 z-20 flex gap-2">
            {slides.map((_, index) => (
              <button
                key={index}
                onClick={(e) => {
                  e.stopPropagation()
                  goTo(index)
                }}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  index === current ? 'bg-white w-7' : 'bg-white/50 w-2.5'
                }`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ===== Full Image Viewer (Mobile only) ===== */}
      {isViewerOpen && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <button
            onClick={() => setIsViewerOpen(false)}
            className="absolute top-5 right-5 z-20 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md flex items-center justify-center text-white transition"
          >
            ✕
          </button>

          <div className="relative w-full max-w-lg">
            <img
              src={slides[current]}
              alt="Full view"
              className="w-full h-auto max-h-[80vh] object-contain rounded-xl shadow-2xl"
            />
          </div>

          <p className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/50 text-sm">
            Tap ✕ to go back
          </p>
        </div>
      )}
    </>
  )
}

export default HeroSlider
