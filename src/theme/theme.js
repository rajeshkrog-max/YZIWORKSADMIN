// Theme state lives on <html data-theme>. The inline script in index.html sets
// it before first paint; this module reads and changes it after that.
const STORAGE_KEY = 'yzi-theme'
const listeners = new Set()

export function getTheme() {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'
}

// Swap every colour in one frame instead of letting each element run its own
// transition. The toggle thumb keeps its slide animation.
function suppressTransitions() {
  const style = document.createElement('style')
  style.textContent = '*:not([data-theme-thumb]),*::before,*::after{transition:none!important}'
  document.head.appendChild(style)
  requestAnimationFrame(() => requestAnimationFrame(() => style.remove()))
}

export function setTheme(theme) {
  const next = theme === 'light' ? 'light' : 'dark'
  if (next === getTheme()) return
  suppressTransitions()
  const root = document.documentElement
  root.dataset.theme = next
  root.style.colorScheme = next
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {
    // Storage blocked (private mode etc.): the theme still applies for this page view.
  }
  listeners.forEach((fn) => fn())
}

export function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
