import * as React from 'react'
import { IHookLogEntry } from '../../lib/app-state'
import { Octicon } from '../octicons'
import * as octicons from '../octicons/octicons.generated'

interface IHookLogProps {
  readonly hookLog: ReadonlyArray<IHookLogEntry>
}

interface IHookLogState {
  readonly expanded: boolean
  readonly expandedEntries: ReadonlySet<string>
}

function formatTimestamp(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function formatDuration(ms: number): string {
  return `${(ms / 1000).toFixed(2)}s`
}

export class HookLog extends React.Component<IHookLogProps, IHookLogState> {
  public constructor(props: IHookLogProps) {
    super(props)
    this.state = { expanded: false, expandedEntries: new Set() }
  }

  private onToggle = () => {
    this.setState(prev => ({ expanded: !prev.expanded }))
  }

  private onToggleEntry = (id: string) => {
    this.setState(prev => {
      const next = new Set(prev.expandedEntries)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return { expandedEntries: next }
    })
  }

  public render() {
    const { hookLog } = this.props
    if (hookLog.length === 0) {
      return null
    }

    const { expanded, expandedEntries } = this.state
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
            {hookLog.map(entry => {
              const isEntryExpanded = expandedEntries.has(entry.id)
              const hookPath = `${entry.repoPath}/.git/hooks/${entry.hookName}`
              return (
                <li key={entry.id} className={`hook-log-entry ${entry.status}`}>
                  <button
                    className="hook-log-entry-summary"
                    onClick={() => this.onToggleEntry(entry.id)}
                  >
                    <Octicon
                      symbol={entry.status === 'failed' ? octicons.xCircle : octicons.checkCircle}
                      className={`hook-log-entry-icon ${entry.status}`}
                    />
                    <span className="hook-log-entry-name">{entry.hookName}</span>
                    <span className="hook-log-entry-duration">
                      {formatDuration(entry.duration)}
                    </span>
                    {entry.exitCode !== 0 && (
                      <span className="hook-log-entry-code">exit {entry.exitCode}</span>
                    )}
                    <span className="hook-log-entry-time">
                      {formatTimestamp(entry.timestamp)}
                    </span>
                    <Octicon
                      symbol={isEntryExpanded ? octicons.chevronUp : octicons.chevronDown}
                      className="hook-log-entry-chevron"
                    />
                  </button>
                  {isEntryExpanded && (
                    <div className="hook-log-entry-detail">
                      <div className="hook-log-entry-path">{hookPath}</div>
                      {entry.output && (
                        <pre className="hook-log-entry-output">{entry.output}</pre>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    )
  }
}
