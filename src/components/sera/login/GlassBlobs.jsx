// Large blurred brand-colour blobs behind the login card, so its frosted glass
// has something to blur. Horizontally they stay inside the card's box (the blur
// spills past it as paint only), so they never widen the page on mobile.
const BLOBS = [
  { color: '#22D3EE', className: 'top-[-6%] left-0 w-[58%]', delay: '0s' },
  { color: '#FF008A', className: 'top-[18%] right-[3%] w-[52%]', delay: '-4s' },
  { color: '#8B5CF6', className: 'bottom-[4%] left-[6%] w-[60%]', delay: '-8s' },
  { color: '#FF5E00', className: 'bottom-[-8%] right-[6%] w-[40%]', delay: '-12s' },
]

function GlassBlobs() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      {BLOBS.map((blob) => (
        <span
          key={blob.color}
          className={`sera-blob absolute aspect-square rounded-full opacity-55 light:opacity-35 ${blob.className}`}
          style={{ background: blob.color, filter: 'blur(60px)', animationDelay: blob.delay }}
        />
      ))}
      <style>{`
        .sera-blob { animation: sera-blob-drift 16s ease-in-out infinite alternate; }
        @keyframes sera-blob-drift {
          0%   { transform: translate(0, 0) scale(1); }
          50%  { transform: translate(4%, -5%) scale(1.04); }
          100% { transform: translate(-4%, 4%) scale(0.96); }
        }
        @media (prefers-reduced-motion: reduce) {
          .sera-blob { animation: none; }
        }
      `}</style>
    </div>
  )
}

export default GlassBlobs
