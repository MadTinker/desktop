import { getObject, setObject } from '../local-storage'
import {
  ActionID,
  HotkeyConflict,
  HotkeyOverridesMap,
  Keybinding,
} from './hotkey-types'
import { DefaultActionDefinitions, ActionDefinitionMap } from './default-bindings'
import { normalizeAccelerator, areAcceleratorsEqual } from './accelerator-utils'

const StorageKey = 'hotkey-overrides'

/**
 * Manages hotkey bindings: merges defaults with user overrides,
 * persists to localStorage, and detects conflicts.
 */
export class HotkeyStore {
  private overrides: HotkeyOverridesMap = {}
  private effectiveBindings: Map<string, Keybinding | null> = new Map()
  private listeners: Array<() => void> = []

  constructor() {
    this.load()
    this.recompute()
  }

  /**
   * Load overrides from localStorage.
   */
  private load(): void {
    const stored = getObject<HotkeyOverridesMap>(StorageKey)
    this.overrides = stored ?? {}
  }

  /**
   * Persist overrides to localStorage.
   */
  private save(): void {
    setObject(StorageKey, this.overrides)
    this.recompute()
    this.notifyListeners()
  }

  /**
   * Recompute effective bindings from defaults + overrides.
   */
  private recompute(): void {
    this.effectiveBindings = new Map()
    for (const def of DefaultActionDefinitions) {
      if (def.id in this.overrides) {
        this.effectiveBindings.set(def.id, this.overrides[def.id])
      } else {
        this.effectiveBindings.set(def.id, def.defaultBinding)
      }
    }
  }

  /**
   * Get the effective binding for a single action.
   */
  public getEffectiveBinding(id: ActionID): Keybinding | null {
    return this.effectiveBindings.get(id) ?? null
  }

  /**
   * Get all effective bindings.
   */
  public getEffectiveBindings(): ReadonlyMap<string, Keybinding | null> {
    return this.effectiveBindings
  }

  /**
   * Get only menu-action bindings (for sending to main process).
   * Returns a plain object mapping action ID → accelerator string.
   */
  public getMenuAccelerators(): Record<string, string | null> {
    const result: Record<string, string | null> = {}
    for (const def of DefaultActionDefinitions) {
      if (def.isMenuAction) {
        result[def.id] = this.effectiveBindings.get(def.id) ?? null
      }
    }
    return result
  }

  /**
   * Get only non-menu bindings (for the renderer keyboard listener).
   */
  public getNonMenuBindings(): Map<string, Keybinding | null> {
    const result = new Map<string, Keybinding | null>()
    for (const def of DefaultActionDefinitions) {
      if (!def.isMenuAction) {
        const binding = this.effectiveBindings.get(def.id) ?? null
        if (binding) {
          result.set(def.id, binding)
        }
      }
    }
    return result
  }

  /**
   * Set (or clear) the binding for an action.
   * Returns any conflicts introduced by the change.
   */
  public setBinding(
    id: ActionID,
    binding: Keybinding | null
  ): HotkeyConflict[] {
    this.overrides[id] = binding
    this.save()
    return binding ? this.getConflictsForBinding(binding) : []
  }

  /**
   * Reset a single action to its default binding.
   */
  public resetBinding(id: ActionID): void {
    delete this.overrides[id]
    this.save()
  }

  /**
   * Reset all overrides (restore all defaults).
   */
  public resetAll(): void {
    this.overrides = {}
    this.save()
  }

  /**
   * Check if a specific action has a user override.
   */
  public hasOverride(id: ActionID): boolean {
    return id in this.overrides
  }

  /**
   * Get the default binding for an action (ignoring overrides).
   */
  public getDefaultBinding(id: ActionID): Keybinding | null {
    return ActionDefinitionMap.get(id)?.defaultBinding ?? null
  }

  /**
   * Find all conflicts in the current effective bindings.
   */
  public getConflicts(): ReadonlyArray<HotkeyConflict> {
    const bindingToActions = new Map<string, string[]>()

    this.effectiveBindings.forEach((binding, actionId) => {
      if (!binding) return
      const normalized = normalizeAccelerator(binding)
      const existing = bindingToActions.get(normalized) ?? []
      existing.push(actionId)
      bindingToActions.set(normalized, existing)
    })

    const conflicts: HotkeyConflict[] = []
    bindingToActions.forEach((actions, binding) => {
      if (actions.length > 1) {
        conflicts.push({ binding, actions })
      }
    })
    return conflicts
  }

  /**
   * Find conflicts for a specific binding.
   */
  public getConflictsForBinding(binding: Keybinding): HotkeyConflict[] {
    const normalized = normalizeAccelerator(binding)
    const conflicting: string[] = []

    this.effectiveBindings.forEach((existingBinding, actionId) => {
      if (!existingBinding) return
      if (areAcceleratorsEqual(existingBinding, binding)) {
        conflicting.push(actionId)
      }
    })

    if (conflicting.length > 1) {
      return [{ binding: normalized, actions: conflicting }]
    }
    return []
  }

  /**
   * Register a change listener. Returns a dispose function.
   */
  public onDidChange(listener: () => void): () => void {
    this.listeners.push(listener)
    return () => {
      const idx = this.listeners.indexOf(listener)
      if (idx >= 0) this.listeners.splice(idx, 1)
    }
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener()
    }
  }
}
