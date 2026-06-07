import * as React from 'react'
import {
  ThemeStrings,
  DesktopStrings,
  defaultStrings,
  getThemeStrings,
} from './madness-theme-strings'

const ThemeStringsContext = React.createContext<ThemeStrings>(defaultStrings)

// Module-level mirror of the active personality's strings. GitHub Desktop's UI
// is overwhelmingly class components, which cannot use hooks. The provider keeps
// this in sync on every render; class components read it via the getters below.
// app.tsx re-renders the whole tree when the personality changes, so values stay
// fresh without any per-component context plumbing.
let currentStrings: ThemeStrings = defaultStrings

export function ThemeStringsProvider(props: {
  personality: string
  children: React.ReactNode
}) {
  const strings = getThemeStrings(props.personality)
  currentStrings = strings
  return (
    <ThemeStringsContext.Provider value={strings}>
      {props.children}
    </ThemeStringsContext.Provider>
  )
}

/** Hook accessor for function components. */
export function useThemeStrings(): ThemeStrings {
  return React.useContext(ThemeStringsContext)
}

/**
 * Sync accessor for class components (which can't use hooks). Returns the active
 * personality's full string set. Safe to call inside render().
 */
export function getThemeStringsSync(): ThemeStrings {
  return currentStrings
}

/**
 * Sync accessor for the git-client ("desktop") voice strings. Use in class
 * components: `getDesktopStrings().push`. Falls back to English defaults when no
 * personality is active.
 */
export function getDesktopStrings(): DesktopStrings {
  return currentStrings.desktop
}

export { ThemeStringsContext }
