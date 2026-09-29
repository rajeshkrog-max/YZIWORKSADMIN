// DEV ONLY — floating panel (bottom-right) for mock mode: drive the simulated
// call and arm the next mock payment's outcome. Mounted only when
// import.meta.env.DEV && mock mode, so it never ships.
import { useState, useSyncExternalStore } from 'react'
import { getDevState, setDev, subscribeDev } from '../../../services/seraMockCall'

function DevButton({ onClick, disabled, active, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full text-left px-2.5 py-1.5 rounded-md border transition disabled:opacity-35 disabled:cursor-not-allowed ${
        active ? 'border-amber-300 bg-amber-300/20 text-amber-100' : 'border-white/15 hover:bg-white/10'
      }`}
    >
      {children}
    </button>
  )
}

function SeraDevPanel() {
  const { call, payOutcome } = useSyncExternalStore(subscribeDev, getDevState)
  // Starts collapsed on phones so it doesn't cover the screen being tested.
  const [open, setOpen] = useState(() => window.innerWidth >= 640)

  return (
    <div className="fixed bottom-4 right-4 z-[250] w-56 rounded-xl border border-amber-400/60 bg-black/85 text-white text-xs shadow-2xl backdrop-blur-md">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 font-bold text-amber-300"
      >
        DEV · mock mode <span className="text-white/60">{open ? '–' : '+'}</span>
      </button>
      {open && (
        <div className="px-3 pb-3 flex flex-col gap-1.5">
          <p className="text-white/50 mt-1">Call {call ? '(live)' : '(no call)'}</p>
          <DevButton disabled={!call} onClick={() => call?.skipToLast30()}>Skip to last 30s</DevButton>
          <DevButton disabled={!call} onClick={() => call?.skipToEndOfRound()}>Skip to end of round</DevButton>
          <DevButton disabled={!call?.jumpToOffers} onClick={() => call?.jumpToOffers()}>Jump to offers</DevButton>
          <DevButton disabled={!call} onClick={() => call?.endNow()}>End call now</DevButton>
          <DevButton disabled={!call} onClick={() => call?.drop()}>Simulate dropped call</DevButton>
          <p className="text-white/50 mt-2">Next “Pay” click</p>
          <DevButton
            active={payOutcome === 'fail'}
            onClick={() => setDev({ payOutcome: payOutcome === 'fail' ? 'success' : 'fail' })}
          >
            Simulate payment failure
          </DevButton>
          <DevButton
            active={payOutcome === 'close'}
            onClick={() => setDev({ payOutcome: payOutcome === 'close' ? 'success' : 'close' })}
          >
            Simulate payment closed
          </DevButton>
        </div>
      )}
    </div>
  )
}

export default SeraDevPanel
