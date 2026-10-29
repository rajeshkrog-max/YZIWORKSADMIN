import { Link } from 'react-router-dom'
import SeraWave from './SeraWave'
import GlassCard from './glass/GlassCard'

// "9876543210" → "+91 •••••43210"
const maskPhone = (phone) => (phone ? `+91 •••••${String(phone).slice(-5)}` : 'your WhatsApp number')

// The call dropped without the candidate pressing End. The interview is saved;
// the continue link/code arrives on WhatsApp. No retry button on purpose.
// rejoinIssued=false (already rejoined once) → the team follows up instead.
function SeraConnectionLost({ session, rejoinIssued = true }) {
  const student = session?.route === 'student'
  const phone = maskPhone(session?.phone)

  return (
    <div className="w-full flex flex-col items-center text-center">
      <SeraWave state="disabled" bleed className="w-full h-[120px] md:h-[160px] mb-6" label="Connection lost" />

      <GlassCard>
        <h2 className="text-2xl font-bold text-fg">We lost the connection.</h2>
        <p className="mt-2 text-sm text-fg/65 leading-relaxed">
          {!rejoinIssued
            ? "Your interview is saved. Our team has been notified and will contact you about next steps."
            : student
              ? `Your interview is saved. We'll send a new code to continue on WhatsApp to ${phone}.`
              : `Your interview is saved. We'll send a link to continue on WhatsApp to ${phone}. You won't be charged again.`}
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

export default SeraConnectionLost
