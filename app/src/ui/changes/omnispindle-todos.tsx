import * as React from 'react'
import { IOmnispindleTodo, OmnispindleConnectionStatus } from '../../models/omnispindle'
import { Octicon } from '../octicons'
import * as octicons from '../octicons/octicons.generated'

const API_BASE = 'https://madnessinteractive.cc/api'

interface IOmnispindleTodosProps {
  readonly todos: ReadonlyArray<IOmnispindleTodo>
  readonly status: OmnispindleConnectionStatus
  readonly apiKey: string
  readonly onRefresh: () => void
}

interface IOmnispindleTodosState {
  readonly expanded: boolean
  readonly loading: boolean
  readonly adding: boolean
  readonly newDescription: string
  readonly newProject: string
  readonly newPriority: string
  readonly submitting: boolean
  readonly submitError: string | null
  readonly copiedId: string | null
  readonly selectedTodo: IOmnispindleTodo | null
  readonly lookupId: string
  readonly lookupLoading: boolean
  readonly lookupError: string | null
}

function statusIcon(status: OmnispindleConnectionStatus) {
  if (status === 'connected') return octicons.checkCircle
  if (status === 'error') return octicons.xCircle
  return octicons.plug
}

function statusLabel(status: OmnispindleConnectionStatus, count: number) {
  if (status === 'unconfigured') return 'click sync to fetch'
  if (status === 'error') return 'connection error'
  return `${count} todo${count === 1 ? '' : 's'}`
}

function priorityClass(priority?: string): string {
  switch ((priority ?? '').toLowerCase()) {
    case 'critical': return 'priority-critical'
    case 'high':     return 'priority-high'
    case 'medium':   return 'priority-medium'
    case 'low':      return 'priority-low'
    default:         return ''
  }
}

function statusBadgeClass(status: string): string {
  switch (status.toLowerCase()) {
    case 'in_progress': return 'badge-in-progress'
    case 'review':      return 'badge-review'
    case 'blocked':     return 'badge-blocked'
    case 'completed':   return 'badge-completed'
    default:            return 'badge-pending'
  }
}

export class OmnispindleTodos extends React.Component<
  IOmnispindleTodosProps,
  IOmnispindleTodosState
