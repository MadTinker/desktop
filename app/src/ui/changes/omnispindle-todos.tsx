import * as React from 'react'
import { IOmnispindleTodo, OmnispindleConnectionStatus } from '../../models/omnispindle'
import { Octicon } from '../octicons'
import * as octicons from '../octicons/octicons.generated'

interface IOmnispindleTodosProps {
  readonly todos: ReadonlyArray<IOmnispindleTodo>
  readonly status: OmnispindleConnectionStatus
}

interface IOmnispindleTodosState {
  readonly expanded: boolean
}

function statusIcon(status: OmnispindleConnectionStatus) {
  if (status === 'connected') {
    return octicons.checkCircle
  }
  if (status === 'error') {
    return octicons.xCircle
  }
  return octicons.plug
}

function statusLabel(status: OmnispindleConnectionStatus, count: number) {
  if (status === 'unconfigured') {
    return 'Omnispindle — not configured'
  }
  if (status === 'error') {
    return 'Omnispindle — connection error'
  }
  return `Omnispindle — ${count} active todo${count === 1 ? '' : 's'}`
}

export class OmnispindleTodos extends React.Component<
  IOmnispindleTodosProps,
  IOmnispindleTodosState
> {
  public constructor(props: IOmnispindleTodosProps) {
    super(props)
    this.state = { expanded: false }
  }

  private onToggle = () => {
    this.setState(prev => ({ expanded: !prev.expanded }))
  }

  public render() {
    const { todos, status } = this.props

    if (status === 'unconfigured') {
      return null
    }

    const { expanded } = this.state
    const icon = statusIcon(status)
    const iconClass =
      status === 'error'
        ? 'omnispindle-icon error'
        : 'omnispindle-icon ok'

    return (
      <div className="omnispindle-todos">
        <button className="omnispindle-header" onClick={this.onToggle}>
          <Octicon symbol={icon} className={iconClass} />
          <span className="omnispindle-title">Omnispindle</span>
          <span className="omnispindle-summary">
            {statusLabel(status, todos.length)}
          </span>
          <Octicon
            symbol={expanded ? octicons.chevronUp : octicons.chevronDown}
            className="omnispindle-chevron"
          />
        </button>

        {expanded && todos.length > 0 && (
          <ul className="omnispindle-list">
            {todos.map(todo => (
              <li key={todo.id} className="omnispindle-item">
                <Octicon
                  symbol={octicons.tasklist}
                  className="omnispindle-item-icon"
                />
                <span className="omnispindle-item-title">{todo.title}</span>
                {todo.project && (
                  <span className="omnispindle-item-project">{todo.project}</span>
                )}
              </li>
            ))}
          </ul>
        )}

        {expanded && todos.length === 0 && status === 'connected' && (
          <p className="omnispindle-empty">No active todos</p>
        )}
      </div>
    )
  }
}
