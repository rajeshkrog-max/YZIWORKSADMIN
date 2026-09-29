// Shared look for the report page's glass panels and small labels.
export const PANEL =
  'rounded-[24px] border border-white/10 light:border-white/80 bg-card/55 light:bg-white/60 backdrop-blur-[22px] shadow-[0_20px_50px_rgba(0,0,0,0.35)] light:shadow-[0_20px_50px_rgba(76,29,149,0.1)] p-5 sm:p-7'

export const SECTION_LABEL = 'text-[11px] font-semibold uppercase tracking-[0.16em] text-fg/50'

export const SECTION_TITLE = 'text-xl sm:text-2xl font-bold text-fg'

// 380 → "6 min 20 s"
export const formatDuration = (seconds) => {
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return m ? `${m} min${s ? ` ${s} s` : ''}` : `${s} s`
}
