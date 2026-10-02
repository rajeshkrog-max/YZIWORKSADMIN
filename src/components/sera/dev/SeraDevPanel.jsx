// DEV ONLY — floating panel (bottom-right) for mock mode: drive the simulated
// call and fast-forward through all interview stages. Mounted only when
// import.meta.env.DEV && mock mode, so it never ships to production.
import { useState, useSyncExternalStore } from 'react'
import { useNavigate } from 'react-router-dom'
import { MOCK_REJOIN_CODE, MOCK_REJOIN_TOKEN, getDevState, setDev, subscribeDev } from '../../../services/seraMockCall'

function DevButton({ onClick, disabled, active, variant = 'default', children }) {
  const variantStyles = {
    default: active
      ? 'border-amber-300 bg-amber-300/20 text-amber-100 font-medium'
      : 'border-white/15 bg-white/5 hover:bg-white/10 text-white/90',
    primary: 'border-emerald-400/50 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 font-semibold',
    accent: 'border-cyan-400/50 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200 font-semibold',
    warn: 'border-red-400/40 bg-red-500/15 hover:bg-red-500/25 text-red-200',
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full text-left px-2.5 py-1.5 rounded-lg border transition text-[11px] disabled:opacity-30 disabled:cursor-not-allowed ${
        variantStyles[variant] || variantStyles.default
      }`}
    >
      {children}
    </button>
  )
}

function SeraDevPanel() {
  const { call, payOutcome, skipWrapupDelay, ui } = useSyncExternalStore(subscribeDev, getDevState)
  const navigate = useNavigate()
  const [open, setOpen] = useState(() => window.innerWidth >= 640)

  const screen = ui?.screen || 'idle'
  const inCall = !!call
  const roundName =
    call?.roundName ||
    ui?.roundName ||
    (call?.roundIndex === 0
      ? 'Screening (Sera)'
      : call?.roundIndex === 2
        ? 'HR Round (Vinit)'
        : call?.roundIndex === 3
          ? 'Final Round (Arvind)'
          : null)

  return (
    <div className="fixed bottom-4 right-4 z-[250] w-64 rounded-xl border border-amber-400/60 bg-black/90 text-white text-xs shadow-2xl backdrop-blur-md overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-amber-400/10 border-b border-amber-400/30">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex-1 flex items-center justify-between font-bold text-amber-300 text-left"
        >
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            DEV CONTROLS
          </span>
          <span className="text-white/60 font-mono">{open ? '–' : '+'}</span>
        </button>
      </div>

      {open && (
        <div className="p-3 flex flex-col gap-2 max-h-[75vh] overflow-y-auto">
          {/* Status bar */}
          <div className="px-2 py-1.5 rounded-md bg-white/5 border border-white/10 flex flex-col gap-0.5">
            <div className="flex justify-between text-[10px] text-white/50">
              <span>
                Screen: <strong className="text-amber-300 font-semibold">{screen}</strong>
              </span>
              <span>{inCall ? '📞 Live Call' : 'Idle'}</span>
            </div>
            {roundName && <div className="text-[11px] text-cyan-300 font-medium truncate">{roundName}</div>}
          </div>

          {/* Quick Flow Navigator */}
          <div className="flex flex-col gap-1">
            <p className="text-[10px] uppercase font-bold text-amber-300/80 tracking-wider">Fast Forward / Jump</p>

            {/* If in call: instantaneous advancement */}
            {inCall && (
              <>
                <DevButton variant="primary" onClick={() => call?.finishRoundNow?.() || call?.skipToEndOfRound?.()}>
                  ⏭ Finish Round Now (Next)
                </DevButton>
                {call?.jumpToOffers && (
                  <DevButton variant="accent" onClick={() => call?.jumpToOffers?.()}>
                    🎯 Jump to Job Offers
                  </DevButton>
                )}
                {call?.roundIndex < 2 && (
                  <DevButton onClick={() => call?.jumpToRound?.(2)}>
                    👔 Jump to HR Round (Vinit)
                  </DevButton>
                )}
                {call?.roundIndex < 3 && (
                  <DevButton onClick={() => call?.jumpToRound?.(3)}>
                    👑 Jump to Final Round (Arvind)
                  </DevButton>
                )}
                <DevButton variant="accent" onClick={() => call?.jumpToReport?.() || ui?.skipToReport?.()}>
                  📊 Jump to Report Now
                </DevButton>
              </>
            )}

            {/* If on offer picker */}
            {ui?.roundId === 'offer' && (
              <DevButton variant="primary" onClick={() => ui?.autoPickOffer?.()}>
                👉 Select 1st Offer & Start HR
              </DevButton>
            )}

            {/* If on Login or Hero */}
            {(screen === 'hero' || screen === 'signin') && (
              <>
                <DevButton variant="primary" onClick={() => ui?.quickLoginStudent?.()}>
                  ⚡ Quick Login (Student)
                </DevButton>
                <DevButton onClick={() => ui?.quickLoginVisitor?.()}>
                  ⚡ Quick Login (Visitor)
                </DevButton>
              </>
            )}

            {/* If on Upload */}
            {screen === 'upload' && (
              <DevButton variant="primary" onClick={() => ui?.autoUploadAndBegin?.()}>
                📄 Auto-Attach Resume & Start
              </DevButton>
            )}

            {/* If not in call but want to test report immediately */}
            {!inCall && screen !== 'report' && (
              <DevButton onClick={() => ui?.skipToReport?.()}>
                📊 Jump Straight to Final Report
              </DevButton>
            )}

            {/* If on Report */}
            {screen === 'report' && (
              <DevButton variant="accent" onClick={() => ui?.resetInterview?.()}>
                🔄 Reset & Start Over
              </DevButton>
            )}
          </div>

          {/* Call Options */}
          {inCall && (
            <div className="flex flex-col gap-1 pt-1 border-t border-white/10">
              <p className="text-[10px] uppercase font-bold text-white/50 tracking-wider">Call Controls</p>
              <DevButton onClick={() => call?.skipToLast30?.()}>
                ⏳ Fast-forward to last 30s
              </DevButton>
              <DevButton variant="warn" onClick={() => call?.endNow?.()}>
                🛑 Candidate ends interview early
              </DevButton>
              <DevButton variant="warn" onClick={() => call?.drop?.()}>
                ⚡ Simulate dropped call
              </DevButton>
            </div>
          )}

          {/* Preferences / Toggles */}
          <div className="flex flex-col gap-1 pt-1 border-t border-white/10">
            <p className="text-[10px] uppercase font-bold text-white/50 tracking-wider">Settings</p>
            <DevButton
              active={skipWrapupDelay}
              onClick={() => setDev({ skipWrapupDelay: !skipWrapupDelay })}
            >
              {skipWrapupDelay ? '⚡ Instant Report (0s wait)' : '⏱ Standard Wrapup (7s wait)'}
            </DevButton>
          </div>

          {/* Rejoin / Payments */}
          <div className="flex flex-col gap-1 pt-1 border-t border-white/10">
            <p className="text-[10px] uppercase font-bold text-white/50 tracking-wider">Simulate Rejoin / Pay</p>
            <DevButton onClick={() => navigate(`/meet-sera?rejoin=${MOCK_REJOIN_TOKEN}`)}>
              🔗 Visitor Rejoin Link
            </DevButton>
            <DevButton onClick={() => navigate(`/meet-sera?rejoincode=${MOCK_REJOIN_CODE}`)}>
              🎓 Student Rejoin Code
            </DevButton>
            <DevButton
              active={payOutcome === 'fail'}
              onClick={() => setDev({ payOutcome: payOutcome === 'fail' ? 'success' : 'fail' })}
            >
              Simulate payment failure
            </DevButton>
          </div>
        </div>
      )}
    </div>
  )
}

export default SeraDevPanel
