import { useState, useEffect, useRef } from 'react'
import { useTheme } from '../theme/useTheme'
import slide1 from '../assets/slide1.png'
import slide2 from '../assets/slide2.png'
import slide3 from '../assets/slide3.png'
import slide4 from '../assets/slide4.png'
import slideLight1 from '../assets/slides-light/slide1.png'
import slideLight2 from '../assets/slides-light/slide2.png'
import slideLight3 from '../assets/slides-light/slide3.png'
import slideLight4 from '../assets/slides-light/slide4.png'

// Same index = same slide in both themes. Pairs share dimensions
// (slide1 1810×869, slides 2–4 1915×821), so layout never shifts.
const HOME_DARK_SLIDES = [slide1, slide2, slide3, slide4]
const HOME_LIGHT_SLIDES = [slideLight1, slideLight2, slideLight3, slideLight4]
const SWIPE_THRESHOLD = 45 // px — how far a touch must move to count as a swipe, not a tap
const AUTOPLAY_MS = 3500   // desktop-only autoplay speed

// Home and Meet Sera share this slider (same frame, height, dots, autoplay,
// swipe and full-screen viewer); only the slide sets differ.
// Pass darkSlides/lightSlides as module-level arrays so they stay stable.
function HeroSlider({
  darkSlides = HOME_DARK_SLIDES,
  lightSlides = HOME_LIGHT_SLIDES,
  altLabel = 'YZI Works slide',
}) {
  const { isDark } = useTheme()
  const slides = isDark ? darkSlides : lightSlides
  const slideCount = darkSlides.length
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
      setCurrent((prev) => (prev + 1) % slideCount)
    }, AUTOPLAY_MS)
    return () => clearInterval(timer)
  }, [isDesktop, slideCount])

  // Warm the other theme's slides so a switch is instant. Skipped on Data Saver.
  useEffect(() => {
    if (navigator.connection?.saveData) return
    const inactive = isDark ? lightSlides : darkSlides
    const run = () => inactive.forEach((src) => { new Image().src = src })
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(run)
      return () => window.cancelIdleCallback(id)
    }
    const id = setTimeout(run, 2000)
    return () => clearTimeout(id)
  }, [isDark, darkSlides, lightSlides])

  const goTo = (index) => setCurrent(((index % slideCount) + slideCount) % slideCount)
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
      <section className="relative w-full pt-[108px] md:pt-[112px]">
        <div
          className="relative w-full overflow-hidden bg-pure
                     aspect-[3/2] md:aspect-auto md:h-[78vh] lg:h-[85vh]"
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
                  Mobile: object-cover can ONLY crop left-right on a banner
                  this wide (it always shows full height, math guarantees it)
                  — that's why the badge row kept bleeding in. So on mobile
                  the image is instead absolutely positioned and manually
                  scaled to 228% width, pinned top-left. That crops BOTH the
                  right side (photo) AND the bottom (badges row), leaving just
                  the badge/headline/subtext block, nice and large.
                  Desktop resets to your original static full-bleed object-cover.
                */}
                <img
                  src={slide}
                  alt={`${altLabel} ${index + 1}`}
                  className="absolute top-0 left-0 w-[228%] h-auto max-w-none
                             md:static md:w-full md:h-full md:max-w-full md:object-contain md:object-center"
                />
                {/* Dark slides only — on the light set any dark wash greys out the artwork */}
                {isDark && (
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/30 md:to-black/40 pointer-events-none"></div>
                )}

                {/* Small hint only on mobile */}
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 md:hidden pointer-events-none">
                  <span className="text-[11px] text-white/70 tracking-wide bg-black/40 px-3 py-1 rounded-full">
                    Swipe or tap to view full image
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Indicators */}
          <div className="absolute bottom-1 md:bottom-5 left-1/2 -translate-x-1/2 z-20 flex gap-2">
            {slides.map((_, index) => (
              <button
                key={index}
                aria-label={`Go to slide ${index + 1}`}
                onClick={(e) => {
                  e.stopPropagation()
                  goTo(index)
                }}
                // after: pseudo-element widens the tap target without changing the look
                className={`relative h-1.5 rounded-full transition-all duration-300 after:absolute after:-inset-x-1 after:-inset-y-3 ${
                  index === current ? 'bg-fg w-7' : 'bg-fg/50 w-2.5'
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
