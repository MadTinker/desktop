import * as React from 'react'

import { Repository } from '../../models/repository'
import { Octicon, iconForRepository } from '../octicons'
import * as octicons from '../octicons/octicons.generated'
import { Repositoryish } from './group-repositories'
import { HighlightText } from '../lib/highlight-text'
import { IMatches } from '../../lib/fuzzy-find'
import { IAheadBehind } from '../../models/branch'
import classNames from 'classnames'
import { createObservableRef } from '../lib/observable-ref'
import { Tooltip } from '../lib/tooltip'
import { enableAccessibleListToolTips } from '../../lib/feature-flag'
import { TooltippedContent } from '../lib/tooltipped-content'

interface IRepositoryListItemProps {
  readonly repository: Repositoryish

  /** Does the repository need to be disambiguated in the list? */
  readonly needsDisambiguation: boolean

  /** Whether the repository is marked as a favorite. */
  readonly isFavorite: boolean

  /** The characters in the repository name to highlight */
  readonly matches: IMatches

  /** Number of commits this local repo branch is behind or ahead of its remote branch */
  readonly aheadBehind: IAheadBehind | null

  /** Number of uncommitted changes */
  readonly changedFilesCount: number

  /** Whether this item supports drag-to-reorder */
  readonly isDraggable?: boolean

  /** Whether this item is currently being dragged */
  readonly isDragSource?: boolean

  /** Whether this item is the current drop target */
  readonly isDragTarget?: boolean

  readonly onDragStart?: (e: React.DragEvent<HTMLDivElement>) => void
  readonly onDragOver?: (e: React.DragEvent<HTMLDivElement>) => void
  readonly onDragEnd?: (e: React.DragEvent<HTMLDivElement>) => void
  readonly onDrop?: (e: React.DragEvent<HTMLDivElement>) => void

  /** Depth in the monorepo→subrepo tree (0 = top-level). */
  readonly nestingLevel?: number

  /** Whether this repo has nested subrepos beneath it. */
  readonly hasChildren?: boolean

  /** Whether this repo's subrepos are currently collapsed. */
  readonly isCollapsed?: boolean

  /** Toggle the collapsed state of this repo's subrepos. */
  readonly onToggleCollapsed?: () => void
}

/** A repository item. */
export class RepositoryListItem extends React.Component<
  IRepositoryListItemProps,
  {}
