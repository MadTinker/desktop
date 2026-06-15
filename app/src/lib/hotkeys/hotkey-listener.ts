import { ActionContext, ActionID, Keybinding } from './hotkey-types'
import { ActionDefinitionMap } from './default-bindings'
import { keyEventToNormalizedAccelerator, normalizeAccelerator } from './accelerator-utils'

/**
 * Renderer-side keyboard listener for non-menu hotkey actions.
 * Handles actions that don't have Electron menu accelerators.
 */
export class HotkeyListener {
  /** Normalized accelerator string → action ID */
  private bindingMap: Map<string, ActionID> = new Map()
  private contextProvider: () => ActionContext
  private actionHandler: (id: ActionID) => void
  private handler: ((event: KeyboardEvent) => void) | null = null

  constructor(opts: {
    contextProvider: () => ActionContext
    actionHandler: (id: ActionID) => void
  }) {
    this.contextProvider = opts.contextProvider
    this.actionHandler = opts.actionHandler
    this.handler = this.handleKeyDown.bind(this)
    window.addEventListener('keydown', this.handler, true)
  }

  /**
   * Update the set of active non-menu bindings.
   * Call this whenever the HotkeyStore changes.
   */
  public updateBindings(bindings: Map<string, Keybinding | null>): void {
    this.bindingMap.clear()
    bindings.forEach((binding, actionId) => {
      if (binding) {
        this.bindingMap.set(normalizeAccelerator(binding), actionId)
      }
    })
  }

  private handleKeyDown(event: KeyboardEvent): void {
    // Don't interfere with already-handled events
    if (event.defaultPrevented) {
      return
    }

    const accelerator = keyEventToNormalizedAccelerator(event)
    if (!accelerator) {
      return
    }

    const actionId = this.bindingMap.get(accelerator)
    if (!actionId) {
      return
    }

    const def = ActionDefinitionMap.get(actionId)

    // Global-context actions fire even when an input is focused (e.g.
    // repo-history navigation should work regardless of filter focus).
    // All other actions are suppressed while the user is typing.
    if (def?.context !== 'global' && this.isInputFocused(event)) {
      return
    }

    // Check context: action must be valid in current app context
    if (!this.isContextValid(actionId)) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    this.actionHandler(actionId)
  }

  private isInputFocused(event: KeyboardEvent): boolean {
    const target = event.target as HTMLElement | null
    if (!target) {
      return false
    }

    const tagName = target.tagName.toLowerCase()
    if (tagName === 'input' || tagName === 'textarea') {
      return true
    }

    if (target.isContentEditable) {
      return true
    }

    return false
  }

  private isContextValid(actionId: ActionID): boolean {
    const def = ActionDefinitionMap.get(actionId)
    if (!def) {
      return true // unknown actions always fire
    }

    if (def.context === 'global') {
      return true
    }

    const currentContext = this.contextProvider()

    // 'repository' context matches any repo-level context
    if (def.context === 'repository') {
      return (
        currentContext === 'repository' ||
        currentContext === 'changes-tab' ||
        currentContext === 'history-tab' ||
        currentContext === 'diff-view'
      )
    }

    return currentContext === def.context
  }

  public dispose(): void {
    if (this.handler) {
      window.removeEventListener('keydown', this.handler, true)
      this.handler = null
    }
  }
}
