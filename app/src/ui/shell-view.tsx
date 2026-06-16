import * as React from 'react'
import {
  IDisposable,
  ITerminalOptions,
  Terminal as XTermTerminal,
} from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import * as ipcRenderer from '../lib/ipc-renderer'
import { getMonospaceFontFamily } from './get-monospace-font-family'

interface IShellViewProps {
  readonly cwd: string
  readonly fontSize?: number
  readonly cursorBlink?: boolean
  readonly scrollback?: number
}

interface IShellViewState {
  readonly error: string | null
}

const defaultCols = 80
const defaultRows = 24

function buildTerminalOptions(props: IShellViewProps): ITerminalOptions {
  return {
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
  private terminal: XTermTerminal | null = null
  private fitAddon: FitAddon | null = null
  private terminalID: string | null = null
  private resizeObserver: ResizeObserver | null = null
  private terminalInputDisposable: IDisposable | null = null
  private pendingResizeAnimationFrame: number | null = null
  private unmounted = false

  public constructor(props: IShellViewProps) {
    super(props)
    this.state = { error: null }
  }

  public componentDidMount() {
    this.terminal = new XTermTerminal(buildTerminalOptions(this.props))
    this.fitAddon = new FitAddon()
    this.terminal.loadAddon(this.fitAddon)

    if (this.terminalRef.current) {
      this.terminal.open(this.terminalRef.current)
      this.terminal.focus()
      this.fitTerminal()
      this.resizeObserver = new ResizeObserver(this.onResize)
      this.resizeObserver.observe(this.terminalRef.current)
    }

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

  public render() {
    return (
      <div className="shell-view">
        <div className="shell-view-terminal" ref={this.terminalRef} />
        {this.state.error !== null && (
          <div className="shell-view-error">{this.state.error}</div>
        )}
      </div>
    )
  }
}
