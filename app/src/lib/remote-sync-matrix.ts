import { IAheadBehind } from '../models/branch'
import { IRemote } from '../models/remote'
import { RemoteAllowList, isRemoteAllowed } from '../models/remote-policy'

/**
 * The state of one branch with respect to one remote.
 *
 * `absent` and `behind` are deliberately distinct: a ref that doesn't exist on
 * a host is a different situation from one that exists and is out of date, and
 * conflating them is the easiest way to make this table lie.
 */
export type SyncCellState =
  /** Policy forbids this branch from reaching this remote. */
  | { readonly kind: 'locked'; readonly allowed: RemoteAllowList }
  /** The remote has no such branch. */
  | { readonly kind: 'absent' }
  /** Both sides are at the same commit. */
  | { readonly kind: 'synced' }
  /** Divergence, in one direction or both. */
  | {
      readonly kind: 'ahead' | 'behind' | 'diverged'
      readonly aheadBehind: IAheadBehind
    }
  /**
   * The comparison hasn't resolved yet. Carries the two object ids so the
   * caller can ask for the ahead/behind counts and fill the cell in when they
   * arrive. Object ids rather than refs because AheadBehindStore caches on what
   * it's given and has no way to notice a ref moving.
   */
  | {
      readonly kind: 'loading'
      readonly from: string
      readonly to: string
    }

/** A local branch and the commit it points at. */
export interface IMatrixBranch {
  readonly name: string
  readonly sha: string
}

export interface ISyncMatrixCell {
  readonly branchName: string
  readonly remoteName: string
  readonly state: SyncCellState
}

export interface ISyncMatrixRow {
  readonly branchName: string
  readonly cells: ReadonlyArray<ISyncMatrixCell>
}

export interface ISyncMatrix {
  readonly remotes: ReadonlyArray<IRemote>
  readonly rows: ReadonlyArray<ISyncMatrixRow>
}

/** The remote-tracking ref a branch would have on a given remote. */
export function remoteTrackingRef(
  remoteName: string,
  branchName: string
): string {
  return `refs/remotes/${remoteName}/${branchName}`
}

/** The local ref for a branch name. */
export function localBranchRef(branchName: string): string {
  return `refs/heads/${branchName}`
}

/**
 * Turn an ahead/behind count into a cell state.
 *
 * A null count is what `getAheadBehind` returns when a ref doesn't resolve,
 * which in this context means the branch isn't on that remote.
 */
export function cellStateFromAheadBehind(
  aheadBehind: IAheadBehind | null
): SyncCellState {
  if (aheadBehind === null) {
    return { kind: 'absent' }
  }

  const { ahead, behind } = aheadBehind

  if (ahead === 0 && behind === 0) {
    return { kind: 'synced' }
  }

  if (ahead > 0 && behind > 0) {
    return { kind: 'diverged', aheadBehind }
  }

  return { kind: ahead > 0 ? 'ahead' : 'behind', aheadBehind }
}

/**
 * Work out one cell without running git where it isn't needed.
 *
 * Policy is checked first, then ref existence, then whether the two sides are
 * already at the same commit — which is the common case and costs nothing.
 * Only genuinely diverged pairs need an ahead/behind count, so a repository
 * with many branches and several remotes doesn't turn into an N×M storm of
 * `rev-list` invocations.
 */
export function deriveCellState(
  branch: IMatrixBranch,
  remoteName: string,
  refs: ReadonlyMap<string, string>,
  policy: RemoteAllowList
): SyncCellState {
  if (policy.kind !== 'unset' && !isRemoteAllowed(policy, remoteName)) {
    return { kind: 'locked', allowed: policy }
  }

  const remoteSha = refs.get(remoteTrackingRef(remoteName, branch.name))

  if (remoteSha === undefined) {
    return { kind: 'absent' }
  }

  if (branch.sha === remoteSha) {
    return { kind: 'synced' }
  }

  return { kind: 'loading', from: branch.sha, to: remoteSha }
}

/**
 * Build the whole branch × remote grid.
 *
 * `refs` is a single `for-each-ref` reading of the repository — every local
 * head and every remote-tracking ref, mapped to its object id.
 */
export function buildSyncMatrix(
  branches: ReadonlyArray<IMatrixBranch>,
  remotes: ReadonlyArray<IRemote>,
  refs: ReadonlyMap<string, string>,
  policies: ReadonlyMap<string, RemoteAllowList>
): ISyncMatrix {
  const rows = branches.map(branch => {
    const policy = policies.get(branch.name) ?? { kind: 'unset' as const }

    return {
      branchName: branch.name,
      cells: remotes.map(remote => ({
        branchName: branch.name,
        remoteName: remote.name,
        state: deriveCellState(branch, remote.name, refs, policy),
      })),
    }
  })

  return { remotes, rows }
}

/**
 * Replace a cell's state once its ahead/behind count has been resolved.
 *
 * Returns the same matrix when nothing changed, so callers can skip a render.
 */
export function withResolvedCell(
  matrix: ISyncMatrix,
  branchName: string,
  remoteName: string,
  aheadBehind: IAheadBehind | null
): ISyncMatrix {
  let changed = false

  const rows = matrix.rows.map(row => {
    if (row.branchName !== branchName) {
      return row
    }

    const cells = row.cells.map(cell => {
      if (cell.remoteName !== remoteName || cell.state.kind !== 'loading') {
        return cell
      }

      changed = true
      return { ...cell, state: cellStateFromAheadBehind(aheadBehind) }
    })

    return changed ? { ...row, cells } : row
  })

  return changed ? { ...matrix, rows } : matrix
}

/** Every cell still waiting on an ahead/behind count. */
export function pendingCells(
  matrix: ISyncMatrix
): ReadonlyArray<ISyncMatrixCell> {
  return matrix.rows
    .flatMap(row => row.cells)
    .filter(cell => cell.state.kind === 'loading')
}

/** A short label for a cell, for narrow layouts and accessible names. */
export function describeCellState(state: SyncCellState): string {
  switch (state.kind) {
    case 'locked':
      return 'Locked'
    case 'absent':
      return 'Not on this remote'
    case 'synced':
      return 'In sync'
    case 'loading':
      return 'Comparing…'
    case 'ahead':
      return `${state.aheadBehind.ahead} ahead`
    case 'behind':
      return `${state.aheadBehind.behind} behind`
    case 'diverged':
      return `${state.aheadBehind.ahead} ahead, ${state.aheadBehind.behind} behind`
  }
}
