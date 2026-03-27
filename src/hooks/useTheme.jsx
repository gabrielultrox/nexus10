import { createContext, useContext, useEffect, useMemo, useState } from 'react'

const STORAGE_KEY = 'nexus10-theme'
const themeSequence = ['dark', 'light', 'amber']

const ThemeContext = createContext(null)

function getInitialTheme() {
  const storedTheme = window.localStorage.getItem(STORAGE_KEY)

  if (themeSequence.includes(storedTheme)) {
    return storedTheme
  }

  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getInitialTheme)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    document.documentElement.style.colorScheme = theme === 'dark' ? 'dark' : 'light'
    window.localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      toggleTheme: () => {
        setTheme((currentTheme) => {
          const currentIndex = themeSequence.indexOf(currentTheme)
          const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % themeSequence.length
          return themeSequence[nextIndex]
        })
      },
    }),
    [theme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)

  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }

  return context
}
