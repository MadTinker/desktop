import React from 'react'
import { parseRepositoryIdentifier } from '../../lib/remote-parsing'
import { ISubmoduleDiff } from '../../models/diff'
import { LinkButton } from '../lib/link-button'
import { Octicon } from '../octicons'
import * as octicons from '../octicons/octicons.generated'
import { SuggestedAction } from '../suggested-actions'
import { Ref } from '../lib/ref'
import { CopyButton } from '../copy-button'
import { shortenSHA, CommitOneLine } from '../../models/commit'
import { getSubmoduleCommitsBetween } from '../../lib/git/submodule'
import { Button } from '../lib/button'

type SubmoduleItemIcon =
  | {
      readonly octicon: typeof octicons.info
      readonly className: 'info-icon'
    }
  | {
      readonly octicon: typeof octicons.diffModified
      readonly className: 'modified-icon'
    }
  | {
      readonly octicon: typeof octicons.diffAdded
      readonly className: 'added-icon'
    }
  | {
      readonly octicon: typeof octicons.diffRemoved
      readonly className: 'removed-icon'
    }
  | {
      readonly octicon: typeof octicons.fileDiff
      readonly className: 'untracked-icon'
    }

interface ISubmoduleDiffProps {
  readonly onOpenSubmodule?: (fullPath: string) => void
  readonly onInitializeSubmodule?: (submodulePath: string) => void
  readonly onSyncSubmodule?: (submodulePath: string) => void
  readonly onRollbackSubmodule?: (submodulePath: string) => void
  readonly diff: ISubmoduleDiff

  /**
   * Whether the diff is readonly, e.g., displaying a historical diff, or the
   * diff's content can be committed, e.g., displaying a change in the working
   * directory.
   */
  readonly readOnly: boolean
}

interface ISubmoduleDiffState {
  readonly commits: ReadonlyArray<CommitOneLine>
}

export class SubmoduleDiff extends React.Component<
  ISubmoduleDiffProps,
  ISubmoduleDiffState
