import { useEffect, useMemo, useState, useCallback, useRef } from 'react'

/**
 * Pulls every image out of src/assets/aboutus/photos/ automatically —
 * add, remove or rename files in that folder and this list updates itself,
 * no import list to maintain by hand.
 */
const photoModules = import.meta.glob(
  '../assets/aboutus/photos/*.{jpg,jpeg,JPG,JPEG,png,PNG,webp,WEBP}',
  { eager: true, import: 'default' }
)

const photos = Object.entries(photoModules)
  .sort(([a], [b]) => {
    const numA = parseInt(a.match(/(\d+)\.[a-zA-Z]+$/)?.[1] ?? '0', 10)
    const numB = parseInt(b.match(/(\d+)\.[a-zA-Z]+$/)?.[1] ?? '0', 10)
    return numA - numB
  })
  .map(([, url]) => url)

const mid = Math.ceil(photos.length / 2)
const rowTop = photos.slice(0, mid)
const rowBottom = photos.slice(mid)

// How long the "spotlight pop" plays before the fullscreen lightbox opens.
const SPOTLIGHT_DELAY_MS = 220

/** Duplicate a row's photos so the CSS marquee can loop seamlessly at -50%. */
function loop(row) {
  return [...row, ...row]
}

function WallRow({ row, direction, baseIndex, spotlightIndex, onTap }) {
  const tiles = loop(row)
  const isAnySpotlit = spotlightIndex !== null

  return (
    <div className={`wall-row overflow-hidden ${isAnySpotlit ? 'wall-row-paused' : ''}`}>
      <div className={`wall-track flex gap-4 md:gap-5 ${direction === 'right' ? 'wall-track-right' : 'wall-track-left'}`}>
        {tiles.map((src, i) => {
          const globalIndex = baseIndex + (i % row.length)
          const isActive = spotlightIndex === globalIndex
          const isDimmed = isAnySpotlit && !isActive

          return (
            <button
              key={i}
              type="button"
              onClick={() => onTap(globalIndex)}
              className={`wall-tile relative flex-shrink-0 rounded-2xl overflow-hidden focus:outline-none ${
                isActive ? 'wall-tile-active' : ''
              } ${isDimmed ? 'wall-tile-dimmed' : ''}`}
            >
              <img
                src={src}
                alt=""
                draggable={false}
                className="h-56 md:h-72 lg:h-80 w-auto max-w-none object-cover"
              />
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Lightbox({ index, onClose, onPrev, onNext }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') onPrev()
      if (e.key === 'ArrowRight') onNext()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, onPrev, onNext])

  return (
    <div
      className="fixed inset-0 z-[120] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4 md:p-10 animate-lightbox-in"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-5 right-5 z-20 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md flex items-center justify-center text-white transition"
      >
        ✕
      </button>

      <button
        onClick={(e) => { e.stopPropagation(); onPrev() }}
        className="absolute left-3 md:left-8 top-1/2 -translate-y-1/2 z-20 w-11 h-11 md:w-12 md:h-12 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md flex items-center justify-center text-white transition text-xl"
      >
        ‹
      </button>

      <button
        onClick={(e) => { e.stopPropagation(); onNext() }}
        className="absolute right-3 md:right-8 top-1/2 -translate-y-1/2 z-20 w-11 h-11 md:w-12 md:h-12 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md flex items-center justify-center text-white transition text-xl"
      >
        ›
      </button>

      <img
        key={index}
        src={photos[index]}
        alt=""
        onClick={(e) => e.stopPropagation()}
        className="max-w-full max-h-[85vh] w-auto h-auto object-contain rounded-xl shadow-2xl animate-lightbox-image"
      />

      <p className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/40 text-xs md:text-sm">
        {index + 1} / {photos.length}
      </p>
    </div>
  )
}

function PhotoWall() {
  // spotlightIndex drives the "pop + dim neighbors" visual on the wall itself.
  // lightboxIndex drives the actual fullscreen viewer. They're separate so a
  // tap plays the spotlight beat first, THEN the lightbox opens on top of it —
  // and on close, both clear together so the wall resets and keeps drifting.
  const [spotlightIndex, setSpotlightIndex] = useState(null)
  const [lightboxIndex, setLightboxIndex] = useState(null)
  const openTimerRef = useRef(null)

  const handleTap = useCallback((i) => {
    setSpotlightIndex(i)
    clearTimeout(openTimerRef.current)
    openTimerRef.current = setTimeout(() => setLightboxIndex(i), SPOTLIGHT_DELAY_MS)
  }, [])

  const closeLightbox = useCallback(() => {
    clearTimeout(openTimerRef.current)
    setLightboxIndex(null)
    setSpotlightIndex(null)
  }, [])

  const goPrev = useCallback(() => {
    setLightboxIndex((i) => {
      const next = (i - 1 + photos.length) % photos.length
      setSpotlightIndex(next)
      return next
    })
  }, [])

  const goNext = useCallback(() => {
    setLightboxIndex((i) => {
      const next = (i + 1) % photos.length
      setSpotlightIndex(next)
      return next
    })
  }, [])

  useEffect(() => () => clearTimeout(openTimerRef.current), [])

  const topBaseIndex = 0
  const bottomBaseIndex = useMemo(() => mid, [])

  if (photos.length === 0) return null

  return (
    <>
      <div className="space-y-4 md:space-y-5">
        <WallRow
          row={rowTop}
          direction="left"
          baseIndex={topBaseIndex}
          spotlightIndex={spotlightIndex}
          onTap={handleTap}
        />
        {rowBottom.length > 0 && (
          <WallRow
            row={rowBottom}
            direction="right"
            baseIndex={bottomBaseIndex}
            spotlightIndex={spotlightIndex}
            onTap={handleTap}
          />
        )}
      </div>

      {lightboxIndex !== null && (
        <Lightbox index={lightboxIndex} onClose={closeLightbox} onPrev={goPrev} onNext={goNext} />
      )}

      <style>{`
        .wall-track {
          width: max-content;
        }
        .wall-track-left {
          animation: wall-scroll-left 55s linear infinite;
        }
        .wall-track-right {
          animation: wall-scroll-right 60s linear infinite;
        }
        @keyframes wall-scroll-left {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        @keyframes wall-scroll-right {
          from { transform: translateX(-50%); }
          to { transform: translateX(0); }
        }
        /* Pauses on mouse hover (desktop) AND while a tile is spotlit
           (tap-driven, works on touch — no reliance on :hover there). */
        .wall-row:hover .wall-track,
        .wall-row-paused .wall-track {
          animation-play-state: paused;
        }

        .wall-tile img {
          transition: transform 0.4s cubic-bezier(0.22, 1, 0.36, 1), filter 0.4s ease;
        }
        .wall-tile:hover img {
          transform: scale(1.06);
        }
        .wall-tile:hover {
          z-index: 10;
        }
        /* Desktop hover spotlight: dim neighbors while hovering (mouse only). */
        .wall-row:has(.wall-tile:hover) .wall-tile:not(:hover) img {
          filter: brightness(0.55) saturate(0.7);
        }

        /* Tap-driven spotlight — works identically on touch and mouse,
           since it's driven by React state rather than :hover. */
        .wall-tile-active {
          z-index: 15;
        }
        .wall-tile-active img {
          transform: scale(1.08);
          filter: brightness(1) saturate(1.05);
        }
        .wall-tile-dimmed img {
          filter: brightness(0.45) saturate(0.6);
        }

        @keyframes lightbox-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-lightbox-in {
          animation: lightbox-fade-in 0.25s ease-out;
        }
        @keyframes lightbox-image-in {
          from { opacity: 0; transform: scale(0.94); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-lightbox-image {
          animation: lightbox-image-in 0.35s cubic-bezier(0.22, 1, 0.36, 1);
        }

        @media (prefers-reduced-motion: reduce) {
          .wall-track-left,
          .wall-track-right {
            animation: none;
          }
        }
      `}</style>
    </>
  )
}

export default PhotoWall
