import SeraOrb from './SeraOrb'

function formatSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const TIER_META = [
  { label: 'Where you are', accent: 'text-yzi-orange', dot: 'bg-yzi-orange' },
  { label: 'Next step', accent: 'text-yzi-pink', dot: 'bg-yzi-pink' },
  { label: 'Where this goes', accent: 'text-yzi-purple', dot: 'bg-yzi-purple' },
]

function SeraReport({ profile, resumeMeta, report, incomplete, error, onDone }) {
  const firstName = profile?.name?.split(' ')[0] || ''

  if (incomplete) {
    return (
      <div className="flex flex-col items-center text-center max-w-sm mx-auto">
        <SeraOrb state="error" size={140} className="mb-6" />
        <h2 className="text-2xl font-bold text-white mb-3">Interview ended early</h2>
        <p className="text-white/60 text-sm leading-relaxed mb-8">
          Looks like the interview ended early — no worries, we'll get you scheduled for another session soon.
        </p>
        <button
          onClick={onDone}
          className="px-6 py-3 rounded-full border border-white/20 text-white text-sm font-medium hover:bg-white/10 transition"
        >
          Back to YZI Works
        </button>
      </div>
    )
  }

  if (!report) {
    return (
      <div className="flex flex-col items-center text-center max-w-sm mx-auto">
        <SeraOrb state="error" size={140} className="mb-6" />
        <h2 className="text-2xl font-bold text-white mb-3">Your report hit a snag</h2>
        <p className="text-white/60 text-sm leading-relaxed mb-8">
          {error || 'Something went wrong preparing your report — our team still received your interview.'}
        </p>
        <button
          onClick={onDone}
          className="px-6 py-3 rounded-full border border-white/20 text-white text-sm font-medium hover:bg-white/10 transition"
        >
          Back to YZI Works
        </button>
      </div>
    )
  }

  return (
    <div className="w-full max-w-4xl mx-auto text-left">
      <div className="flex items-center gap-4 mb-8">
        <SeraOrb state="disabled" size={48} />
        <div>
          <span className="text-xs font-medium tracking-widest uppercase text-yzi-cyan block mb-1">
            Sera's assessment
          </span>
          <h2 className="text-2xl md:text-3xl font-bold text-white">
            Your reading{firstName ? `, ${firstName}` : ''}.
          </h2>
          <p className="text-white/50 text-sm mt-1">Private to you — a copy has also been sent to the YZI team.</p>
        </div>
      </div>

      <div className="grid md:grid-cols-[0.85fr_1.15fr] gap-5">
        <div className="bg-yzi-card/60 border border-white/10 rounded-2xl p-6">
          <h3 className="text-[11px] font-mono uppercase tracking-wide text-white/40 mb-4">Résumé</h3>
          {resumeMeta && (
            <div className="flex items-center gap-3 pb-4 mb-4 border-b border-white/10">
              <svg className="w-7 h-7 text-yzi-pink flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
                <path d="M6 2h9l5 5v15H6z" />
                <path d="M14 2v6h6" />
              </svg>
              <div>
                <div className="text-sm font-medium text-white truncate">{resumeMeta.originalFilename}</div>
                <div className="text-xs text-white/40 font-mono">{formatSize(resumeMeta.size)}</div>
              </div>
            </div>
          )}
        </div>

        <div className="bg-yzi-card/60 border border-white/10 rounded-2xl p-6">
          <h3 className="text-[11px] font-mono uppercase tracking-wide text-white/40 mb-4">Strengths &amp; growth areas</h3>

          <div className="flex items-center gap-2 text-sm font-semibold text-white mb-3">
            <span className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.6)]" />
            Where you're strong
          </div>
          <ul className="space-y-2 mb-5">
            {(report.strengths || []).map((s, i) => (
              <li key={i} className="text-sm text-white/80 leading-relaxed pl-4 relative before:content-[''] before:absolute before:left-0 before:top-2 before:w-1 before:h-1 before:rounded-full before:bg-white/40">
                {s}
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-2 text-sm font-semibold text-white mb-3">
            <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]" />
            Where to grow
          </div>
          <ul className="space-y-2">
            {(report.growthAreas || []).map((s, i) => (
              <li key={i} className="text-sm text-white/80 leading-relaxed pl-4 relative before:content-[''] before:absolute before:left-0 before:top-2 before:w-1 before:h-1 before:rounded-full before:bg-white/40">
                {s}
              </li>
            ))}
          </ul>

          {report.seraNote && (
            <p className="mt-5 pt-4 border-t border-white/10 text-white text-[15px] leading-relaxed">
              "{report.seraNote}"
              <span className="block mt-2 text-[11px] font-mono uppercase tracking-wide text-yzi-cyan">— Sera</span>
            </p>
          )}
        </div>
      </div>

      {report.roadmap?.length === 3 && (
        <div className="mt-8">
          <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
            <h3 className="text-xl font-bold text-white">Your roadmap, from here</h3>
            <span className="text-xs text-white/40">Based on this interview, not just your résumé</span>
          </div>
          <div className="grid md:grid-cols-3 gap-3.5">
            {report.roadmap.map((tier, i) => {
              const meta = TIER_META[i]
              return (
                <div key={i} className="bg-yzi-card/60 border border-white/10 rounded-2xl p-5 flex flex-col gap-3">
                  <span className={`inline-flex items-center gap-1.5 text-[10.5px] font-mono uppercase tracking-wide ${meta.accent}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                    {meta.label}
                  </span>
                  <div className="font-bold text-[19px] text-white">{tier.role}</div>
                  <p className="text-[13px] text-white/60 leading-relaxed">{tier.description}</p>
                  <div className="mt-auto pt-1 flex flex-wrap gap-1.5">
                    {(tier.skills || []).map((skill, j) => (
                      <span key={j} className="text-[11px] font-mono px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-white/60">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {report.resources?.length > 0 && (
        <div className="mt-8">
          <h3 className="text-xl font-bold text-white mb-4">Worth watching</h3>
          <div className="grid md:grid-cols-3 gap-3.5">
            {report.resources.map((resource, i) => (
              <a
                key={i}
                href={resource.videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group bg-yzi-card/60 border border-white/10 rounded-2xl overflow-hidden hover:border-white/25 transition"
              >
                <div className="aspect-video bg-black/40 overflow-hidden">
                  <img
                    src={resource.thumbnailUrl}
                    alt={resource.title}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <div className="p-4">
                  <span className="text-[10.5px] font-mono uppercase tracking-wide text-yzi-cyan block mb-1.5">
                    {resource.topic}
                  </span>
                  <p className="text-sm text-white/85 leading-snug line-clamp-2">{resource.title}</p>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8 bg-yzi-card/60 border border-white/10 rounded-2xl p-8 md:p-10 relative overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(60% 120% at 0% 0%, rgba(255,94,0,0.14), transparent 60%), radial-gradient(60% 120% at 100% 100%, rgba(139,92,246,0.16), transparent 60%)',
          }}
        />
        <div className="relative flex items-center justify-between gap-7 flex-wrap">
          <div className="max-w-md">
            <span className="text-xs font-medium tracking-widest uppercase text-yzi-cyan block mb-3">
              YZI Works Community
            </span>
            <h3 className="text-xl md:text-2xl font-bold text-white mb-2">
              You don't have to figure this out alone.
            </h3>
            <p className="text-white/60 text-sm leading-relaxed">
              This is exactly what the YZI community exists for — help finding the right placement
              at the right company, and real support behind you the whole way: mentorship,
              referrals, and people in your corner, not just an interview and a PDF.
            </p>
          </div>
          <a
            href="/"
            className="px-8 py-3.5 rounded-full bg-gradient-to-r from-yzi-orange via-yzi-pink to-yzi-purple text-white font-semibold hover:scale-105 transition-transform duration-300 flex-shrink-0"
          >
            Join the YZI Community
          </a>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between gap-5 flex-wrap">
        <p className="text-xs text-white/40 max-w-md leading-relaxed">
          This is yours to read, not to keep — there's no download, and nothing here is stored
          beyond this session.
        </p>
        <button
          onClick={onDone}
          className="px-6 py-2.5 rounded-full border border-white/15 text-white text-sm hover:bg-white/10 transition"
        >
          Done
        </button>
      </div>
    </div>
  )
}

export default SeraReport
