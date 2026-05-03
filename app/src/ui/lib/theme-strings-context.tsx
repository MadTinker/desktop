import * as React from 'react'
import {
  ThemeStrings,
  defaultStrings,
  getThemeStrings,
} from './madness-theme-strings'

const ThemeStringsContext = React.createContext<ThemeStrings>(defaultStrings)

export function ThemeStringsProvider(props: {
  personality: string
  children: React.ReactNode
}) {
  const strings = getThemeStrings(props.personality)
  return (
    <ThemeStringsContext.Provider value={strings}>
      {props.children}
    </ThemeStringsContext.Provider>
  )
}

export function useThemeStrings(): ThemeStrings {
  return React.useContext(ThemeStringsContext)
}

export { ThemeStringsContext }
