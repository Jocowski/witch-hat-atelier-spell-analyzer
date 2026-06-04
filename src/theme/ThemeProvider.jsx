import { createContext, useContext, useEffect, useState } from 'react'

export const THEMES = ['brown', 'dark', 'light', 'arcane']

const STORAGE_KEY = 'wha-theme'
const DEFAULT_THEME = 'brown'

const ThemeContext = createContext({ theme: DEFAULT_THEME, setTheme: () => {}, THEMES })

export function useTheme() {
  return useContext(ThemeContext)
}

export default function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return THEMES.includes(stored) ? stored : DEFAULT_THEME
    } catch {
      return DEFAULT_THEME
    }
  })

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      // storage unavailable — ignore
    }
  }, [theme])

  function setTheme(next) {
    if (THEMES.includes(next)) setThemeState(next)
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, THEMES }}>
      {children}
    </ThemeContext.Provider>
  )
}
