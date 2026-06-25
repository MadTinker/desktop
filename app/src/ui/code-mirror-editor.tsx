import * as React from 'react'
import CodeMirror from 'codemirror/lib/codemirror.js'
import 'codemirror/mode/shell/shell'
import 'codemirror/mode/properties/properties'

import { DotfileMode } from '../lib/dotfiles'

interface ICodeMirrorEditorProps {
  /** Seed value — applied once on mount; CodeMirror owns the buffer after. */
  readonly initialValue: string
  readonly mode: DotfileMode
  /**
   * Whether this editor's pane is currently visible. CodeMirror mis-measures
   * while `display: none`, so we refresh on the hidden -> visible transition.
   */
  readonly isVisible: boolean
  readonly readOnly?: boolean
  readonly onChange?: (value: string) => void
  readonly onSave?: () => void
}

const MODE_MIME: Record<DotfileMode, string> = {
  shell: 'text/x-sh',
  properties: 'properties',
}

/**
 * A thin React wrapper around the full CodeMirror 5 editor for the Dotfiles
 * panel. The component deliberately does NOT drive `value` as a controlled
 * prop — CodeMirror owns the buffer, which is what preserves the cursor,
 * scroll, and unsaved edits across re-renders and pane visibility toggles.
 */
export class CodeMirrorEditor extends React.Component<ICodeMirrorEditorProps> {
  private readonly hostRef = React.createRef<HTMLDivElement>()
  private cm: ReturnType<typeof CodeMirror> | null = null

  public componentDidMount() {
    const host = this.hostRef.current
    if (host === null) {
      return
    }

    const cm = CodeMirror(host, {
      value: this.props.initialValue,
      mode: MODE_MIME[this.props.mode],
      lineNumbers: true,
      lineWrapping: false,
      readOnly: this.props.readOnly ?? false,
      extraKeys: {
        'Cmd-S': () => this.props.onSave?.(),
        'Ctrl-S': () => this.props.onSave?.(),
      },
    })

    cm.on('change', instance => this.props.onChange?.(instance.getValue()))
    this.cm = cm

    if (this.props.isVisible) {
      cm.refresh()
    }
  }

  public componentDidUpdate(prevProps: ICodeMirrorEditorProps) {
    // Became visible — re-measure, since sizing while hidden is unreliable.
    if (this.cm !== null && this.props.isVisible && !prevProps.isVisible) {
      this.cm.refresh()
    }
  }

  public componentWillUnmount() {
    this.cm?.getWrapperElement().remove()
    this.cm = null
  }

  /** Imperative read used by the parent on save. */
  public getValue(): string {
    return this.cm?.getValue() ?? this.props.initialValue
  }

  public render() {
    return <div className="code-mirror-editor" ref={this.hostRef} />
  }
}
