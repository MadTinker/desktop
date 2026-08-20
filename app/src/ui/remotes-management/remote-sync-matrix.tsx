import * as React from 'react'
import { Disposable } from 'event-kit'

import { Repository } from '../../models/repository'
import { IRemote } from '../../models/remote'
import {
  RemoteAllowList,
  describeRemoteAllowList,
} from '../../models/remote-policy'
import { BranchType } from '../../models/branch'
import { IBranchesState } from '../../lib/app-state'
import { AheadBehindStore } from '../../lib/stores/ahead-behind-store'
import { getRefMap } from '../../lib/git'
import { getRemoteHost, getRemoteHostLabel } from '../../lib/remote-host'
import {
  IMatrixBranch,
  ISyncMatrix,
  SyncCellState,
  buildSyncMatrix,
  describeCellState,
  pendingCells,
  withResolvedCell,
} from '../../lib/remote-sync-matrix'
import { Dispatcher } from '../dispatcher'
import { Octicon, syncClockwise } from '../octicons'
import { TooltippedContent } from '../lib/tooltipped-content'
import * as octicons from '../octicons/octicons.generated'

interface IRemoteSyncMatrixProps {
  readonly repository: Repository
  readonly dispatcher: Dispatcher
  readonly remotes: ReadonlyArray<IRemote>
  readonly remotePolicies: ReadonlyMap<string, RemoteAllowList>
  readonly branchesState: IBranchesState
  readonly aheadBehindStore: AheadBehindStore
}

interface IRemoteSyncMatrixState {
  readonly matrix: ISyncMatrix | null
  readonly loading: boolean
}

/**
 * Every local branch against every remote, so "what's out of sync where" is
 * one glance rather than a series of comparisons.
 *
 * Most cells cost nothing: a single `for-each-ref` reading tells us which
 * branches exist on which remote and which are already at the same commit.
 * Only genuinely diverged pairs need an ahead/behind count, and those go
 * through AheadBehindStore so they're cached and rate limited.
 */
export class RemoteSyncMatrix extends React.Component<
  IRemoteSyncMatrixProps,
  IRemoteSyncMatrixState
> {
  private readonly subscriptions = new Array<Disposable>()
  private disposed = false

  public constructor(props: IRemoteSyncMatrixProps) {
    super(props)
    this.state = { matrix: null, loading: true }
  }

  public async componentDidMount() {
    await this.load()
  }

  public componentWillUnmount() {
    this.disposed = true
    this.clearSubscriptions()
  }

  private clearSubscriptions() {
    for (const subscription of this.subscriptions) {
      subscription.dispose()
    }
    this.subscriptions.length = 0
  }

  private localBranches(): ReadonlyArray<IMatrixBranch> {
    return this.props.branchesState.allBranches
      .filter(b => b.type === BranchType.Local)
      .map(b => ({ name: b.name, sha: b.tip.sha }))
  }

  private async load() {
    this.clearSubscriptions()
    this.setState({ loading: true })

    const refs = await getRefMap(this.props.repository)

    if (this.disposed) {
      return
    }

    const matrix = buildSyncMatrix(
      this.localBranches(),
      this.props.remotes,
      refs,
      this.props.remotePolicies
    )

    this.setState({ matrix, loading: false })
    this.resolvePendingCells(matrix)
  }

  /**
   * Ask for the ahead/behind counts of every cell that needs one.
   *
   * AheadBehindStore serialises these internally, so this is a request queue
   * rather than a stampede, and each result fills its cell in as it lands.
   */
  private resolvePendingCells(matrix: ISyncMatrix) {
    for (const cell of pendingCells(matrix)) {
      if (cell.state.kind !== 'loading') {
        continue
      }

      const { from, to } = cell.state

      const subscription = this.props.aheadBehindStore.getAheadBehind(
        this.props.repository,
        from,
        to,
        aheadBehind => {
          if (this.disposed) {
            return
          }

          this.setState(state =>
            state.matrix === null
              ? null
              : {
                  matrix: withResolvedCell(
                    state.matrix,
                    cell.branchName,
                    cell.remoteName,
                    aheadBehind
                  ),
                }
          )
        }
      )

      this.subscriptions.push(subscription)
    }
  }

  public render() {
    const { remotes } = this.props
    const { matrix, loading } = this.state

    if (loading) {
      return (
        <div className="remotes-loading">
          <Octicon symbol={syncClockwise} className="spin" />
          Comparing branches…
        </div>
      )
    }

    if (remotes.length === 0) {
      return (
        <p className="remotes-empty">
          Add a remote to compare branches against it.
        </p>
      )
    }

    if (matrix === null || matrix.rows.length === 0) {
      return <p className="remotes-empty">This repository has no branches.</p>
    }

    return (
      <div className="remote-sync-matrix-scroll">
        <table className="remote-sync-matrix">
          <thead>
            <tr>
              <th scope="col">Branch</th>
              {remotes.map(remote => (
                <th key={remote.name} scope="col">
                  <TooltippedContent
                    tooltip={remote.url}
                    className="remote-sync-matrix-remote"
                  >
                    {remote.name}
                  </TooltippedContent>
                  <span className="remote-sync-matrix-host">
                    {getRemoteHostLabel(getRemoteHost(remote.url))}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.rows.map(row => (
              <tr key={row.branchName}>
                <th scope="row">
                  <TooltippedContent
                    tooltip={row.branchName}
                    onlyWhenOverflowed={true}
                  >
                    {row.branchName}
                  </TooltippedContent>
                </th>
                {row.cells.map(cell => (
                  <td key={cell.remoteName}>
                    {this.renderCell(cell.branchName, cell.state)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  private renderCell(branchName: string, state: SyncCellState) {
    const label = describeCellState(state)

    switch (state.kind) {
      case 'loading':
        return (
          <TooltippedContent className="sync-cell loading" tooltip={label}>
            <Octicon symbol={syncClockwise} className="spin" />
          </TooltippedContent>
        )
      case 'locked':
        return (
          <button
            type="button"
            className="sync-cell locked"
            onClick={this.onEditPolicy(branchName)}
            aria-label={`${branchName} is locked out of this remote (${describeRemoteAllowList(
              state.allowed
            )}). Change policy.`}
          >
            <Octicon symbol={octicons.lock} />
          </button>
        )
      case 'absent':
        return (
          <TooltippedContent className="sync-cell absent" tooltip={label}>
            —
          </TooltippedContent>
        )
      case 'synced':
        return (
          <TooltippedContent className="sync-cell synced" tooltip={label}>
            <Octicon symbol={octicons.check} />
          </TooltippedContent>
        )
      case 'ahead':
        return (
          <TooltippedContent className="sync-cell ahead" tooltip={label}>
            <Octicon symbol={octicons.arrowUp} />
            {state.aheadBehind.ahead}
          </TooltippedContent>
        )
      case 'behind':
        return (
          <TooltippedContent className="sync-cell behind" tooltip={label}>
            <Octicon symbol={octicons.arrowDown} />
            {state.aheadBehind.behind}
          </TooltippedContent>
        )
      case 'diverged':
        return (
          <TooltippedContent className="sync-cell diverged" tooltip={label}>
            <Octicon symbol={octicons.arrowUp} />
            {state.aheadBehind.ahead}
            <Octicon symbol={octicons.arrowDown} />
            {state.aheadBehind.behind}
          </TooltippedContent>
        )
    }
  }

  private onEditPolicy = (branchName: string) => () => {
    this.props.dispatcher.showBranchRemotePolicy(
      this.props.repository,
      branchName
    )
  }
}
