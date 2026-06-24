import * as React from 'react'
import { ShellView } from './shell-view'

interface ITerminalTab {
  readonly id: string
  readonly label: string
  readonly cwd: string
  readonly initialCommand?: string
}

interface ITerminalTabsProps {
  readonly cwd: string
  readonly fontSize?: number
  readonly cursorBlink?: boolean
  readonly scrollback?: number
}

interface ITerminalTabsState {
  readonly tabs: ReadonlyArray<ITerminalTab>
  readonly activeTabId: string
}

let nextTabId = 1

function makeTabId(): string {
  return `tab-${nextTabId++}`
}

function cwdBasename(cwd: string): string {
  const parts = cwd.replace(/\/$/, '').split('/')
  return parts[parts.length - 1] || 'shell'
}

export class TerminalTabs extends React.Component<
  ITerminalTabsProps,
  ITerminalTabsState
> {
  public constructor(props: ITerminalTabsProps) {
    super(props)
    const id = makeTabId()
    this.state = {
      tabs: [{ id, label: cwdBasename(props.cwd), cwd: props.cwd }],
      activeTabId: id,
    }
  }

  private addTab = (initialCommand?: string) => {
    const id = makeTabId()
    const label =
      initialCommand === 'claude' ? 'claude ✦' : cwdBasename(this.props.cwd)
    const tab: ITerminalTab = {
      id,
      label,
      cwd: this.props.cwd,
      initialCommand,
    }
    this.setState(s => ({ tabs: [...s.tabs, tab], activeTabId: id }))
  }

  private closeTab = (tabId: string) => {
    this.setState(s => {
      const idx = s.tabs.findIndex(t => t.id === tabId)
      if (idx === -1) {
        return s
      }

      const tabs = s.tabs.filter(t => t.id !== tabId)

      if (tabs.length === 0) {
        const newId = makeTabId()
        return {
          tabs: [
            {
              id: newId,
              label: cwdBasename(this.props.cwd),
              cwd: this.props.cwd,
            },
          ],
          activeTabId: newId,
        }
      }

      const activeTabId =
        s.activeTabId === tabId
          ? tabs[Math.max(0, idx - 1)].id
          : s.activeTabId

      return { tabs, activeTabId }
    })
  }

  public render() {
    const { tabs, activeTabId } = this.state
    const { fontSize, cursorBlink, scrollback } = this.props

    return (
      <div className="terminal-tabs">
        <div className="terminal-tabs-bar">
          {tabs.map(tab => (
            <div
              key={tab.id}
              className={`terminal-tabs-tab${tab.id === activeTabId ? ' is-active' : ''}`}
              onClick={() => this.setState({ activeTabId: tab.id })}
            >
              <span className="terminal-tabs-tab-label">{tab.label}</span>
              {tabs.length > 1 && (
                <button
                  type="button"
                  className="terminal-tabs-tab-close"
                  onClick={e => {
                    e.stopPropagation()
                    this.closeTab(tab.id)
                  }}
                  aria-label={`Close ${tab.label}`}
                >
                  ×
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            className="terminal-tabs-claude-btn"
            onClick={() => this.addTab('claude')}
            title="New Claude Code session"
          >
            claude ✦
          </button>
          <button
            type="button"
            className="terminal-tabs-add-btn"
            onClick={() => this.addTab()}
            aria-label="New terminal tab"
            title="New terminal tab"
          >
            +
          </button>
        </div>
        <div className="terminal-tabs-content">
          {tabs.map(tab => (
            <div
              key={tab.id}
              className="terminal-tabs-pane"
              style={{ display: tab.id === activeTabId ? 'flex' : 'none' }}
            >
              <ShellView
                cwd={tab.cwd}
                fontSize={fontSize}
                cursorBlink={cursorBlink}
                scrollback={scrollback}
                initialCommand={tab.initialCommand}
              />
            </div>
          ))}
        </div>
      </div>
    )
  }
}
