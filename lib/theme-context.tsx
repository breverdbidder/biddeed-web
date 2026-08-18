'use client'

import { createContext, useContext, ReactNode } from 'react'

type Theme = 'light' | 'dark'

interface ThemeContextType {
  theme: Theme
  toggleTheme: () => void
}

/**
 * Theme is fixed dark, and deliberately storage-free.
 *
 * This module used to persist a 'bd-theme' key to localStorage and toggle the
 * `dark` class from an effect. The provider was never mounted, so the code was
 * dead -- but the app shell forbids storage APIs outright, and dead code that
 * calls localStorage is exactly what gets copied into live code later. The
 * `dark` class is now set statically on <html> in app/layout.tsx.
 *
 * The hook stays because AuctionMap reads `theme` to pick its Mapbox style.
 * Reintroducing a light theme means adding a React-only provider here, not a
 * storage read.
 */
const ThemeContext = createContext<ThemeContextType>({
  theme: 'dark',
  toggleTheme: () => {},
})

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <ThemeContext.Provider value={{ theme: 'dark', toggleTheme: () => {} }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
