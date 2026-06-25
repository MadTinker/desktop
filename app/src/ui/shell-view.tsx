import * as React from 'react'
import {
  IDisposable,
  ITerminalOptions,
  Terminal as XTermTerminal,
} from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebglAddon } from '@xterm/addon-webgl'
import { SearchAddon } from '@xterm/addon-search'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { Unicode11Addon } from '@xterm/addon-unicode11'
import * as ipcRenderer from '../lib/ipc-renderer'
import { getMonospaceFontFamily } from './get-monospace-font-family'

interface IShellViewProps {
  readonly cwd: string
  readonly fontSize?: number
  readonly cursorBlink?: boolean
  readonly scrollback?: number
  readonly initialCommand?: string
}

interface IShellViewState {
  readonly error: string | null
  readonly showSearch: boolean
  readonly searchTerm: string
}

const defaultCols = 80
const defaultRows = 24

function buildTerminalOptions(props: IShellViewProps): ITerminalOptions {
  return {
    allowProposedApi: true,
    cursorBlink: props.cursorBlink ?? true,
    fontFamily: getMonospaceFontFamily(),
    fontSize: props.fontSize ?? 12,
    screenReaderMode: true,
    scrollback: props.scrollback ?? 5000,
    theme: {
      background: '#00000000',
    },
  }
}

export class ShellView extends React.Component<
  IShellViewProps,
  IShellViewState
