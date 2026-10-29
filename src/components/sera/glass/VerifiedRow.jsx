// Green "done" row: icon · text (truncated) · extra · ✓ · Change link.
// Same look as the verified rows on the Sera login.
function VerifiedRow({ icon, children, extra, onChange, changeLabel = 'Change' }) {
  return (
    <div className="flex items-center gap-3 h-[50px] px-3.5 rounded-[14px] border border-emerald-500/40 bg-emerald-500/10">
      {icon}
      <span className="flex-1 min-w-0 truncate text-sm text-fg text-left">{children}</span>
      {extra}
      <span className="text-emerald-500 font-bold" aria-label="Done">✓</span>
      <button type="button" onClick={onChange} className="text-xs text-fg/60 underline underline-offset-2 hover:text-fg">
        {changeLabel}
      </button>
    </div>
  )
}

export default VerifiedRow
