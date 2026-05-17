import * as React from 'react'
import {
  keyEventToAccelerator,
  isReservedBinding,
  acceleratorToDisplayString,
} from '../../lib/hotkeys'
import { Keybinding } from '../../lib/hotkeys/hotkey-types'

interface IKeybindingEditorProps {
  readonly currentBinding: Keybinding | null
  readonly onBindingCaptured: (binding: Keybinding | null) => void
  readonly onCancel: () => void
  readonly conflictLabel?: string
}

interface IKeybindingEditorState {
  readonly capturedBinding: Keybinding | null
  readonly isCapturing: boolean
  readonly error: string | null
}

export class KeybindingEditor extends React.Component<
  IKeybindingEditorProps,
  IKeybindingEditorState
> {
  private captureRef = React.createRef<HTMLDivElement>()

  public constructor(props: IKeybindingEditorProps) {
    super(props)
    this.state = {
      capturedBinding: null,
      isCapturing: true,
      error: null,
    }
  }

  public componentDidMount() {
    this.captureRef.current?.focus()
  }

  public render() {
    const { capturedBinding, isCapturing, error } = this.state
    const displayBinding = capturedBinding
      ? acceleratorToDisplayString(capturedBinding, __DARWIN__)
      : null

    return (
      <div className="keybinding-editor">
        <div
          className={`keybinding-capture ${isCapturing ? 'active' : ''}`}
          ref={this.captureRef}
          tabIndex={0}
          onKeyDown={this.onKeyDown}
          onBlur={this.onBlur}
        >
          {isCapturing && !capturedBinding && (
            <span className="capture-prompt">Press keys…</span>
          )}
          {capturedBinding && (
            <span className="captured-keys">{displayBinding}</span>
          )}
        </div>

        {error && <div className="keybinding-error">{error}</div>}

        {this.props.conflictLabel && capturedBinding && (
          <div className="keybinding-conflict">
            Conflicts with: <strong>{this.props.conflictLabel}</strong>
          </div>
        )}

        <div className="keybinding-editor-actions">
          <button
            className="button-component"
            onClick={this.onConfirm}
            disabled={!capturedBinding}
          >
            Save
          </button>
          <button className="button-component" onClick={this.onClear}>
            Unbind
          </button>
          <button className="button-component" onClick={this.props.onCancel}>
            Cancel
          </button>
        </div>
      </div>
    )
  }

  private onKeyDown = (event: React.KeyboardEvent) => {
    event.preventDefault()
    event.stopPropagation()

    const binding = keyEventToAccelerator(event.nativeEvent)
    if (!binding) {
      return
    }

    if (isReservedBinding(binding)) {
      this.setState({
        error: `${acceleratorToDisplayString(binding, __DARWIN__)} is reserved by the system`,
        capturedBinding: null,
      })
      return
    }

    this.setState({
      capturedBinding: binding,
      error: null,
    })
  }

  private onBlur = () => {
    // Keep focus when clicking editor buttons
  }

  private onConfirm = () => {
    if (this.state.capturedBinding) {
      this.props.onBindingCaptured(this.state.capturedBinding)
    }
  }

  private onClear = () => {
    this.props.onBindingCaptured(null)
  }
}
