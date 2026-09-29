import { useState } from 'react'
import OfferTile from './OfferTile'

const COLORS = ['#22D3EE', '#FF008A', '#8B5CF6'] // cyan / pink / purple edges
const STAGGER_MS = 120
const CHOSEN_HOLD_MS = 450 // chosen tile glows, others fade
const LEAVE_MS = 350 // then all tiles leave

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

// Shown between Screening and the HR round (students). The clock is paused;
// onChoose(offer) fires after the exit animation.
function OfferPicker({ offers, onChoose }) {
  const [chosenId, setChosenId] = useState(null)
  const [leaving, setLeaving] = useState(false)

  const choose = (offer) => {
    if (chosenId) return
    setChosenId(offer.id)
    if (prefersReducedMotion()) {
      onChoose(offer)
      return
    }
    setTimeout(() => setLeaving(true), CHOSEN_HOLD_MS)
    setTimeout(() => onChoose(offer), CHOSEN_HOLD_MS + LEAVE_MS)
  }

  return (
    <div className={`w-full max-w-5xl flex flex-col items-center text-center transition-opacity duration-300 ${leaving ? 'opacity-0' : ''}`}>
      <h2 className="text-2xl sm:text-3xl font-bold text-fg max-w-2xl">
        You cleared screening. Pick the offer you want to interview for.
      </h2>
      <p className="mt-2 text-sm sm:text-base text-fg/65 max-w-xl">
        Sera built these three from your résumé. Your next two rounds are for the one you choose.
      </p>
      <p className="mt-1.5 text-xs text-fg/45">Take your time. The clock is paused while you choose.</p>

      {offers ? (
        <div className="mt-8 w-full grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
          {offers.slice(0, 3).map((offer, i) => (
            <OfferTile
              key={offer.id}
              offer={offer}
              color={COLORS[i % COLORS.length]}
              delayMs={i * STAGGER_MS}
              state={!chosenId ? 'idle' : chosenId === offer.id ? 'chosen' : 'faded'}
              onChoose={choose}
            />
          ))}
        </div>
      ) : (
        <p className="mt-8 text-sm text-fg/50">Getting your offers ready…</p>
      )}

      <style>{`
        .sera-tile {
          border: 1px solid color-mix(in srgb, var(--tile) 45%, transparent);
          box-shadow: 0 0 18px color-mix(in srgb, var(--tile) 18%, transparent), 0 18px 40px rgba(0,0,0,0.3);
          transition: transform 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease, opacity 0.3s ease;
        }
        .sera-tile:not(:disabled):hover, .sera-tile:not(:disabled):focus-visible {
          transform: translateY(-6px);
          border-color: var(--tile);
          box-shadow: 0 0 32px color-mix(in srgb, var(--tile) 50%, transparent), 0 24px 50px rgba(0,0,0,0.35);
        }
        .sera-tile-bar {
          background: linear-gradient(var(--tile), var(--tile)) no-repeat left / 0% 100%;
          transition: background-size 0.35s ease, color 0.35s ease, border-color 0.35s ease;
        }
        .sera-tile:not(:disabled):hover .sera-tile-bar, .sera-tile:not(:disabled):focus-visible .sera-tile-bar {
          background-size: 100% 100%;
          border-color: var(--tile);
          color: #fff;
        }
        .sera-tile-chosen {
          transform: scale(1.04);
          border-color: var(--tile);
          box-shadow: 0 0 48px color-mix(in srgb, var(--tile) 70%, transparent), 0 24px 50px rgba(0,0,0,0.4);
        }
        .sera-tile-faded { opacity: 0; transform: scale(0.96); }
        .sera-tile-rise { animation: sera-tile-rise 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) backwards; }
        @keyframes sera-tile-rise {
          from { opacity: 0; transform: translateY(36px); }
          to   { opacity: 1; transform: none; }
        }
        @media (prefers-reduced-motion: reduce) {
          .sera-tile, .sera-tile-bar { transition: none; }
          .sera-tile-rise { animation: none; }
          .sera-tile:not(:disabled):hover, .sera-tile:not(:disabled):focus-visible { transform: none; }
        }
      `}</style>
    </div>
  )
}

export default OfferPicker
