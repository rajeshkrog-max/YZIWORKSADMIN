import { useRef, useState } from 'react'
import SeraWave from './SeraWave'
import GlassCard from './glass/GlassCard'
import VerifiedRow from './glass/VerifiedRow'

async function hasPdfSignature(file) {
  try {
    const head = new Uint8Array(await file.slice(0, 5).arrayBuffer())
    return String.fromCharCode(...head) === '%PDF-'
  } catch {
    return false
  }
}

function formatSize(bytes) {
  return `${Math.max(0.1, bytes / (1024 * 1024)).toFixed(1)} MB`
}

const UploadIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 16V4m0 0 4.5 4.5M12 4 7.5 8.5M5 16v2.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V16" />
  </svg>
)

const PdfIcon = () => (
  <span className="w-7 h-7 rounded-lg shrink-0 grid place-items-center bg-red-500/15 text-red-500 light:text-red-600 text-[9px] font-bold tracking-wide">
    PDF
  </span>
)

function SeraUpload({ profile, resumeFile, onSelectFile, onBegin, busy, error }) {
  const inputRef = useRef(null)
  const [dragActive, setDragActive] = useState(false)
  const firstName = profile?.name?.split(' ')[0] || 'there'

  const handleFiles = async (fileList) => {
    const file = fileList?.[0]
    if (!file) return
    if (!/\.pdf$/i.test(file.name)) {
      onSelectFile(null, 'Sera only reads PDF résumés — please upload a .pdf file')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      onSelectFile(null, 'That file is over 10 MB — please upload a smaller PDF')
      return
    }
    // A real PDF starts with "%PDF-" — catches a .docx/.jpg renamed to .pdf.
    // The server's résumé check still runs after this.
    if (!(await hasPdfSignature(file))) {
      onSelectFile(null, "This file isn't a real PDF. Please upload your résumé as a PDF.")
      return
    }
    onSelectFile(file)
  }

  const browse = () => inputRef.current?.click()

  return (
    <div className="w-full flex flex-col items-center text-center">
      {/* Same full-bleed wave band as the login, so the two screens read as one. */}
      <SeraWave state="idle" bleed className="w-full h-[140px] md:h-[200px] mb-6" />

      <GlassCard>
        <h2 className="text-2xl font-bold text-fg">Good to have you, {firstName}.</h2>
        <p className="mt-1.5 mb-6 text-sm text-fg/60 leading-relaxed">
          Now, your résumé — Sera reads it in seconds and already knows your background when the
          call starts.
        </p>

        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files)
            e.target.value = '' // lets "Change" pick the same file again
          }}
        />

        {resumeFile ? (
          <VerifiedRow
            icon={<PdfIcon />}
            extra={<span className="text-xs text-fg/50 tabular-nums shrink-0">{formatSize(resumeFile.size)}</span>}
            onChange={browse}
          >
            <span title={resumeFile.name}>{resumeFile.name}</span>
          </VerifiedRow>
        ) : (
          <div
            role="button"
            tabIndex={0}
            onClick={browse}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                browse()
              }
            }}
            onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragActive(false)
              handleFiles(e.dataTransfer.files)
            }}
            className={`rounded-[18px] border-2 border-dashed px-4 py-7 cursor-pointer transition motion-reduce:transition-none outline-none focus-visible:border-yzi-cyan/70 ${
              dragActive
                ? 'border-yzi-cyan bg-yzi-cyan/10 shadow-[0_0_28px_rgba(34,211,238,0.3)]'
                : 'border-white/20 light:border-black/15 bg-fg/5 light:bg-white/60 hover:border-white/35 light:hover:border-black/25'
            }`}
          >
            <span className="mx-auto mb-3 w-11 h-11 rounded-full grid place-items-center text-white bg-gradient-to-br from-yzi-cyan to-yzi-purple shadow-[0_6px_18px_rgba(139,92,246,0.35)]">
              <UploadIcon />
            </span>
            <p className="text-sm font-medium text-fg">Drop your résumé here, or click to browse</p>
            <p className="text-xs text-fg/45 mt-1">PDF only · up to 10 MB</p>
          </div>
        )}

        {error && <p className="mt-1.5 text-xs text-left text-red-400 light:text-red-600">{error}</p>}

        <button
          type="button"
          onClick={onBegin}
          disabled={!resumeFile || busy}
          className="mt-6 w-full h-[50px] rounded-full bg-gradient-to-r from-yzi-orange via-yzi-pink to-yzi-purple text-white font-semibold transition hover:brightness-110 disabled:from-fg/15 disabled:via-fg/15 disabled:to-fg/15 disabled:text-fg/40 disabled:cursor-not-allowed disabled:hover:brightness-100"
        >
          Begin the interview
        </button>

        <div className="mt-6 pt-5 border-t border-fg/10 flex flex-col gap-2 text-xs text-fg/45 leading-relaxed">
          <p>
            Sera is an AI interviewer. Its questions and feedback are generated by AI, can contain
            mistakes, and are meant for practice only. Please review them before relying on them for
            any decision.
          </p>
          <p>
            We process your data under the Digital Personal Data Protection Act, 2023. Unauthorised
            extraction or copying of records is prohibited.
          </p>
        </div>
      </GlassCard>
    </div>
  )
}

export default SeraUpload