> {
  private readonly listItemRef = createObservableRef<HTMLDivElement>()

  public render() {
    const repository = this.props.repository
    const gitHubRepo =
      repository instanceof Repository ? repository.gitHubRepository : null
    const hasChanges = this.props.changedFilesCount > 0

    const alias: string | null =
      repository instanceof Repository ? repository.alias : null

    let prefix: string | null = null
    if (this.props.needsDisambiguation && gitHubRepo) {
      prefix = `${gitHubRepo.owner.login}/`
    }

    const classNameList = classNames('name', {
      alias: alias !== null,
    })

    const nestingLevel = this.props.nestingLevel ?? 0

    const itemClass = classNames('repository-list-item', {
      'drag-source': this.props.isDragSource,
      'drag-target': this.props.isDragTarget,
      'is-subrepo': nestingLevel > 0,
    })

    // Indent nested subrepos so the monorepo hierarchy reads like a folder tree.
    const indentStyle =
      nestingLevel > 0
        ? { paddingInlineStart: `calc(var(--spacing) + ${nestingLevel * 16}px)` }
        : undefined

    return (
      <div
        className={itemClass}
        ref={this.listItemRef}
        draggable={this.props.isDraggable}
        onDragStart={this.props.onDragStart}
        onDragOver={this.props.onDragOver}
        onDragEnd={this.props.onDragEnd}
        onDrop={this.props.onDrop}
        style={indentStyle}
      >
        <Tooltip
          target={this.listItemRef}
          disabled={enableAccessibleListToolTips()}
        >
          {this.renderTooltip()}
        </Tooltip>

        {this.props.hasChildren ? (
          <span
            className="subrepo-collapse-toggle"
            role="button"
            onClick={this.onToggleCollapsedClick}
          >
            <Octicon
              symbol={
                this.props.isCollapsed
                  ? octicons.chevronRight
                  : octicons.chevronDown
              }
            />
          </span>
        ) : (
          nestingLevel > 0 && <span className="subrepo-spacer" />
        )}

        <Octicon
          className="icon-for-repository"
          symbol={iconForRepository(repository)}
        />

        {this.props.isFavorite && (
          <Octicon className="favorite-indicator" symbol={octicons.starFill} />
        )}

        <div className={classNames(classNameList)}>
          {prefix ? <span className="prefix">{prefix}</span> : null}
          <HighlightText
            text={alias ?? repository.name}
            highlight={this.props.matches.title}
          />
        </div>

        {repository instanceof Repository &&
          renderRepoIndicators({
            aheadBehind: this.props.aheadBehind,
            hasChanges: hasChanges,
          })}
      </div>
    )
  }

  private onToggleCollapsedClick = (e: React.MouseEvent<HTMLSpanElement>) => {
    // Don't let the chevron click bubble up and select the repository.
    e.stopPropagation()
    e.preventDefault()
    this.props.onToggleCollapsed?.()
  }

  private renderTooltip() {
    const repo = this.props.repository
    const gitHubRepo = repo instanceof Repository ? repo.gitHubRepository : null
    const alias = repo instanceof Repository ? repo.alias : null
    const realName = gitHubRepo ? gitHubRepo.fullName : repo.name

    return (
      <>
        <div>
          <strong>{realName}</strong>
          {alias && <> ({alias})</>}
        </div>
        <div>{repo.path}</div>
      </>
    )
  }

  public shouldComponentUpdate(nextProps: IRepositoryListItemProps): boolean {
    if (
      nextProps.repository instanceof Repository &&
      this.props.repository instanceof Repository
    ) {
      return (
        nextProps.repository.id !== this.props.repository.id ||
        nextProps.matches !== this.props.matches ||
        nextProps.isFavorite !== this.props.isFavorite ||
        nextProps.isDragSource !== this.props.isDragSource ||
        nextProps.isDragTarget !== this.props.isDragTarget ||
        nextProps.nestingLevel !== this.props.nestingLevel ||
        nextProps.hasChildren !== this.props.hasChildren ||
        nextProps.isCollapsed !== this.props.isCollapsed
      )
    } else {
      return true
    }
  }
}

const renderRepoIndicators: React.FunctionComponent<{
  aheadBehind: IAheadBehind | null
  hasChanges: boolean
}> = props => {
  return (
    <div className="repo-indicators">
      {props.aheadBehind && renderAheadBehindIndicator(props.aheadBehind)}
      {props.hasChanges && renderChangesIndicator()}
    </div>
  )
}

const renderAheadBehindIndicator = (aheadBehind: IAheadBehind) => {
  const { ahead, behind } = aheadBehind
  if (ahead === 0 && behind === 0) {
    return null
  }

  const aheadBehindTooltip =
    'The currently checked out branch is' +
    (behind ? ` ${commitGrammar(behind)} behind ` : '') +
    (behind && ahead ? 'and' : '') +
    (ahead ? ` ${commitGrammar(ahead)} ahead of ` : '') +
    'its tracked branch.'

  return (
    <TooltippedContent
      className="ahead-behind"
      tagName="div"
      tooltip={aheadBehindTooltip}
      disabled={enableAccessibleListToolTips()}
    >
      {ahead > 0 && <Octicon symbol={octicons.arrowUp} />}
      {behind > 0 && <Octicon symbol={octicons.arrowDown} />}
    </TooltippedContent>
  )
}

const renderChangesIndicator = () => {
  return (
    <TooltippedContent
      className="change-indicator-wrapper"
      tooltip="There are uncommitted changes in this repository"
      disabled={enableAccessibleListToolTips()}
    >
      <Octicon symbol={octicons.dotFill} />
    </TooltippedContent>
  )
}

export const commitGrammar = (commitNum: number) =>
  `${commitNum} commit${commitNum > 1 ? 's' : ''}` // english is hard
