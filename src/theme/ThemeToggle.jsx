import { useTheme } from './useTheme'

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true">
      <path d="M20.5 14.3A8.5 8.5 0 0 1 9.7 3.5a8.5 8.5 0 1 0 10.8 10.8z" />
    </svg>
  )
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" />
      <path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4" />
    </svg>
  )
}

// variant: 'compact' (pill only), 'inline' (pill + label beside it, mobile menu)
function ThemeToggle({ variant = 'compact', className = '' }) {
  const { isDark, toggle } = useTheme()
  const layout = variant === 'inline' ? 'flex-row gap-2.5' : ''

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label="Dark mode"
      onClick={toggle}
      className={`inline-flex items-center ${layout} rounded-full cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-yzi-orange ${className}`}
    >
      <span
        aria-hidden="true"
        className={`relative block w-[52px] h-7 rounded-full border ${
          isDark ? 'bg-[#16162A] border-white/25' : 'bg-zinc-200 border-black/15'
        }`}
      >
        {isDark && (
          <>
            <span className="absolute left-[10px] top-[7px] w-[3px] h-[3px] rounded-full bg-white/90" />
            <span className="absolute left-[17px] top-[15px] w-[2px] h-[2px] rounded-full bg-white/70" />
            <span className="absolute left-[7px] top-[17px] w-[2px] h-[2px] rounded-full bg-white/50" />
          </>
        )}
        <span
          data-theme-thumb
          className={`absolute top-[2px] left-[2px] w-[22px] h-[22px] rounded-full grid place-items-center shadow-md transition-transform duration-200 ease-out motion-reduce:transition-none ${
            isDark
              ? 'translate-x-6 bg-[#0B0B14] text-yellow-200 ring-1 ring-white/40'
              : 'translate-x-0 bg-white text-orange-500 ring-1 ring-black/10'
          }`}
        >
          {isDark ? <MoonIcon /> : <SunIcon />}
        </span>
      </span>
      {variant === 'inline' && (
        <span
          aria-hidden="true"
          className="text-[10px] font-semibold tracking-[0.14em] leading-none text-fg/75"
        >
          {isDark ? 'DARK MODE' : 'LIGHT MODE'}
        </span>
      )}
    </button>
  )
}

export default ThemeToggle
