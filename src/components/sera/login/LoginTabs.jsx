const TABS = [
  { id: 'visitor', label: 'Visitor' },
  { id: 'student', label: 'Student' },
]

// Visitor | Student segmented control with a sliding highlight pill.
function LoginTabs({ value, onChange }) {
  const index = TABS.findIndex((tab) => tab.id === value)

  return (
    <div
      role="tablist"
      aria-label="Sign in as"
      className="relative grid grid-cols-2 p-1 rounded-full bg-fg/5 border border-fg/10"
    >
      <span
        aria-hidden="true"
        className="absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-full bg-fg/10 border border-fg/15 shadow-sm light:bg-white light:border-black/5 transition-transform duration-300 ease-out motion-reduce:transition-none"
        style={{ transform: `translateX(${index * 100}%)` }}
      />
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={value === tab.id}
          onClick={() => onChange(tab.id)}
          className={`relative z-10 h-10 rounded-full text-sm font-semibold transition-colors motion-reduce:transition-none ${
            value === tab.id ? 'text-fg' : 'text-fg/55 hover:text-fg/80'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

export default LoginTabs
