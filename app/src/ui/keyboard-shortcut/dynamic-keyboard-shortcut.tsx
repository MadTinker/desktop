import * as React from 'react'
import { HotkeyStore, acceleratorToDisplayString } from '../../lib/hotkeys'
import { ActionID } from '../../lib/hotkeys/hotkey-types'

interface IDynamicKeyboardShortcutProps {
  /** The action ID to look up the current binding for */
  readonly actionId: ActionID
  /** The hotkey store instance to read from */
  readonly hotkeyStore: HotkeyStore
}

/**
 * Renders the current keybinding for an action from the HotkeyStore.
 * Automatically reflects user customizations.
 * Falls back to rendering nothing if the action is unbound.
 */
export class DynamicKeyboardShortcut extends React.Component<IDynamicKeyboardShortcutProps> {
  public render() {
    const binding = this.props.hotkeyStore.getEffectiveBinding(
      this.props.actionId
    )

    if (!binding) {
      return null
    }

    const display = acceleratorToDisplayString(binding, __DARWIN__)
    const parts = __DARWIN__
      ? Array.from(display)
      : display.split('+')

    return (
      <>
        {parts.map((k, i) => (
          <React.Fragment key={k + i}>
            <kbd>{k}</kbd>
            {!__DARWIN__ && i < parts.length - 1 ? <>+</> : null}
          </React.Fragment>
        ))}
      </>
    )
  }
}
