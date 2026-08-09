import { useState, useEffect } from 'react'
import slide1 from '../assets/slide1.png'
import slide2 from '../assets/slide2.png'
import slide3 from '../assets/slide3.png'
import slide4 from '../assets/slide4.png'

const slides = [slide1, slide2, slide3, slide4]

function HeroSlider() {
  const [current, setCurrent] = useState(0)
  const [isViewerOpen, setIsViewerOpen] = useState(false)

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % slides.length)
    }, 5000)
    return () => clearInterval(timer)
  }, [])

  return (
    <>
      <section className="relative w-full pt-16">
        <div className="relative w-full h-[52vh] sm:h-[58vh] md:h-[78vh] lg:h-[85vh] overflow-hidden bg-black">
          
          {/* Sliding Track */}
          <div 
            className="flex h-full transition-transform duration-700 ease-in-out"
            style={{ transform: `translateX(-${current * 100}%)` }}
          >
            {slides.map((slide, index) => (
              <div 
                key={index} 
                className="w-full h-full flex-shrink-0 relative cursor-pointer md:cursor-default"
                onClick={() => {
                  // Only open viewer on mobile
                  if (window.innerWidth < 768) {
                    setIsViewerOpen(true)
                  }
                }}
              >
                <img
                  src={slide}
                  alt={`YZI Works slide ${index + 1}`}
                  className="w-full h-full object-cover object-center"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/40"></div>
                
                {/* Small hint only on mobile */}
                <div className="absolute bottom-14 left-1/2 -translate-x-1/2 md:hidden">
                  <span className="text-[11px] text-white/60 tracking-wide">
                    Tap to view full image
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Indicators */}
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 flex gap-2">
            {slides.map((_, index) => (
              <button
                key={index}
                onClick={(e) => {
                  e.stopPropagation()
                  setCurrent(index)
                }}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  index === current ? 'bg-white w-7' : 'bg-white/50 w-2.5'
                }`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ===== Professional Full Image Viewer (Mobile only) ===== */}
      {isViewerOpen && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4 animate-in fade-in duration-300">
          
          {/* Close / Go Back Button */}
          <button
            onClick={() => setIsViewerOpen(false)}
            className="absolute top-5 right-5 z-20 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md flex items-center justify-center text-white transition"
          >
            ✕
          </button>

          {/* Image */}
          <div className="relative w-full max-w-lg">
            <img
              src={slides[current]}
              alt="Full view"
              className="w-full h-auto max-h-[80vh] object-contain rounded-xl shadow-2xl"
            />
          </div>

          {/* Bottom text */}
          <p className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/50 text-sm">
            Tap ✕ to go back
          </p>
        </div>
      )}
    </>
  )
}

export default HeroSlider