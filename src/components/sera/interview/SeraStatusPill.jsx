// Glass pill with a blinking LED saying who has the floor. `name` is the
// current round's interviewer (Sera / Vinit / Arvind, from seraRounds.js).
// status: 'speaking' | 'listening' | 'thinking' | 'paused'
const STATUS = {
  speaking: { text: (n) => `${n} is speaking`, led: 'bg-yzi-pink shadow-[0_0_10px_rgba(255,0,138,0.8)]', blink: 'sera-led-fast' },
  listening: { text: (n) => `Your turn · ${n} is listening`, led: 'bg-yzi-cyan shadow-[0_0_10px_rgba(34,211,238,0.8)]', blink: 'sera-led-slow' },
  thinking: { text: (n) => `${n} is analysing`, led: 'bg-yzi-orange shadow-[0_0_10px_rgba(255,94,0,0.8)]', blink: 'sera-led-quick' },
  paused: { text: () => 'Paused · choose your offer', led: 'bg-fg/40', blink: '' },
}

function SeraStatusPill({ status, name = 'Sera' }) {
  const s = STATUS[status] ?? STATUS.thinking
  return (
    <div
      role="status"
      aria-live="polite"
      className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full border border-white/10 light:border-white/80 bg-card/50 light:bg-white/60 backdrop-blur-[18px] text-sm font-medium text-fg"
    >
      <span className={`w-2.5 h-2.5 rounded-full ${s.led} ${s.blink}`} aria-hidden="true" />
      {s.text(name)}
      <style>{`
        .sera-led-fast  { animation: sera-led 0.6s ease-in-out infinite; }
        .sera-led-quick { animation: sera-led 0.9s steps(2, jump-none) infinite; }
        .sera-led-slow  { animation: sera-led 1.8s ease-in-out infinite; }
        @keyframes sera-led { 0%, 100% { opacity: 1; } 50% { opacity: 0.25; } }
        @media (prefers-reduced-motion: reduce) {
          .sera-led-fast, .sera-led-quick, .sera-led-slow { animation: none; }
        }
      `}</style>
    </div>
  )
}

export default SeraStatusPill
