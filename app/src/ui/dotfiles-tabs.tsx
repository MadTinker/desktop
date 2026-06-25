import * as React from 'react'

import * as ipcRenderer from '../lib/ipc-renderer'
import { IDotfileDescriptor } from '../lib/dotfiles'
import { CodeMirrorEditor } from './code-mirror-editor'

interface IDotfilesTabsProps {
  readonly repositoryPath: string
}

interface IDotfilesTabsState {
  readonly descriptors: ReadonlyArray<IDotfileDescriptor>
  readonly contents: { readonly [id: string]: string }
  readonly dirty: { readonly [id: string]: boolean }
  readonly activeId: string | null
  readonly loaded: boolean
  readonly error: string | null
}

/**
 * Fixed-tab editor for the user's dotfiles + the current repo's git config.
 * Mirrors `TerminalTabs`: every editor stays mounted (visibility via `display`)
 * so switching tabs never discards an unsaved buffer or the cursor position.
 */
export class DotfilesTabs extends React.Component<
  IDotfilesTabsProps,
  IDotfilesTabsState
> {
  private readonly editorRefs = new Map<
    string,
    React.RefObject<CodeMirrorEditor>
  >()

  public constructor(props: IDotfilesTabsProps) {
    super(props)
    this.state = {
      descriptors: [],
      contents: {},
      dirty: {},
      activeId: null,
      loaded: false,
      error: null,
    }
  }

  public async componentDidMount() {
    try {
      const descriptors = await ipcRenderer.invoke(
        'dotfile-list',
        this.props.repositoryPath
      )

      const loaded = await Promise.all(
        descriptors.map(d =>
          ipcRenderer
            .invoke('dotfile-read', this.props.repositoryPath, d.id)
            .then(text => [d.id, text] as const)
        )
      )

      const contents: { [id: string]: string } = {}
      for (const [id, text] of loaded) {
        contents[id] = text
        this.editorRefs.set(id, React.createRef<CodeMirrorEditor>())
      }

      this.setState({
        descriptors,
        contents,
        activeId: descriptors[0]?.id ?? null,
        loaded: true,
      })
    } catch (err) {
      this.setState({
        loaded: true,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  private onSelectTab = (id: string) => {
    this.setState({ activeId: id })
  }

  private onEditorChange = (id: string) => {
    if (!this.state.dirty[id]) {
      this.setState(s => ({ dirty: { ...s.dirty, [id]: true } }))
    }
  }

  private saveTab = async (id: string) => {
    const editor = this.editorRefs.get(id)?.current
    if (editor == null) {
      return
    }

    try {
      await ipcRenderer.invoke(
        'dotfile-write',
        this.props.repositoryPath,
        id,
        editor.getValue()
      )
      this.setState(s => ({ dirty: { ...s.dirty, [id]: false } }))
    } catch (err) {
      this.setState({
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  public render() {
    const { descriptors, contents, dirty, activeId, loaded, error } = this.state

    if (!loaded) {
      return <div className="dotfiles-tabs is-loading">Loading dotfiles…</div>
    }

    if (error !== null && descriptors.length === 0) {
      return <div className="dotfiles-tabs is-error">{error}</div>
    }

    return (
      <div className="dotfiles-tabs">
        <div className="dotfiles-tabs-bar">
          {descriptors.map(d => (
            <div
              key={d.id}
              className={`dotfiles-tabs-tab${
                d.id === activeId ? ' is-active' : ''
              }${dirty[d.id] ? ' is-dirty' : ''}`}
              onClick={() => this.onSelectTab(d.id)}
              title={d.path}
            >
              <span className="dotfiles-tabs-tab-label">{d.label}</span>
              <span className="dotfiles-tabs-tab-dot" aria-hidden="true" />
            </div>
          ))}
        </div>
        {error !== null && <div className="dotfiles-tabs-error">{error}</div>}
        <div className="dotfiles-tabs-content">
          {descriptors.map(d => (
            <div
              key={d.id}
              className="dotfiles-tabs-pane"
              style={{ display: d.id === activeId ? 'flex' : 'none' }}
            >
              <CodeMirrorEditor
                ref={this.editorRefs.get(d.id)}
                initialValue={contents[d.id] ?? ''}
                mode={d.mode}
                isVisible={d.id === activeId}
                onChange={() => this.onEditorChange(d.id)}
                onSave={() => this.saveTab(d.id)}
              />
            </div>
          ))}
        </div>
      </div>
    )
  }
}
