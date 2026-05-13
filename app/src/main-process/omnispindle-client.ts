import { WebContents } from 'electron'
import { send } from './ipc-webcontents'
import {
  IOmnispindleTodo,
  OmnispindleConnectionStatus,
  OmnispindleTestResult,
} from '../models/omnispindle'

const OMNISPINDLE_API_URL = 'https://madnessinteractive.cc/api'

export class OmnispindleClient {
  private apiKey: string = ''
  private readonly getWebContents: () => WebContents | null

  public constructor(getWebContents: () => WebContents | null) {
    this.getWebContents = getWebContents
  }

  public setApiKey(apiKey: string) {
    this.apiKey = apiKey
  }

  public async testConnection(apiKey: string): Promise<OmnispindleTestResult> {
    if (!apiKey) {
      return { status: 'unconfigured', message: 'No API key provided' }
    }
    try {
      const response = await fetch(
        `${OMNISPINDLE_API_URL}/todos?status=pending&limit=1`,
        {
          headers: { Authorization: `Bearer ${apiKey}` },
        }
      )
      if (response.status === 401) {
        return { status: 'error', message: 'Invalid API key (401 Unauthorized)' }
      }
      if (!response.ok) {
        return { status: 'error', message: `Server returned HTTP ${response.status}` }
      }
      const json = await response.json()
      if (!Array.isArray(json?.todos)) {
        const raw = JSON.stringify(json).substring(0, 120)
        return { status: 'error', message: `Unexpected response: ${raw}` }
      }
      return { status: 'connected', message: 'Connected successfully' }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return { status: 'error', message: `Network error: ${msg}` }
    }
  }

  /**
   * Fire an event into Inventorium's automation bus.
   * Non-blocking — failures are logged but never thrown.
   */
  public async fireEvent(
    trigger: string,
    data: Record<string, unknown> = {},
    meta: Record<string, unknown> = {}
  ): Promise<void> {
    if (!this.apiKey) {
      return
    }
    try {
      const response = await fetch(
        `${OMNISPINDLE_API_URL}/automation/events`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            trigger,
            data,
            meta: { ...meta, source: 'madness-desktop' },
          }),
        }
      )
      if (!response.ok) {
        log.warn(`[omnispindle] event fire failed: HTTP ${response.status}`)
      }
    } catch (err) {
      log.warn('[omnispindle] event fire error:', err)
    }
  }

  public async refresh(project?: string) {
    const { todos, status } = await this.fetchTodos(project)
    const wc = this.getWebContents()
    if (wc !== null) {
      send(wc, 'omnispindle-todos-updated', todos, status)
    }
  }

  private async fetchTodos(project?: string): Promise<{
    todos: ReadonlyArray<IOmnispindleTodo>
    status: OmnispindleConnectionStatus
  }> {
    if (!this.apiKey) {
      return { todos: [], status: 'unconfigured' }
    }

    try {
      const params = new URLSearchParams({ status: 'pending', limit: '50' })
      if (project) {
        params.set('project', project)
      }
      const response = await fetch(
        `${OMNISPINDLE_API_URL}/todos?${params}`,
        {
          headers: { Authorization: `Bearer ${this.apiKey}` },
        }
      )

      if (!response.ok) {
        log.error(`[omnispindle] HTTP ${response.status}`)
        return { todos: [], status: 'error' }
      }

      const json = await response.json()
      const raw: Array<any> = Array.isArray(json?.todos) ? json.todos : []

      if (!raw.length && json?.todos === undefined) {
        log.error('[omnispindle] unexpected response shape', json)
        return { todos: [], status: 'error' }
      }

      const todos: ReadonlyArray<IOmnispindleTodo> = raw.map(t => ({
        id: String(t.id ?? t._id ?? Math.random()),
        title: String(t.description ?? t.title ?? t.name ?? ''),
        status: String(t.status ?? ''),
        project: t.project ? String(t.project) : undefined,
        priority: t.priority ? String(t.priority) : undefined,
        notes: t.notes ? String(t.notes) : undefined,
        createdAt: typeof t.created_at === 'number' ? t.created_at : undefined,
      }))

      return { todos, status: 'connected' }
    } catch (err) {
      log.error('[omnispindle] fetch failed', err)
      return { todos: [], status: 'error' }
    }
  }
}
