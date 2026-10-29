import GlassBlobs from '../login/GlassBlobs'

// Frosted glass card over the blurred brand blobs — the look shared by the
// Sera login, upload and pay screens.
function GlassCard({ className = 'max-w-[420px]', children }) {
  return (
    <div className={`relative w-full ${className}`}>
      <GlassBlobs />
      <div className="relative rounded-[26px] border border-white/10 light:border-white/80 bg-card/55 light:bg-white/55 backdrop-blur-[22px] shadow-[0_24px_60px_rgba(0,0,0,0.45)] light:shadow-[0_24px_60px_rgba(76,29,149,0.14)] p-6 sm:p-8">
        {children}
      </div>
    </div>
  )
}

export default GlassCard