> {
  private readonly terminalRef = React.createRef<HTMLDivElement>()
  private readonly searchInputRef = React.createRef<HTMLInputElement>()
  private terminal: XTermTerminal | null = null
  private fitAddon: FitAddon | null = null
  private searchAddon: SearchAddon | null = null
  private terminalID: string | null = null
  private resizeObserver: ResizeObserver | null = null
  private terminalInputDisposable: IDisposable | null = null
  private pendingResizeAnimationFrame: number | null = null
  private unmounted = false

  public constructor(props: IShellViewProps) {
    super(props)
    this.state = { error: null, showSearch: false, searchTerm: '' }
  }

  public componentDidMount() {
    this.terminal = new XTermTerminal(buildTerminalOptions(this.props))

    this.fitAddon = new FitAddon()
    this.terminal.loadAddon(this.fitAddon)

    const searchAddon = new SearchAddon()
    this.searchAddon = searchAddon
    this.terminal.loadAddon(searchAddon)

    this.terminal.loadAddon(
      new WebLinksAddon((_e, uri) => {
        ipcRenderer.invoke('open-external', uri)
      })
    )

    const unicode11Addon = new Unicode11Addon()
    this.terminal.loadAddon(unicode11Addon)

    if (this.terminalRef.current) {
      this.terminal.open(this.terminalRef.current)

      // WebGL renderer — fall back to canvas on context loss or init failure
      try {
        const webglAddon = new WebglAddon()
        webglAddon.onContextLoss(() => webglAddon.dispose())
        this.terminal.loadAddon(webglAddon)
      } catch {
        // canvas renderer continues
      }

      this.terminal.unicode.activeVersion = '11'
      this.terminal.focus()
      this.fitTerminal()
      this.resizeObserver = new ResizeObserver(this.onResize)
      this.resizeObserver.observe(this.terminalRef.current)
    }

    this.terminal.attachCustomKeyEventHandler(e => {
      if (e.type !== 'keydown') {
        return true
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        this.setState({ showSearch: true }, () =>
          this.searchInputRef.current?.focus()
        )
        return false
      }
      if (e.key === 'Escape' && this.state.showSearch) {
        this.closeSearch()
        return false
      }
      return true
    })

    ipcRenderer.on('terminal-data', this.onTerminalData)
    ipcRenderer.on('terminal-exit', this.onTerminalExit)

    this.spawn()
  }

  public componentWillUnmount() {
    this.unmounted = true

    ipcRenderer.removeListener('terminal-data', this.onTerminalData)
    ipcRenderer.removeListener('terminal-exit', this.onTerminalExit)

    if (this.pendingResizeAnimationFrame !== null) {
      cancelAnimationFrame(this.pendingResizeAnimationFrame)
      this.pendingResizeAnimationFrame = null
    }

    this.resizeObserver?.disconnect()
    this.resizeObserver = null

    this.terminalInputDisposable?.dispose()
    this.terminalInputDisposable = null

    if (this.terminalID !== null) {
      ipcRenderer.send('terminal-kill', this.terminalID)
      this.terminalID = null
    }

    this.searchAddon = null
    this.fitAddon?.dispose()
    this.fitAddon = null
    this.terminal?.dispose()
    this.terminal = null
  }

  private async spawn() {
    const dimensions = this.fitAddon?.proposeDimensions()
    const cols = dimensions?.cols ?? defaultCols
    const rows = dimensions?.rows ?? defaultRows

    try {
      const id = await ipcRenderer.invoke('terminal-spawn', {
        cwd: this.props.cwd,
        cols,
        rows,
      })

      if (this.unmounted) {
        ipcRenderer.send('terminal-kill', id)
        return
      }

      this.terminalID = id
      this.terminalInputDisposable =
        this.terminal?.onData(data => {
          if (this.terminalID !== null) {
            ipcRenderer.send('terminal-input', this.terminalID, data)
          }
        }) ?? null

      ipcRenderer.send('terminal-resize', id, cols, rows)

      if (this.props.initialCommand) {
        ipcRenderer.send('terminal-input', id, this.props.initialCommand + '\r')
      }
    } catch (error) {
      if (this.unmounted) {
        return
      }

      const message =
        error instanceof Error ? error.message : 'Unable to start terminal'
      this.setState({ error: message })
    }
  }

  private onTerminalData = (id: string, data: string) => {
    if (id === this.terminalID) {
      this.terminal?.write(data)
    }
  }

  private onTerminalExit = (id: string, code: number) => {
    if (id !== this.terminalID) {
      return
    }

    this.terminalID = null
    this.terminal?.writeln('')
    this.terminal?.writeln(`[process exited with code ${code}]`)
  }

  private onResize = () => {
    if (this.pendingResizeAnimationFrame !== null) {
      return
    }

    this.pendingResizeAnimationFrame = requestAnimationFrame(() => {
      this.pendingResizeAnimationFrame = null
      this.fitTerminal()
    })
  }

  private fitTerminal() {
    if (!this.fitAddon || !this.terminal) {
      return
    }

    this.fitAddon.fit()

    if (this.terminalID !== null) {
      ipcRenderer.send(
        'terminal-resize',
        this.terminalID,
        this.terminal.cols,
        this.terminal.rows
      )
    }
  }

  private onSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const searchTerm = e.target.value
    this.setState({ searchTerm })
    if (searchTerm) {
      this.searchAddon?.findNext(searchTerm, { incremental: true })
    }
  }

  private onSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (e.shiftKey) {
        this.searchAddon?.findPrevious(this.state.searchTerm)
      } else {
        this.searchAddon?.findNext(this.state.searchTerm)
      }
    } else if (e.key === 'Escape') {
      this.closeSearch()
    }
  }

  private closeSearch = () => {
    this.setState({ showSearch: false, searchTerm: '' })
    this.terminal?.focus()
  }

  public render() {
    return (
      <div className="shell-view">
        <div className="shell-view-terminal" ref={this.terminalRef} />
        {this.state.showSearch && (
          <div className="shell-view-search">
            <input
              ref={this.searchInputRef}
              type="text"
              value={this.state.searchTerm}
              onChange={this.onSearchChange}
              onKeyDown={this.onSearchKeyDown}
              placeholder="Find in terminal…"
              className="shell-view-search-input"
            />
            <button
              type="button"
              onClick={() =>
                this.searchAddon?.findPrevious(this.state.searchTerm)
              }
              aria-label="Previous result"
              className="shell-view-search-nav"
            >
              ↑
            </button>
            <button
              type="button"
              onClick={() =>
                this.searchAddon?.findNext(this.state.searchTerm)
              }
              aria-label="Next result"
              className="shell-view-search-nav"
            >
              ↓
            </button>
            <button
              type="button"
              onClick={this.closeSearch}
              aria-label="Close search"
              className="shell-view-search-close"
            >
              ✕
            </button>
          </div>
        )}
        {this.state.error !== null && (
          <div className="shell-view-error">{this.state.error}</div>
        )}
      </div>
    )
  }
}
