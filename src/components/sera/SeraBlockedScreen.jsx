import { Link } from 'react-router-dom'
import SeraOrb from './SeraOrb'

function SeraBlockedScreen({ message }) {
  return (
    <div className="flex flex-col items-center text-center max-w-sm mx-auto">
      <SeraOrb state="disabled" size={140} className="mb-6" />
      <h2 className="text-2xl font-bold text-white mb-3">Already done!</h2>
      <p className="text-white/60 text-sm leading-relaxed mb-8">
        {message || "You've already completed your interview with Sera — thanks for stopping by!"}
      </p>
      <Link
        to="/"
        className="px-6 py-3 rounded-full border border-white/20 text-white text-sm font-medium hover:bg-white/10 transition"
      >
        Back to YZI Works
      </Link>
    </div>
  )
}

export default SeraBlockedScreen