> {
  public constructor(props: ISubmoduleDiffProps) {
    super(props)
    this.state = { commits: [] }
  }

  public async componentDidMount() {
    const { diff } = this.props
    if (diff.oldSHA !== null && diff.newSHA !== null) {
      try {
        const commits = await getSubmoduleCommitsBetween(
          diff.fullPath,
          diff.oldSHA,
          diff.newSHA
        )
        this.setState({ commits })
      } catch {
        // submodule may not be initialized; silently skip
      }
    }
  }

  public async componentDidUpdate(prevProps: ISubmoduleDiffProps) {
    const { diff } = this.props
    const prev = prevProps.diff
    if (diff.oldSHA !== prev.oldSHA || diff.newSHA !== prev.newSHA) {
      if (diff.oldSHA !== null && diff.newSHA !== null) {
        try {
          const commits = await getSubmoduleCommitsBetween(
            diff.fullPath,
            diff.oldSHA,
            diff.newSHA
          )
          this.setState({ commits })
        } catch {
          this.setState({ commits: [] })
        }
      } else {
        this.setState({ commits: [] })
      }
    }
  }

  public render() {
    return (
      <div className="changes-interstitial submodule-diff">
        <div className="content">
          <div className="interstitial-header">
            <div className="text">
              <h1>Submodule changes</h1>
            </div>
          </div>
          {this.renderSubmoduleInfo()}
          {this.renderCommitChangeInfo()}
          {this.renderCommitHistory()}
          {this.renderSubmodulesChangesInfo()}
          {this.renderQuickActions()}
          {this.renderOpenSubmoduleAction()}
        </div>
      </div>
    )
  }

  private renderSubmoduleInfo() {
    if (this.props.diff.url === null) {
      return null
    }

    const repoIdentifier = parseRepositoryIdentifier(this.props.diff.url)
    if (repoIdentifier === null) {
      return null
    }

    const hostname =
      repoIdentifier.hostname === 'github.com'
        ? ''
        : ` (${repoIdentifier.hostname})`

    return this.renderSubmoduleDiffItem(
      { octicon: octicons.info, className: 'info-icon' },
      <>
        This is a submodule based on the repository{' '}
        <LinkButton
          uri={`https://${repoIdentifier.hostname}/${repoIdentifier.owner}/${repoIdentifier.name}`}
        >
          {repoIdentifier.owner}/{repoIdentifier.name}
          {hostname}
        </LinkButton>
        .
      </>
    )
  }

  private renderCommitChangeInfo() {
    const { diff, readOnly } = this.props
    const { oldSHA, newSHA } = diff

    const verb = readOnly ? 'was' : 'has been'
    const suffix = readOnly
      ? ''
      : ' This change can be committed to the parent repository.'

    if (oldSHA !== null && newSHA !== null) {
      return this.renderSubmoduleDiffItem(
        { octicon: octicons.diffModified, className: 'modified-icon' },
        <>
          This submodule changed its commit from{' '}
          {this.renderCommitSHA(oldSHA, 'previous')} to{' '}
          {this.renderCommitSHA(newSHA, 'new')}.{suffix}
        </>
      )
    } else if (oldSHA === null && newSHA !== null) {
      return this.renderSubmoduleDiffItem(
        { octicon: octicons.diffAdded, className: 'added-icon' },
        <>
          This submodule {verb} added pointing at commit{' '}
          {this.renderCommitSHA(newSHA)}.{suffix}
        </>
      )
    } else if (oldSHA !== null && newSHA === null) {
      return this.renderSubmoduleDiffItem(
        { octicon: octicons.diffRemoved, className: 'removed-icon' },
        <>
          This submodule {verb} removed while it was pointing at commit{' '}
          {this.renderCommitSHA(oldSHA)}.{suffix}
        </>
      )
    }

    return null
  }

  private renderCommitHistory() {
    const { commits } = this.state
    if (commits.length === 0) {
      return null
    }

    return (
      <div className="item submodule-commit-history">
        <Octicon symbol={octicons.gitCommit} className="info-icon" />
        <div className="content">
          <p>Commits included in this change:</p>
          <ul className="submodule-commits">
            {commits.map(c => (
              <li key={c.sha}>
                <Ref>{shortenSHA(c.sha)}</Ref> {c.summary}
              </li>
            ))}
          </ul>
        </div>
      </div>
    )
  }

  private renderCommitSHA(sha: string, which?: 'previous' | 'new') {
    const whichInfix = which === undefined ? '' : ` ${which}`

    return (
      <>
        <Ref>{shortenSHA(sha)}</Ref>
        <CopyButton
          ariaLabel={`Copy the full${whichInfix} SHA`}
          copyContent={sha}
        />
      </>
    )
  }

  private renderSubmodulesChangesInfo() {
    const { diff } = this.props

    if (!diff.status.untrackedChanges && !diff.status.modifiedChanges) {
      return null
    }

    const changes =
      diff.status.untrackedChanges && diff.status.modifiedChanges
        ? 'modified and untracked'
        : diff.status.untrackedChanges
        ? 'untracked'
        : 'modified'

    return this.renderSubmoduleDiffItem(
      { octicon: octicons.fileDiff, className: 'untracked-icon' },
      <>
        This submodule has {changes} changes. Those changes must be committed
        inside of the submodule before they can be part of the parent
        repository.
      </>
    )
  }

  private renderQuickActions() {
    const {
      diff,
      readOnly,
      onInitializeSubmodule,
      onSyncSubmodule,
      onRollbackSubmodule,
    } = this.props

    const showInitialize =
      diff.entryStatus === 'uninitialized' && onInitializeSubmodule !== undefined
    const showSync = diff.url !== null && onSyncSubmodule !== undefined
    const showRollback =
      !readOnly &&
      diff.oldSHA !== null &&
      diff.newSHA !== null &&
      onRollbackSubmodule !== undefined

    if (!showInitialize && !showSync && !showRollback) {
      return null
    }

    return (
      <div className="item submodule-actions">
        <Octicon symbol={octicons.zap} className="info-icon" />
        <div className="content submodule-action-buttons">
          {showInitialize && (
            <Button
              onClick={() => onInitializeSubmodule!(diff.path)}
              type="button"
            >
              Initialize
            </Button>
          )}
          {showSync && (
            <Button onClick={() => onSyncSubmodule!(diff.path)} type="button">
              Sync
            </Button>
          )}
          {showRollback && (
            <Button
              onClick={() => onRollbackSubmodule!(diff.path)}
              type="button"
            >
              Rollback
            </Button>
          )}
        </div>
      </div>
    )
  }

  private renderSubmoduleDiffItem(
    icon: SubmoduleItemIcon,
    content: React.ReactElement
  ) {
    return (
      <div className="item">
        <Octicon symbol={icon.octicon} className={icon.className} />
        <div className="content">{content}</div>
      </div>
    )
  }

  private renderOpenSubmoduleAction() {
    const { diff } = this.props

    // Show the Open button if we have a URL *or* the submodule directory
    // exists on disk (covers uninitialized / deleted-from-config cases).
    if (diff.url === null && diff.entryStatus === 'uninitialized') {
      return null
    }

    return (
      <span>
        <SuggestedAction
          title="Open this submodule on Madness Desktop"
          description="You can open this submodule on Madness Desktop as a normal repository to manage and commit any changes in it."
          buttonText={__DARWIN__ ? 'Open Repository' : 'Open repository'}
          type="primary"
          onClick={this.onOpenSubmoduleClick}
        />
      </span>
    )
  }

  private onOpenSubmoduleClick = () => {
    this.props.onOpenSubmodule?.(this.props.diff.fullPath)
  }
}
