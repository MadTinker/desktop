#!/usr/bin/env node
// Converts MadnessThemes JSON color files → SCSS CSS variable overrides.
// Run: node scripts/generate-madness-themes.js
// Output: app/styles/themes/_madness-<name>.scss + _madness-index.scss

const fs = require('fs')
const path = require('path')
const glob = require('glob')

const THEMES_DIR = path.join(__dirname, '../app/madness-themes')
const OUT_DIR = path.join(__dirname, '../app/styles/themes')

// Extract first #RRGGBB hex from a CSS value (handles gradients)
function extractHex(value) {
  if (!value) return null
  const match = String(value).match(/#([0-9a-fA-F]{6})\b/)
  return match ? match[0] : null
}

// Extract first solid color (hex or rgba) from a value
function extractSolid(value) {
  if (!value) return null
  const v = String(value)
  // Prefer hex
  const hex = extractHex(v)
  if (hex) return hex
  // Fall back to rgba/rgb
  const rgba = v.match(/rgba?\([^)]+\)/)
  return rgba ? rgba[0] : null
}

function get(obj, ...path) {
  return path.reduce((o, k) => (o != null ? o[k] : undefined), obj)
}

function buildVars(colors) {
  const c = colors
  const vars = {}

  // Backgrounds
  const bgMain = extractHex(get(c, 'background', 'main')) || '#0a0a0a'
  vars['--background-color'] = bgMain
  vars['--toolbar-background-color'] = bgMain
  vars['--panel-background-color'] = bgMain

  const cardBg = extractSolid(get(c, 'background', 'card', 'normal'))
  if (cardBg) {
    vars['--box-background-color'] = cardBg
    vars['--list-item-background'] = cardBg
  }

  const cardHover = extractSolid(get(c, 'background', 'card', 'hover'))
  if (cardHover) {
    vars['--list-item-hover-background-color'] = cardHover
  }

  const cardSelected = extractSolid(get(c, 'background', 'card', 'selected'))
  if (cardSelected) {
    vars['--list-item-selected-background-color'] = cardSelected
  }

  // Text
  const textPrimary = get(c, 'text', 'primary')
  if (textPrimary) vars['--text-color'] = textPrimary

  const textSecondary = get(c, 'text', 'secondary')
  if (textSecondary) vars['--text-secondary-color'] = textSecondary

  const textMuted = get(c, 'text', 'muted')
  if (textMuted) vars['--text-secondary-color-muted'] = textMuted

  // Borders
  const borderPrimary = get(c, 'border', 'primary')
  if (borderPrimary) vars['--box-border-contrast-color'] = borderPrimary

  const borderSubtle = get(c, 'border', 'subtle')
  if (borderSubtle) vars['--box-border-color'] = borderSubtle

  // Buttons
  const primaryBtn = get(c, 'primaryButton') || get(c, 'primary')
  if (primaryBtn) {
    vars['--button-background'] = primaryBtn
    vars['--button-hover-background'] = primaryBtn
  }

  // Accent / focus
  const primary = get(c, 'primary')
  if (primary) {
    vars['--focus-color'] = primary
    vars['--link-button-color'] = primary
    vars['--link-button-hover-color'] = primary
  }

  // Git status colors
  const success = get(c, 'success')
  if (success) vars['--color-new'] = success

  const error = get(c, 'error')
  if (error) vars['--color-deleted'] = error

  const warning = get(c, 'warning')
  if (warning) vars['--color-modified'] = warning

  // Toolbar text
  const toolbarText = extractSolid(get(c, 'text', 'primary'))
  if (toolbarText) vars['--toolbar-text-color'] = toolbarText

  // Shadows / overlays
  const shadowMedium = get(c, 'shadows', 'medium')
  if (shadowMedium) vars['--box-shadow-color'] = shadowMedium

  return vars
}

function generateScss(themeName, displayName, colors) {
  const vars = buildVars(colors)
  const lines = Object.entries(vars).map(([k, v]) => `  ${k}: ${v};`)
  return [
    `// Auto-generated from ${themeName}-colors.json — do not edit`,
    `// ${displayName}`,
    ``,
    `body.theme-madness-${themeName} {`,
    ...lines,
    `}`,
    ``,
  ].join('\n')
}

function main() {
  const files = glob.sync(path.join(THEMES_DIR, '*-colors.json'))

  if (files.length === 0) {
    console.error('No *-colors.json files found. Is the submodule initialized?')
    process.exit(1)
  }

  const generated = []

  for (const file of files) {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'))
    const { themeName, displayName, colors } = data

    if (!themeName || !colors) {
      console.warn(`Skipping ${file}: missing themeName or colors`)
      continue
    }

    const scss = generateScss(themeName, displayName, colors)
    const outFile = path.join(OUT_DIR, `_madness-${themeName}.scss`)
    fs.writeFileSync(outFile, scss)
    console.log(`  wrote ${path.relative(process.cwd(), outFile)}`)
    generated.push(themeName)
  }

  // Write index file
  const indexLines = generated.map(n => `@import 'madness-${n}';`)
  const indexContent = [
    `// Auto-generated — do not edit`,
    `// Import all MadnessTheme SCSS overrides`,
    ``,
    ...indexLines,
    ``,
  ].join('\n')

  const indexFile = path.join(OUT_DIR, '_madness-index.scss')
  fs.writeFileSync(indexFile, indexContent)
  console.log(`  wrote ${path.relative(process.cwd(), indexFile)}`)
  console.log(`Done. Generated ${generated.length} themes.`)
}

main()
