import { useRef, useState } from 'react'
import SeraOrb from './SeraOrb'

function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function SeraUpload({ profile, resumeFile, onSelectFile, onBegin, busy, error }) {
  const inputRef = useRef(null)
  const [dragActive, setDragActive] = useState(false)
  const firstName = profile?.name?.split(' ')[0] || 'there'

  const handleFiles = (fileList) => {
    const file = fileList?.[0]
    if (!file) return
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
    if (!isPdf) {
      onSelectFile(null, 'Sera only reads PDF résumés — please upload a .pdf file')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      onSelectFile(null, 'That file is over 10 MB — please upload a smaller PDF')
      return
    }
    onSelectFile(file)
  }

  return (
    <div className="flex flex-col items-center text-center">
      <SeraOrb state="idle" size={110} className="mb-6" />
      <div className="w-full max-w-sm bg-yzi-card/60 border border-white/10 rounded-2xl p-8 text-left backdrop-blur-md">
        <h2 className="text-2xl font-bold text-white mb-2">Good to have you, {firstName}.</h2>
        <p className="text-white/60 text-sm mb-6 leading-relaxed">
          Now, your résumé — Sera reads it in seconds and already knows your background when the
          call starts.
        </p>

        {error && (
          <p className="mb-4 text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {!resumeFile && (
          <div
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragActive(false)
              handleFiles(e.dataTransfer.files)
            }}
            className={`border-2 border-dashed rounded-2xl px-4 py-8 text-center cursor-pointer transition ${
              dragActive ? 'border-yzi-cyan bg-yzi-cyan/5' : 'border-white/15 hover:border-white/30'
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
            <svg
              className="w-6 h-6 mx-auto mb-3 text-white/50"
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"
            >
              <path d="M12 3v12m0-12 4 4m-4-4-4 4M5 17v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" />
            </svg>
            <p className="text-sm font-medium text-white">Drop your résumé here, or click to browse</p>
            <p className="text-xs text-white/40 mt-1">One PDF, up to 10 MB</p>
          </div>
        )}

        {resumeFile && (
          <div className="flex items-center gap-3 rounded-xl bg-yzi-cyan/10 border border-yzi-cyan/30 px-4 py-3">
            <span className="flex-1 text-sm font-medium text-white truncate">{resumeFile.name}</span>
            <span className="text-xs text-white/50 font-mono">{formatSize(resumeFile.size)}</span>
            <button
              onClick={() => onSelectFile(null)}
              aria-label="Remove file"
              className="text-white/40 hover:text-white text-lg leading-none"
            >
              &times;
            </button>
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button
            onClick={onBegin}
            disabled={!resumeFile || busy}
            className="px-8 py-3.5 rounded-full bg-gradient-to-r from-yzi-orange via-yzi-pink to-yzi-purple text-white font-semibold hover:scale-105 transition-transform duration-300 disabled:opacity-35 disabled:hover:scale-100"
          >
            Begin the interview
          </button>
        </div>
      </div>
    </div>
  )
}

export default SeraUpload
