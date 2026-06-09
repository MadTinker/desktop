export const madnessThemes = [
  'standard',
  'mad-laboratory',
  'corporate-clean',
  'gunmetal',
  'debug',
  'cyan-lab',
  'labops',
  'templar-light',
  'lab-neon',
  'alchemist',
  'deep-space',
  'terminal',
  'hazmat',
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
  'lab-neon': 'Lab Neon',
  alchemist: 'Alchemist',
  'deep-space': 'Deep Space',
  terminal: 'Terminal',
  hazmat: 'Hazmat',
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
  'lab-neon': { primary: '#00ff88', secondary: '#00ccff', bg: '#0a0a0f' },
  alchemist: { primary: '#c8860a', secondary: '#ff6b00', bg: '#1a1000' },
  'deep-space': { primary: '#7c4dff', secondary: '#40c4ff', bg: '#050510' },
  terminal: { primary: '#33ff33', secondary: '#00cc00', bg: '#000000' },
  hazmat: { primary: '#ffd600', secondary: '#ff6d00', bg: '#0a0800' },
}

// --- Personality (independent from color theme) ---

export const madnessPersonalities = [
  'standard',
  'banana',
  'biomedical',
  'corporate-clean',
  'corporate-drone',
  'cyan-lab',
  'debug',
  'dwarf',
  'gunmetal',
  'labops',
  'mad-wizard',
  'templar-light',
] as const

export type MadnessPersonality = (typeof madnessPersonalities)[number] | ''

export const madnessPersonalityLabels: Record<string, string> = {
  standard: 'Standard',
  banana: 'Banana Jungle',
  biomedical: 'Biomedical',
  'corporate-clean': 'Corporate Clean',
  'corporate-drone': 'Corporate Drone',
  'cyan-lab': 'Cyan Laboratory',
  debug: 'Debug Mode',
  dwarf: 'Dwarven Mines',
  gunmetal: 'Gunmetal Arsenal',
  labops: 'LabOps',
  'mad-wizard': 'Mad Wizard',
  'templar-light': 'Templar Light',
}

const personalityKey = 'madnessPersonality'

export function getPersistedPersonality(): MadnessPersonality {
  return (localStorage.getItem(personalityKey) ?? '') as MadnessPersonality
}

export function setPersistedPersonality(p: MadnessPersonality): void {
  localStorage.setItem(personalityKey, p)
}

// --- Color theme ---

const madnessThemeKey = 'madnessTheme'

export function getPersistedMadnessTheme(): MadnessTheme {
  return (localStorage.getItem(madnessThemeKey) ?? '') as MadnessTheme
}

export function setPersistedMadnessTheme(theme: MadnessTheme): void {
  localStorage.setItem(madnessThemeKey, theme)
}
