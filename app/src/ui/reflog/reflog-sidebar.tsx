import * as React from 'react'
import { IReflogEntry } from '../../models/reflog-entry'
import { RelativeTime } from '../relative-time'

interface IReflogSidebarProps {
  readonly entries: ReadonlyArray<IReflogEntry>
}

export class ReflogSidebar extends React.Component<IReflogSidebarProps> {
  public render() {
    const { entries } = this.props

    if (entries.length === 0) {
      return (
        <div className="reflog-sidebar">
          <p className="reflog-empty">No reflog entries found.</p>
        </div>
      )
    }

    return (
      <div className="reflog-sidebar">
        {entries.map(entry => (
          <div key={entry.selector} className="reflog-entry">
            <div className="reflog-entry-header">
              <span className="reflog-selector">{entry.selector}</span>
              <span className="reflog-sha">{entry.shortSha}</span>
              <RelativeTime date={entry.date} className="reflog-date" />
            </div>
            <div className="reflog-description">{entry.description}</div>
          </div>
        ))}
      </div>
    )
  }
}
