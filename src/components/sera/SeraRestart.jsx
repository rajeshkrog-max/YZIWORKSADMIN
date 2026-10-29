import SeraWave from './SeraWave'
import GlassCard from './glass/GlassCard'

// The call was lost before the offers (a network drop, a refresh, a closed tab). The server keeps the
// interview and allows ONE free restart from Sera: no new payment, no new seat, same résumé and offers
// (spec 0002). A second loss is reported on what was said instead, so this screen appears at most once.
function SeraRestart({ onRestart, busy, error }) {
  return (
    <div className="w-full flex flex-col items-center text-center">
      <SeraWave state="disabled" bleed className="w-full h-[120px] md:h-[160px] mb-6" label="Connection lost" />

      <GlassCard>
        <h2 className="text-2xl font-bold text-fg">We lost the connection.</h2>
        <p className="mt-2 text-sm text-fg/65 leading-relaxed">
          The call dropped before your interview got going, so it doesn&apos;t count. You can start again
          once, from the beginning, free. Your résumé and offers are saved.
        </p>
        <p className="mt-3 text-xs text-fg/50 leading-relaxed">
          Before you restart: use a steady connection, keep this tab open, and allow the microphone.
        </p>

        {error && <p className="mt-3 text-xs text-red-400 light:text-red-600">{error}</p>}

        <button
          type="button"
          onClick={() => onRestart()}
          disabled={busy}
          className="mt-6 w-full h-[50px] rounded-full bg-gradient-to-r from-yzi-orange via-yzi-pink to-yzi-purple text-white font-semibold transition hover:brightness-110 disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:brightness-100"
        >
          {busy ? 'Connecting…' : 'Restart my interview'}
        </button>
      </GlassCard>
    </div>
  )
}

export default SeraRestart
