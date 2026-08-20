import * as React from 'react'
import classNames from 'classnames'

import { Octicon } from '../octicons'
import * as octicons from '../octicons/octicons.generated'
import { OcticonSymbol } from '../octicons/octicons.generated'

/** The panels that can occupy the repository view's right edge. */
export type SidePanelKind = 'submodules' | 'remotes'

interface ISidePanelProps {
  readonly title: string
  readonly open: boolean
  readonly onClose: () => void
  readonly children: React.ReactNode
}

/**
 * A panel that slides in over the right edge of the repository content.
 *
 * Overlays rather than displaces, so opening one never reflows the diff. It
 * stays mounted while closed so the slide reads as motion in both directions;
 * callers that shell out to git on mount should render their content only
 * while `open`.
 */
export class SidePanel extends React.Component<ISidePanelProps> {
  public render() {
    const { title, open, children } = this.props

    return (
      <aside
        className={classNames('side-panel', { open })}
        aria-hidden={!open}
        aria-label={title}
      >
        <header className="side-panel-header">
          <span className="side-panel-title">{title}</span>
          <button
            type="button"
            className="side-panel-close"
            onClick={this.props.onClose}
            aria-label={`Close ${title.toLowerCase()} panel`}
          >
            <Octicon symbol={octicons.x} />
          </button>
        </header>
        {children}
      </aside>
    )
  }
}

export interface ISidePanelToggle {
  readonly kind: SidePanelKind
  readonly label: string
  readonly symbol: OcticonSymbol
}

interface ISidePanelTogglesProps {
  readonly toggles: ReadonlyArray<ISidePanelToggle>
  readonly openPanel: SidePanelKind | null
  readonly onToggle: (kind: SidePanelKind) => void
}

/**
 * The stack of slim tabs on the right edge, one per panel.
 *
 * Stacked rather than overlaid because every panel anchors to the same edge —
 * a second tab at the same position would sit on top of the first.
 */
export class SidePanelToggles extends React.Component<ISidePanelTogglesProps> {
  public render() {
    return (
      <div className="side-panel-toggles">
        {this.props.toggles.map(toggle => this.renderToggle(toggle))}
      </div>
    )
  }

  private renderToggle(toggle: ISidePanelToggle) {
    const isOpen = this.props.openPanel === toggle.kind

    return (
      <button
        key={toggle.kind}
        type="button"
        className={classNames('side-panel-toggle', { active: isOpen })}
        onClick={this.onToggle(toggle.kind)}
        aria-expanded={isOpen}
        aria-label={`Toggle ${toggle.label.toLowerCase()} panel`}
      >
        <Octicon symbol={toggle.symbol} />
      </button>
    )
  }

  private onToggle = (kind: SidePanelKind) => () => this.props.onToggle(kind)
}
