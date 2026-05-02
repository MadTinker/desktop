import * as React from 'react'
import { IHookLogEntry } from '../../lib/app-state'
import { Octicon } from '../octicons'
import * as octicons from '../octicons/octicons.generated'

interface IHookLogProps {
  readonly hookLog: ReadonlyArray<IHookLogEntry>
}

interface IHookLogState {
  readonly expanded: boolean
}

function formatTimestamp(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export class HookLog extends React.Component<IHookLogProps, IHookLogState> {
  public constructor(props: IHookLogProps) {
    super(props)
    this.state = { expanded: false }
  }

  private onToggle = () => {
    this.setState(prev => ({ expanded: !prev.expanded }))
  }

  public render() {
    const { hookLog } = this.props
    if (hookLog.length === 0) {
      return null
    }

    const { expanded } = this.state
    const latest = hookLog[0]
    const latestFailed = hookLog.some(e => e.status === 'failed')

    return (
      <div className="hook-log">
        <button className="hook-log-header" onClick={this.onToggle}>
          <Octicon
            symbol={latestFailed ? octicons.xCircle : octicons.checkCircle}
            className={latestFailed ? 'hook-log-icon failed' : 'hook-log-icon ok'}
          />
          <span className="hook-log-title">Hook Log</span>
          <span className="hook-log-latest">
            {latest.hookName} · {latest.status}
          </span>
          <Octicon
            symbol={expanded ? octicons.chevronUp : octicons.chevronDown}
            className="hook-log-chevron"
          />
        </button>

        {expanded && (
          <ul className="hook-log-entries">
            {hookLog.map(entry => (
              <li key={entry.id} className={`hook-log-entry ${entry.status}`}>
                <Octicon
                  symbol={entry.status === 'failed' ? octicons.xCircle : octicons.checkCircle}
                  className={`hook-log-entry-icon ${entry.status}`}
                />
                <span className="hook-log-entry-name">{entry.hookName}</span>
                <span className="hook-log-entry-time">
                  {formatTimestamp(entry.timestamp)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  }
}
