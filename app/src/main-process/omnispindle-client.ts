import { WebContents } from 'electron'
import { send } from './ipc-webcontents'
import {
  IOmnispindleTodo,
  OmnispindleConnectionStatus,
} from '../models/omnispindle'

const OMNISPINDLE_URL = 'https://madnessinteractive.cc/api/mcp/'
const DEFAULT_POLL_INTERVAL = 60_000

interface IOmnispindleClientOptions {
  readonly apiKey: string
  readonly pollInterval?: number
  readonly getWebContents: () => WebContents | null
}

export class OmnispindleClient {
  private timer: ReturnType<typeof setTimeout> | null = null
  private apiKey: string
  private pollInterval: number
  private readonly getWebContents: () => WebContents | null

  public constructor(opts: IOmnispindleClientOptions) {
    this.apiKey = opts.apiKey
    this.pollInterval = opts.pollInterval ?? DEFAULT_POLL_INTERVAL
    this.getWebContents = opts.getWebContents
  }

  public start() {
    this.stop()
    this.poll()
  }

  public stop() {
    if (this.timer !== null) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }

  public update(apiKey: string, pollInterval: number) {
    this.apiKey = apiKey
    this.pollInterval = pollInterval
    this.start()
  }

  private schedule() {
    this.timer = setTimeout(() => this.poll(), this.pollInterval)
  }

  private async poll() {
    const { todos, status } = await this.fetchTodos()
    const wc = this.getWebContents()
    if (wc !== null) {
      send(wc, 'omnispindle-todos-updated', todos, status)
    }
    this.schedule()
  }

  private async fetchTodos(): Promise<{
    todos: ReadonlyArray<IOmnispindleTodo>
    status: OmnispindleConnectionStatus
  }> {
    if (!this.apiKey) {
      return { todos: [], status: 'unconfigured' }
    }

    try {
      const body = JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'query_todos',
          arguments: { status: 'active', limit: 50 },
        },
      })

      const response = await fetch(OMNISPINDLE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body,
      })

      if (!response.ok) {
        log.error(`[omnispindle] HTTP ${response.status}`)
        return { todos: [], status: 'error' }
      }

      const json = await response.json()
      const result = json?.result

      if (!result) {
        log.error('[omnispindle] unexpected response shape', json)
        return { todos: [], status: 'error' }
      }

      const raw: Array<any> = Array.isArray(result)
        ? result
        : Array.isArray(result?.todos)
          ? result.todos
          : []

      const todos: ReadonlyArray<IOmnispindleTodo> = raw.map(t => ({
        id: String(t._id ?? t.id ?? Math.random()),
        title: String(t.title ?? t.name ?? ''),
        status: String(t.status ?? ''),
        project: t.project ? String(t.project) : undefined,
        priority: typeof t.priority === 'number' ? t.priority : undefined,
      }))

      return { todos, status: 'connected' }
    } catch (err) {
      log.error('[omnispindle] fetch failed', err)
      return { todos: [], status: 'error' }
    }
  }
}
