import * as pty from '@lydell/node-pty'
import * as ipcWebContents from './ipc-webcontents'
import type { ITerminalSpawnOptions } from '../lib/ipc-shared'

interface ITerminalRecord {
  readonly ptyProcess: pty.IPty
  readonly webContents: Electron.WebContents
  readonly onWebContentsDestroyed: () => void
  readonly disposables: ReadonlyArray<pty.IDisposable>
}

export class PtyManager {
  private nextTerminalID = 1
  private readonly terminals = new Map<string, ITerminalRecord>()

  public spawn(
    webContents: Electron.WebContents,
    options: ITerminalSpawnOptions
  ): string {
    const id = String(this.nextTerminalID++)
    const ptyProcess = pty.spawn(getShell(options.shell), getShellArgs(), {
      name: 'xterm-256color',
      cols: options.cols,
      rows: options.rows,
      cwd: options.cwd,
      env: createEnvironment(options.cwd),
    })

    const disposables = [
      ptyProcess.onData(data => {
        if (!webContents.isDestroyed()) {
          ipcWebContents.send(webContents, 'terminal-data', id, data)
        }
      }),
      ptyProcess.onExit(event => {
        if (!webContents.isDestroyed()) {
          ipcWebContents.send(webContents, 'terminal-exit', id, event.exitCode)
        }
        this.unregister(id)
      }),
    ]

    const onWebContentsDestroyed = () => this.kill(id)
    webContents.once('destroyed', onWebContentsDestroyed)

    this.terminals.set(id, {
      ptyProcess,
      webContents,
      onWebContentsDestroyed,
      disposables,
    })

    return id
  }

  public write(id: string, data: string): void {
    this.terminals.get(id)?.ptyProcess.write(data)
  }

  public resize(id: string, cols: number, rows: number): void {
    if (cols <= 0 || rows <= 0) {
      return
    }

    this.terminals.get(id)?.ptyProcess.resize(cols, rows)
  }

  public kill(id: string): void {
    const record = this.terminals.get(id)
    if (!record) {
      return
    }

    try {
      record.ptyProcess.kill()
    } catch (error) {
      log.warn(`[PtyManager] failed to kill terminal ${id}`, error)
    } finally {
      this.unregister(id)
    }
  }

  public killAll(): void {
    for (const id of Array.from(this.terminals.keys())) {
      this.kill(id)
    }
  }

  private unregister(id: string): void {
    const record = this.terminals.get(id)
    if (!record) {
      return
    }

    this.terminals.delete(id)

    for (const disposable of record.disposables) {
      disposable.dispose()
    }

    if (!record.webContents.isDestroyed()) {
      record.webContents.removeListener(
        'destroyed',
        record.onWebContentsDestroyed
      )
    }
  }
}

function getShell(shell?: string): string {
  if (shell) {
    return shell
  }

  if (__WIN32__) {
    return process.env.COMSPEC || 'cmd.exe'
  }

  return process.env.SHELL || '/bin/bash'
}

function getShellArgs(): string[] {
  // Login shell on macOS/Linux loads .zshrc/.bash_profile etc.
  return __WIN32__ ? [] : ['-l']
}

function createEnvironment(cwd: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    COLORTERM: process.env.COLORTERM || 'truecolor',
    PWD: cwd,
    TERM: 'xterm-256color',
    TERM_PROGRAM: 'Madness Desktop',
  }
}
