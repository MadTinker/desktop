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

        <div className="keybinding-editor-actions">
          <button
            className="button-component"
            onClick={this.onConfirm}
            onMouseDown={this.onButtonMouseDown}
            disabled={!capturedBinding}
          >
            Save
          </button>
          <button
            className="button-component"
            onClick={this.onClear}
            onMouseDown={this.onButtonMouseDown}
          >
            Unbind
          </button>
          <button
            className="button-component"
            onClick={this.props.onCancel}
            onMouseDown={this.onButtonMouseDown}
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  private onKeyDown = (event: React.KeyboardEvent) => {
    event.preventDefault()
    event.stopPropagation()

    if (event.key === 'Escape') {
      this.props.onCancel()
      return
    }

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

  private onButtonMouseDown = (event: React.MouseEvent) => {
    // Prevent button clicks from stealing focus from capture div
    event.preventDefault()
  }

  private onBlur = () => {
    // Cancel capture when focus leaves the editor entirely
    // (onButtonMouseDown prevents blur from our own buttons)
    this.props.onCancel()
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
