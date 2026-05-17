import { MenuEvent } from '../../main-process/menu/menu-event'

/**
 * Unique identifier for every bindable action.
 * Menu events use the MenuEvent type directly; dispatcher-only actions use string IDs.
 */
export type ActionID = MenuEvent | string

/**
 * Categories for grouping actions in the preferences UI.
 */
export type ActionCategory =
  | 'file'
  | 'edit'
  | 'view'
  | 'repository'
  | 'branch'
  | 'commit'
  | 'navigation'
  | 'misc'

/**
 * Context in which an action is valid.
 * The hotkey listener will only dispatch if the current app context matches.
 */
export type ActionContext =
  | 'global'
  | 'repository'
  | 'changes-tab'
  | 'history-tab'
  | 'diff-view'

/**
 * A keybinding string in Electron accelerator format.
 * Examples: "CmdOrCtrl+Shift+N", "Ctrl+H", "Alt+Command+I"
 */
export type Keybinding = string

/**
 * Defines a single bindable action with its metadata and default keybinding.
 */
export interface ActionDefinition {
  readonly id: ActionID
  readonly label: string
  readonly category: ActionCategory
  readonly context: ActionContext
  /** Default keybinding. null = unbound by default. */
  readonly defaultBinding: Keybinding | null
  /** Platform-specific override for macOS. If undefined, uses defaultBinding. */
  readonly darwinDefaultBinding?: Keybinding | null
  /** True if this action corresponds to an Electron menu item (handled via accelerator). */
  readonly isMenuAction: boolean
}

/**
 * A user override for a single action's keybinding.
 * binding = null means the user explicitly removed the binding.
 */
export interface HotkeyOverride {
  readonly actionId: ActionID
  readonly binding: Keybinding | null
}

/**
 * Represents a conflict where multiple actions share the same keybinding.
 */
export interface HotkeyConflict {
  readonly binding: Keybinding
  readonly actions: ReadonlyArray<ActionID>
}

/**
 * Serialized format for localStorage persistence.
 * Maps action IDs to their overridden binding (or null for unbound).
 */
export type HotkeyOverridesMap = Record<string, Keybinding | null>
