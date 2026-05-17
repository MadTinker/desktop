/**
 * 🧪 Madness Interactive Ecosystem — Shared Hotkey Conventions
 *
 * These conventions are shared across madnessDesktop and Inventorium
 * to create muscle-memory consistency across the lab tools.
 *
 * Both apps use:
 * - Context-aware dispatch (actions scoped to current view)
 * - Categorized action groups
 * - Conflict detection
 * - User-customizable bindings persisted in localStorage
 *
 * Shared modifier patterns:
 * - CmdOrCtrl+<key>       → Primary actions (push, pull, commit)
 * - CmdOrCtrl+Shift+<key> → Secondary actions (force push, create branch)
 * - CmdOrCtrl+Alt+<key>   → Tertiary / view actions
 * - Ctrl+Shift+Arrow      → Cross-project navigation (Inventorium)
 * - Number keys (no mod)  → Panel/tab switching (Inventorium context-specific)
 * - CmdOrCtrl+1-9         → View switching (Desktop)
 *
 * Context naming alignment:
 * Desktop:     'global' | 'repository' | 'changes-tab' | 'history-tab' | 'diff-view'
 * Inventorium: 'global' | 'project-navigator' | 'mind-map' | 'settings'
 */

/**
 * Shared action concepts that exist in both apps.
 * When both apps have the same concept, try to use the same default binding.
 */
export const EcosystemSharedBindings = {
  /** Open settings/preferences — both apps use CmdOrCtrl+, */
  openSettings: 'CmdOrCtrl+,',

  /** Refresh current view */
  refresh: 'CmdOrCtrl+Shift+T',

  /** Quick search / filter */
  search: 'CmdOrCtrl+F',

  /** Close current dialog/panel — Escape in both */
  closeOverlay: 'Escape',

  /** Toggle favorite / star */
  toggleFavorite: null, // unbound by default in both, user picks

  /** Open in external tool */
  openExternal: 'CmdOrCtrl+Shift+A',
} as const

/**
 * Category IDs shared across the ecosystem.
 * Desktop uses lowercase, Inventorium uses UPPER_SNAKE_CASE,
 * but the semantic groupings align:
 *
 * Desktop 'navigation' ↔ Inventorium 'PROJECT_NAVIGATION'
 * Desktop 'view'       ↔ Inventorium 'PANELS'
 * Desktop 'repository' ↔ Inventorium (project-level ops)
 * Desktop 'misc'       ↔ Inventorium 'GLOBAL'
 */
export const EcosystemCategories = [
  'navigation',
  'view',
  'edit',
  'actions', // project-level operations
  'settings',
  'misc',
] as const