> {
  public constructor(props: IOmnispindleTodosProps) {
    super(props)
    this.state = {
      expanded: true,
      loading: false,
      adding: false,
      newDescription: '',
      newProject: '',
      newPriority: 'Medium',
      submitting: false,
      submitError: null,
      copiedId: null,
      selectedTodo: null,
      lookupId: '',
      lookupLoading: false,
      lookupError: null,
    }
  }

  public componentDidUpdate(prevProps: IOmnispindleTodosProps) {
    if (prevProps.status !== this.props.status && this.state.loading) {
      this.setState({ loading: false })
    }
  }

  private onToggle = () => {
    this.setState(prev => ({ expanded: !prev.expanded }))
  }

  private onRefresh = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    this.setState({ loading: true })
    this.props.onRefresh()
  }

  private onAddClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    this.setState(prev => ({
      adding: !prev.adding,
      newDescription: '',
      newProject: '',
      newPriority: 'Medium',
      submitError: null,
      expanded: true,
    }))
  }

  private onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const { newDescription, newProject, newPriority } = this.state
    if (!newDescription.trim() || !newProject.trim()) return

    this.setState({ submitting: true, submitError: null })
    try {
      const resp = await fetch(`${API_BASE}/todos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.props.apiKey}`,
        },
        body: JSON.stringify({
          description: newDescription.trim(),
          project: newProject.trim().toLowerCase(),
          priority: newPriority,
        }),
      })
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}))
        throw new Error(err.message || err.details || `HTTP ${resp.status}`)
      }
      this.setState({ adding: false, newDescription: '', newProject: '', submitting: false })
      this.props.onRefresh()
    } catch (err) {
      this.setState({
        submitting: false,
        submitError: err instanceof Error ? err.message : String(err),
      })
    }
  }

  private onCancel = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    this.setState({ adding: false, submitError: null })
  }

  private onTodoClick = (todo: IOmnispindleTodo) => {
    this.setState(prev => ({
      selectedTodo: prev.selectedTodo?.id === todo.id ? null : todo,
    }))
  }

  private onCloseDetail = () => {
    this.setState({ selectedTodo: null, lookupId: '', lookupError: null })
  }

  private onLookupChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    this.setState({ lookupId: e.target.value, lookupError: null })
  }

  private onLookupSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const id = this.state.lookupId.trim()
    if (!id) return
    this.setState({ lookupLoading: true, lookupError: null })
    try {
      const resp = await fetch(`${API_BASE}/todos/${encodeURIComponent(id)}`, {
        headers: { Authorization: `Bearer ${this.props.apiKey}` },
      })
      if (resp.status === 404) throw new Error('Todo not found')
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const t = await resp.json()
      this.setState({
        lookupLoading: false,
        selectedTodo: {
          id: String(t.id ?? t._id ?? id),
          title: String(t.description ?? t.title ?? ''),
          status: String(t.status ?? ''),
          project: t.project ? String(t.project) : undefined,
          priority: t.priority ? String(t.priority) : undefined,
          notes: t.notes ? String(t.notes) : undefined,
          createdAt: typeof t.created_at === 'number' ? t.created_at : undefined,
        },
      })
    } catch (err) {
      this.setState({
        lookupLoading: false,
        lookupError: err instanceof Error ? err.message : String(err),
      })
    }
  }

  private onTodoContextMenu = (
    e: React.MouseEvent<HTMLLIElement>,
    todo: IOmnispindleTodo
  ) => {
    e.preventDefault()
    navigator.clipboard.writeText(todo.id).then(() => {
      this.setState({ copiedId: todo.id })
      setTimeout(() => this.setState({ copiedId: null }), 1500)
    })
  }

  public render() {
    const { todos, status } = this.props
    const {
      expanded, loading, adding,
      newDescription, newProject, newPriority,
      submitting, submitError, copiedId, selectedTodo,
      lookupId, lookupLoading, lookupError,
    } = this.state
    const icon = statusIcon(status)
    const iconClass =
      status === 'error'     ? 'omnispindle-icon error' :
      status === 'connected' ? 'omnispindle-icon ok'    : 'omnispindle-icon'

    return (
      <div className="omnispindle-todos">
        <div className="omnispindle-header">
          <button className="omnispindle-toggle" onClick={this.onToggle}>
            <Octicon symbol={icon} className={iconClass} />
            <span className="omnispindle-title">Omnispindle</span>
            <span className="omnispindle-summary">
              {loading ? 'fetching…' : statusLabel(status, todos.length)}
            </span>
          </button>
          {status === 'connected' && (
            <button
              className={`omnispindle-add-btn${adding ? ' active' : ''}`}
              onClick={this.onAddClick}
              title={adding ? 'Cancel' : 'Add todo'}
            >
              <Octicon symbol={adding ? octicons.x : octicons.plus} />
            </button>
          )}
          <button
            className={`omnispindle-refresh${loading ? ' spinning' : ''}`}
            onClick={this.onRefresh}
            title={loading ? 'Fetching…' : 'Refresh todos'}
            disabled={loading}
          >
            <Octicon symbol={octicons.sync} />
          </button>
          <button className="omnispindle-chevron-btn" onClick={this.onToggle}>
            <Octicon
              symbol={expanded ? octicons.chevronUp : octicons.chevronDown}
              className="omnispindle-chevron"
            />
          </button>
        </div>

        {adding && (
          <form className="omnispindle-add-form" onSubmit={this.onSubmit}>
            <input
              className="omnispindle-input"
              type="text"
              placeholder="Description"
              value={newDescription}
              onChange={e => this.setState({ newDescription: e.target.value })}
              autoFocus={true}
              disabled={submitting}
            />
            <div className="omnispindle-add-row">
              <input
                className="omnispindle-input omnispindle-input-project"
                type="text"
                placeholder="project"
                value={newProject}
                onChange={e => this.setState({ newProject: e.target.value })}
                disabled={submitting}
              />
              <select
                className="omnispindle-select"
                value={newPriority}
                onChange={e => this.setState({ newPriority: e.target.value })}
                disabled={submitting}
              >
                <option>Critical</option>
                <option>High</option>
                <option>Medium</option>
                <option>Low</option>
              </select>
            </div>
            {submitError && (
              <p className="omnispindle-submit-error">{submitError}</p>
            )}
            <div className="omnispindle-add-actions">
              <button
                type="submit"
                className="omnispindle-btn-submit"
                disabled={submitting || !newDescription.trim() || !newProject.trim()}
              >
                {submitting ? 'Adding…' : 'Add'}
              </button>
              <button
                type="button"
                className="omnispindle-btn-cancel"
                onClick={this.onCancel}
                disabled={submitting}
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {expanded && todos.length > 0 && (
          <ul className="omnispindle-list">
            {todos.map(todo => (
              <li
                key={todo.id}
                className={`omnispindle-item ${priorityClass(todo.priority)}${selectedTodo?.id === todo.id ? ' selected' : ''}`}
                onClick={() => this.onTodoClick(todo)}
                onContextMenu={e => this.onTodoContextMenu(e, todo)}
                title="Click to view · Right-click to copy ID"
              >
                <div className="omnispindle-item-body">
                  <span className="omnispindle-item-title">{todo.title}</span>
                  <div className="omnispindle-item-meta">
                    {todo.project && (
                      <span className="omnispindle-item-project">{todo.project}</span>
                    )}
                    {todo.priority && (
                      <span className={`omnispindle-badge ${priorityClass(todo.priority)}`}>
                        {todo.priority}
                      </span>
                    )}
                    <span className={`omnispindle-badge ${statusBadgeClass(todo.status)}`}>
                      {todo.status.replace('_', ' ')}
                    </span>
                    {copiedId === todo.id && (
                      <span className="omnispindle-copied">✓ copied</span>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {expanded && todos.length === 0 && status === 'connected' && (
          <p className="omnispindle-empty">No pending todos</p>
        )}

        {expanded && status === 'unconfigured' && (
          <p className="omnispindle-empty">
            Set your API key in Settings → Omnispindle, then click sync.
          </p>
        )}

        {expanded && status === 'error' && (
          <p className="omnispindle-empty">
            Could not reach Omnispindle. Check your API key in Settings.
          </p>
        )}

        {this.renderDetailPanel(selectedTodo, lookupId, lookupLoading, lookupError)}
      </div>
    )
  }

  private renderDetailPanel(
    todo: IOmnispindleTodo | null,
    lookupId: string,
    lookupLoading: boolean,
    lookupError: string | null
  ) {
    const age = todo?.createdAt ? this.formatAge(todo.createdAt) : null

    return (
      <div className="omnispindle-detail-panel">
        <form className="omnispindle-lookup-form" onSubmit={this.onLookupSubmit}>
          <input
            className="omnispindle-input omnispindle-lookup-input"
            type="text"
            placeholder="Paste todo ID…"
            value={lookupId}
            onChange={this.onLookupChange}
            disabled={lookupLoading}
          />
          <button
            type="submit"
            className="omnispindle-lookup-btn"
            disabled={lookupLoading || !lookupId.trim()}
            title="Fetch todo by ID"
          >
            <Octicon symbol={lookupLoading ? octicons.sync : octicons.search} />
          </button>
        </form>

        {lookupError && (
          <p className="omnispindle-submit-error">{lookupError}</p>
        )}

        {todo ? (
          <>
            <div className="omnispindle-detail-header">
              <span className={`omnispindle-detail-priority ${priorityClass(todo.priority)}`}>
                {todo.priority ?? '—'}
              </span>
              <span className={`omnispindle-badge ${statusBadgeClass(todo.status)}`}>
                {todo.status.replace('_', ' ')}
              </span>
              <button
                className="omnispindle-detail-close"
                onClick={this.onCloseDetail}
                title="Clear"
              >
                <Octicon symbol={octicons.x} />
              </button>
            </div>

            <p className="omnispindle-detail-description">{todo.title}</p>

            {todo.notes && (
              <p className="omnispindle-detail-notes">{todo.notes}</p>
            )}

            <div className="omnispindle-detail-footer">
              {todo.project && (
                <span className="omnispindle-detail-project">{todo.project}</span>
              )}
              {age && <span className="omnispindle-detail-age">{age}</span>}
              <button
                className="omnispindle-detail-copy"
                onClick={() => navigator.clipboard.writeText(todo.id)}
                title={todo.id}
              >
                Copy ID
              </button>
            </div>
          </>
        ) : (
          <p className="omnispindle-detail-empty">
            Click a todo or paste an ID above
          </p>
        )}
      </div>
    )
  }

  private formatAge(ts: number): string {
    const secs = Math.floor(Date.now() / 1000) - ts
    if (secs < 60) return `${secs}s ago`
    if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
    if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
    return `${Math.floor(secs / 86400)}d ago`
  }
}
