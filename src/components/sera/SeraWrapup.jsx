import SeraOrb from './SeraOrb'

function SeraWrapup({ profile }) {
  const firstName = profile?.name?.split(' ')[0] || ''

  return (
    <div className="flex flex-col items-center text-center">
      <SeraOrb state="thinking" size={160} className="mb-6" />
      <h2 className="text-2xl font-bold text-white mb-2">
        Thank you{firstName ? `, ${firstName}` : ''} — that's everything I need.
      </h2>
      <p className="text-white/60 text-sm">Preparing your report…</p>
    </div>
  )
}

export default SeraWrapup
