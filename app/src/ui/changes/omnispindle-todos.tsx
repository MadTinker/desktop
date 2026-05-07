import * as React from 'react'
import { IOmnispindleTodo, OmnispindleConnectionStatus } from '../../models/omnispindle'
import { Octicon } from '../octicons'
import * as octicons from '../octicons/octicons.generated'

interface IOmnispindleTodosProps {
  readonly todos: ReadonlyArray<IOmnispindleTodo>
  readonly status: OmnispindleConnectionStatus
  readonly onRefresh: () => void
}

interface IOmnispindleTodosState {
  readonly expanded: boolean
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
    this.state = { expanded: true }
  }

  private onToggle = () => {
    this.setState(prev => ({ expanded: !prev.expanded }))
  }

  private onRefresh = (e: React.MouseEvent) => {
    e.stopPropagation()
    this.props.onRefresh()
  }

  public render() {
    const { todos, status } = this.props
    const { expanded } = this.state
    const icon = statusIcon(status)
    const iconClass =
      status === 'error'   ? 'omnispindle-icon error' :
      status === 'connected' ? 'omnispindle-icon ok'  : 'omnispindle-icon'

    return (
      <div className="omnispindle-todos">
        <button className="omnispindle-header" onClick={this.onToggle}>
          <Octicon symbol={icon} className={iconClass} />
          <span className="omnispindle-title">Omnispindle</span>
          <span className="omnispindle-summary">
            {statusLabel(status, todos.length)}
          </span>
          <span
            className="omnispindle-refresh"
            onClick={this.onRefresh}
            title="Refresh todos"
            role="button"
          >
            <Octicon symbol={octicons.sync} />
          </span>
          <Octicon
            symbol={expanded ? octicons.chevronUp : octicons.chevronDown}
            className="omnispindle-chevron"
          />
        </button>

        {expanded && todos.length > 0 && (
          <ul className="omnispindle-list">
            {todos.map(todo => (
              <li
                key={todo.id}
                className={`omnispindle-item ${priorityClass(todo.priority)}`}
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
      </div>
    )
  }
}
