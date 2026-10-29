import { Link } from 'react-router-dom'
import SeraWave from './SeraWave'
import GlassCard from './glass/GlassCard'

function SeraBlockedScreen({ message }) {
  return (
    <div className="w-full flex flex-col items-center text-center">
      <SeraWave state="disabled" bleed className="w-full h-[120px] md:h-[160px] mb-6" label="Sera — already done" />

      <GlassCard>
        <h2 className="text-2xl font-bold text-fg">Already done!</h2>
        <p className="mt-2 text-sm text-fg/65 leading-relaxed">
          {message || "You've already completed your interview with Sera — thanks for stopping by!"}
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex w-full h-[50px] items-center justify-center rounded-full border border-fg/15 bg-fg/5 light:bg-white/60 text-fg font-semibold hover:bg-fg/10 transition"
        >
          Back to YZI Works
        </Link>
      </GlassCard>
    </div>
  )
}

export default SeraBlockedScreen
