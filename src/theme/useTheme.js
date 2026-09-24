import { useCallback, useSyncExternalStore } from 'react'
import { getTheme, setTheme, subscribe } from './theme'

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getTheme, () => 'dark')
  const toggle = useCallback(() => setTheme(getTheme() === 'dark' ? 'light' : 'dark'), [])
  return { theme, isDark: theme === 'dark', toggle }
}
