export const madnessThemes = [
  'standard',
  'mad-laboratory',
  'corporate-clean',
  'gunmetal',
  'debug',
  'cyan-lab',
  'labops',
  'templar-light',
] as const

export type MadnessTheme = (typeof madnessThemes)[number] | ''

export const madnessThemeLabels: Record<string, string> = {
  standard: 'Standard Laboratory',
  'mad-laboratory': 'Mad Laboratory',
  'corporate-clean': 'Corporate Clean',
  gunmetal: 'Gunmetal Arsenal',
  debug: 'Debug Mode',
  'cyan-lab': 'Cyan Laboratory',
  labops: 'LabOps',
  'templar-light': 'Templar Light',
}

// Primary / secondary / bg hex for each theme — used to render inline swatches.
// Extracted from the source *-colors.json files.
export const madnessThemeSwatches: Record<
  string,
  { primary: string; secondary: string; bg: string }
> = {
  standard: { primary: '#00ffff', secondary: '#ff6b35', bg: '#0a0a0a' },
  'mad-laboratory': { primary: '#9c27b0', secondary: '#00ff88', bg: '#0a0a0a' },
  'corporate-clean': { primary: '#2196f3', secondary: '#607d8b', bg: '#0f0f0f' },
  gunmetal: { primary: '#78909c', secondary: '#90a4ae', bg: '#263238' },
  debug: { primary: '#ff00ff', secondary: '#00ff00', bg: '#000000' },
  'cyan-lab': { primary: '#00BCD4', secondary: '#f57c00', bg: '#0D2B2E' },
  labops: { primary: '#13B5D8', secondary: '#11A4D4', bg: '#1E3D52' },
  'templar-light': { primary: '#c5b358', secondary: '#a41e21', bg: '#f5f5f5' },
}

const madnessThemeKey = 'madnessTheme'

export function getPersistedMadnessTheme(): MadnessTheme {
  return (localStorage.getItem(madnessThemeKey) ?? '') as MadnessTheme
}

export function setPersistedMadnessTheme(theme: MadnessTheme): void {
  localStorage.setItem(madnessThemeKey, theme)
}
