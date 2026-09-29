import { useCallback, useState } from 'react'
import SeraWave from '../SeraWave'
import RoundRail from './RoundRail'
import OfferChip from './OfferChip'
import SeraStatusPill from './SeraStatusPill'
import RoundClock from './RoundClock'
import EndCallDialog from './EndCallDialog'
import OfferPicker from '../offers/OfferPicker'

// Hook turn states → Sera's look. (Hook states are not renamed.)
const STATUS_FOR_TURN = {
  'sera-speaking': 'speaking',
  'your-turn': 'listening',
  'wrapping-up': 'thinking',
}

const GLASS_BUTTON = 'w-14 h-14 rounded-full grid place-items-center border backdrop-blur-[18px] transition'

// The live interview: round rail, chosen-offer chip, Sera's wave, status pill,
// round clock + turn ring, and mute / end controls. Between Screening and the
// HR round (students) the wave shrinks and the offer tiles take over.
function InterviewRoom({
  rounds,
  roundIndex,
  roundSecondsLeft,
  turnState,
  turnElapsed,
  turnSeconds,
  muted,
  offers,
  chosenOffer,
  onChooseOffer,
  onToggleMute,
  onEndCall,
}) {
  const [confirmEnd, setConfirmEnd] = useState(false)
  const keepGoing = useCallback(() => setConfirmEnd(false), []) // stable: the room re-renders every second
  const round = rounds[roundIndex] ?? rounds[0]
  const choosingOffer = round.id === 'offer'
  const status = choosingOffer ? 'paused' : (STATUS_FOR_TURN[turnState] ?? 'thinking')

  return (
    <div className="w-full max-w-5xl flex flex-col items-center gap-5 text-center">
      <RoundRail rounds={rounds} currentIndex={roundIndex} />
      {chosenOffer && <OfferChip offer={chosenOffer} />}

      {/* Sera: full-width wave over a soft radial halo. Shrinks during the offer choice. */}
      <div
        className={`relative w-full transition-[height] duration-700 ease-out motion-reduce:transition-none ${
          choosingOffer ? 'h-[64px]' : 'h-[170px] md:h-[250px]'
        }`}
      >
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(720px,92vw)] h-[140%] rounded-full transition-opacity duration-700 ${
            choosingOffer ? 'opacity-30' : 'opacity-100'
          }`}
          style={{
            background:
              status === 'listening'
                ? 'radial-gradient(closest-side, rgba(34,211,238,0.22), transparent)'
                : 'radial-gradient(closest-side, rgba(139,92,246,0.24), rgba(255,0,138,0.08) 55%, transparent)',
          }}
        />
        <SeraWave state={status} bleed className="w-full h-full" label={`Sera — ${status}`} />
      </div>

      {choosingOffer ? (
        <OfferPicker offers={offers} onChoose={onChooseOffer} />
      ) : (
        <>
          <SeraStatusPill status={status} />
          <RoundClock
            secondsLeft={roundSecondsLeft}
            listening={status === 'listening'}
            turnElapsed={turnElapsed}
            turnSeconds={turnSeconds}
          />
          <div className="mt-1 flex items-center gap-4">
            <button
              type="button"
              onClick={onToggleMute}
              aria-label={muted ? 'Unmute microphone' : 'Mute microphone'}
              aria-pressed={muted}
              className={`${GLASS_BUTTON} ${
                muted
                  ? 'bg-yzi-cyan border-yzi-cyan text-[#05050A] shadow-[0_0_20px_rgba(34,211,238,0.5)]'
                  : 'bg-card/50 light:bg-white/60 border-white/15 light:border-black/10 text-fg hover:border-white/30'
              }`}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z" />
                <path d="M19 11a7 7 0 0 1-14 0M12 18v3" />
                {muted && <path d="M4 4l16 16" />}
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setConfirmEnd(true)}
              aria-label="End interview"
              className={`${GLASS_BUTTON} bg-red-500/85 border-red-400/60 text-white hover:bg-red-500 shadow-[0_0_24px_rgba(239,68,68,0.45)]`}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M4.5 15.5c1-4 5.6-6 7.5-6s6.5 2 7.5 6c.3 1-1 1.5-1.7.9-1.2-1-2.9-1.9-5.8-1.9s-4.6.9-5.8 1.9c-.7.6-2-.1-1.7-.9Z" />
              </svg>
            </button>
          </div>
        </>
      )}

      {confirmEnd && (
        <EndCallDialog
          onKeepGoing={keepGoing}
          onEnd={() => {
            setConfirmEnd(false)
            onEndCall()
          }}
        />
      )}
    </div>
  )
}

export default InterviewRoom
