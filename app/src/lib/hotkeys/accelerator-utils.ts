import { Keybinding } from './hotkey-types'

/**
 * Canonical modifier order for normalization.
 */
const ModifierOrder = ['Ctrl', 'Alt', 'Shift', 'Meta', 'CmdOrCtrl'] as const

/**
 * Modifier aliases mapped to canonical names.
 */
const ModifierAliases: Record<string, string> = {
  control: 'Ctrl',
  ctrl: 'Ctrl',
  command: 'Meta',
  cmd: 'Meta',
  meta: 'Meta',
  option: 'Alt',
  alt: 'Alt',
  shift: 'Shift',
  cmdorctrl: 'CmdOrCtrl',
  commandorcontrol: 'CmdOrCtrl',
}

/**
 * DOM key values mapped to Electron accelerator key names.
 */
const KeyNameMap: Record<string, string> = {
  ' ': 'Space',
  arrowup: 'Up',
  arrowdown: 'Down',
  arrowleft: 'Left',
  arrowright: 'Right',
  backspace: 'Backspace',
  delete: 'Delete',
  escape: 'Escape',
  enter: 'Enter',
  tab: 'Tab',
  home: 'Home',
  end: 'End',
  pageup: 'PageUp',
  pagedown: 'PageDown',
  insert: 'Insert',
}

/**
 * Bindings that should never be overridden (OS-level shortcuts).
 */
const ReservedBindings = new Set([
  'CmdOrCtrl+Q', // Quit (macOS)
  'Alt+F4', // Close (Windows)
  'CmdOrCtrl+Tab', // Switch tab (OS-level)
  'CmdOrCtrl+Shift+Tab',
])

/**
 * Convert a DOM KeyboardEvent to an Electron accelerator string.
 * Returns null if the event is only modifier keys (no primary key).
 */
export function keyEventToAccelerator(event: KeyboardEvent): Keybinding | null {
  const key = event.key.toLowerCase()

  // Ignore pure modifier keypresses
  if (
    key === 'control' ||
    key === 'shift' ||
    key === 'alt' ||
    key === 'meta'
  ) {
    return null
  }

  const parts: string[] = []

  if (event.ctrlKey && event.metaKey) {
    // Both held — unusual but possible; use CmdOrCtrl
    parts.push('CmdOrCtrl')
  } else if (event.metaKey) {
    parts.push('CmdOrCtrl')
  } else if (event.ctrlKey) {
    parts.push('CmdOrCtrl')
  }

  if (event.altKey) {
    parts.push('Alt')
  }
  // Only record Shift for letters and named keys (Tab, arrows, F-keys).
  // For punctuation/digits the produced character already encodes shift
  // ('}' vs ']'), so adding Shift would make the binding unmatchable.
  const isLetter = key.length === 1 && key >= 'a' && key <= 'z'
  if (event.shiftKey && (isLetter || event.key.length > 1)) {
    parts.push('Shift')
  }

  // Map the primary key
  const primaryKey =
    KeyNameMap[key] ?? (key.length === 1 ? key.toUpperCase() : key)

  parts.push(primaryKey)

  // Must have at least one modifier for a valid hotkey (single keys are too easy to trigger accidentally)
  if (!event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) {
    // Allow F-keys without modifiers
    if (!primaryKey.match(/^F\d{1,2}$/)) {
      return null
    }
  }

  return parts.join('+')
}

/**
 * Normalize an accelerator string to a canonical form for comparison.
 * Sorts modifiers in canonical order, normalizes casing.
 */
export function normalizeAccelerator(accelerator: Keybinding): string {
  const parts = accelerator.split('+').map(p => p.trim())
  const modifiers: string[] = []
  let primaryKey = ''

  for (const part of parts) {
    const lower = part.toLowerCase()
    const canonical = ModifierAliases[lower]
    if (canonical) {
      modifiers.push(canonical)
    } else {
      primaryKey = KeyNameMap[lower] ?? part
    }
  }

  // Sort modifiers by canonical order
  modifiers.sort(
    (a, b) =>
      ModifierOrder.indexOf(a as any) - ModifierOrder.indexOf(b as any)
  )

  return [...modifiers, primaryKey].join('+')
}

/**
 * Compare two accelerator strings for equality (order-insensitive).
 */
export function areAcceleratorsEqual(
  a: Keybinding,
  b: Keybinding
): boolean {
  return normalizeAccelerator(a) === normalizeAccelerator(b)
}

/**
 * Check if a binding is reserved (OS-level, should not be overridden).
 */
export function isReservedBinding(binding: Keybinding): boolean {
  return ReservedBindings.has(normalizeAccelerator(binding))
}

/**
 * Convert a KeyboardEvent to a normalized accelerator for matching purposes.
 * Used by the hotkey listener to look up bindings at runtime.
 */
export function keyEventToNormalizedAccelerator(
  event: KeyboardEvent
): string | null {
  const accel = keyEventToAccelerator(event)
  return accel ? normalizeAccelerator(accel) : null
}

/**
 * Convert an Electron accelerator to a human-readable display string.
 * Uses platform-specific symbols on macOS.
 */
export function acceleratorToDisplayString(
  accelerator: Keybinding,
  isDarwin: boolean
): string {
  const parts = accelerator.split('+').map(p => p.trim())
  const display: string[] = []

  for (const part of parts) {
    const lower = part.toLowerCase()
    if (isDarwin) {
      switch (lower) {
        case 'cmdorctrl':
        case 'cmd':
        case 'command':
        case 'meta':
          display.push('\u2318')
          break
        case 'ctrl':
        case 'control':
          display.push('\u2303')
          break
        case 'alt':
        case 'option':
          display.push('\u2325')
          break
        case 'shift':
          display.push('\u21E7')
          break
        default:
          display.push(part)
      }
    } else {
      switch (lower) {
        case 'cmdorctrl':
          display.push('Ctrl')
          break
        default:
          display.push(part)
      }
    }
  }

  return isDarwin ? display.join('') : display.join('+')
}
