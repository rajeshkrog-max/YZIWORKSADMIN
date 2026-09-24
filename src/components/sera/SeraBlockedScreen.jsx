import { Link } from 'react-router-dom'
import SeraOrb from './SeraOrb'

function SeraBlockedScreen({ message }) {
  return (
    <div className="flex flex-col items-center text-center max-w-sm mx-auto">
      <SeraOrb state="disabled" size={140} className="mb-6" />
      <h2 className="text-2xl font-bold text-fg mb-3">Already done!</h2>
      <p className="text-fg/60 text-sm leading-relaxed mb-8">
        {message || "You've already completed your interview with Sera — thanks for stopping by!"}
      </p>
      <Link
        to="/"
        className="px-6 py-3 rounded-full border border-fg/20 text-fg text-sm font-medium hover:bg-fg/10 transition"
      >
        Back to YZI Works
      </Link>
    </div>
  )
}

export default SeraBlockedScreen
