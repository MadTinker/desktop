import { join, sep } from 'path'
import {
  Repository,
  ILocalRepositoryState,
  nameOf,
  isRepositoryWithGitHubRepository,
  RepositoryWithGitHubRepository,
} from '../../models/repository'
import { CloningRepository } from '../../models/cloning-repository'
import { getHTMLURL } from '../../lib/api'
import { caseInsensitiveCompare, compare } from '../../lib/compare'
import { IFilterListGroup, IFilterListItem } from '../lib/filter-list'
import { IAheadBehind } from '../../models/branch'
import { assertNever } from '../../lib/fatal-error'
import { isDotCom } from '../../lib/endpoint-capabilities'
import { Owner } from '../../models/owner'
import {
  ICustomRepositoryGroup,
  RepositoryCustomOrderKey,
} from './repository-group-types'

export type RepositoryListGroup =
  | {
      kind: 'favorites' | 'recent' | 'other'
    }
  | {
      kind: 'custom-group'
      groupId: string
      groupName: string
    }
  | {
      kind: 'dotcom'
      owner: Owner
    }
  | {
      kind: 'enterprise'
      host: string
    }

/**
 * Returns a unique grouping key (string) for a repository group. Doubles as a
 * case sensitive sorting key (i.e the case sensitive sort order of the keys is
 * the order in which the groups will be displayed in the repository list).
 */
export const getGroupKey = (group: RepositoryListGroup) => {
  const { kind } = group
  switch (kind) {
    case 'favorites':
      return `0:favorites`
    case 'custom-group':
      return `1:custom-group:${group.groupId}`
    case 'recent':
      return `2:recent`
    case 'dotcom':
      return `3:dotcom:${group.owner.login}`
    case 'enterprise':
      return `4:enterprise:${group.host}`
    case 'other':
      return `5:other`
    default:
      assertNever(group, `Unknown repository group kind ${kind}`)
  }
}
export type Repositoryish = Repository | CloningRepository

export interface IRepositoryListItem extends IFilterListItem {
  readonly text: ReadonlyArray<string>
  readonly id: string
  readonly repository: Repositoryish
  readonly needsDisambiguation: boolean
  readonly isFavorite: boolean
  readonly aheadBehind: IAheadBehind | null
  readonly changedFilesCount: number
  /** The group key this item belongs to (for drag-reorder scoping) */
  readonly groupKey: string
  /** Depth in the monorepo→subrepo tree (0 = top-level). */
  readonly nestingLevel: number
  /** The repository id this item is nested under, or null if top-level. */
  readonly parentRepoId: number | null
  /** Whether this item has nested subrepos beneath it. */
  readonly hasChildren: boolean
  /**
   * When set, this row is a placeholder for a submodule declared in the parent
   * monorepo's .gitmodules that hasn't been added to the app yet. Its
   * `repository` field points at the parent repo purely as a placeholder.
   */
  readonly ghost?: IGhostSubmodule
}

/** A submodule declared in .gitmodules but not yet added to the app. */
export interface IGhostSubmodule {
  /** Absolute on-disk path of the submodule working tree. */
  readonly path: string
  /** Display name (the submodule's directory leaf). */
  readonly name: string
  /** Repository id of the enclosing monorepo. */
  readonly parentRepoId: number
}

/** A declared submodule of a repo: absolute path + display name. */
export interface IDeclaredSubmodule {
  readonly path: string
  readonly name: string
}

const recentRepositoriesThreshold = 7

const getHostForRepository = (repo: RepositoryWithGitHubRepository) =>
  new URL(getHTMLURL(repo.gitHubRepository.endpoint)).host

const getGroupForRepository = (repo: Repositoryish): RepositoryListGroup => {
  if (repo instanceof Repository && isRepositoryWithGitHubRepository(repo)) {
    return isDotCom(repo.gitHubRepository.endpoint)
      ? { kind: 'dotcom', owner: repo.gitHubRepository.owner }
      : { kind: 'enterprise', host: getHostForRepository(repo) }
  }
  return { kind: 'other' }
}

type RepoGroupItem = { group: RepositoryListGroup; repos: Repositoryish[] }

export function groupRepositories(
  repositories: ReadonlyArray<Repositoryish>,
  localRepositoryStateLookup: ReadonlyMap<number, ILocalRepositoryState>,
  recentRepositories: ReadonlyArray<number>,
  favoriteRepositories: ReadonlyArray<number> = [],
  customGroups: ReadonlyArray<ICustomRepositoryGroup> = [],
  submoduleMap: ReadonlyMap<
    number,
    ReadonlyArray<IDeclaredSubmodule>
  > = new Map(),
  existingRepoPaths: ReadonlySet<string> = new Set()
): ReadonlyArray<IFilterListGroup<IRepositoryListItem, RepositoryListGroup>> {
  const includeRecentGroup = repositories.length > recentRepositoriesThreshold
  const recentSet = includeRecentGroup ? new Set(recentRepositories) : undefined
  const favoriteSet = new Set(favoriteRepositories)

  // Build reverse lookup: repoId → custom groups it belongs to
  const repoToCustomGroups = new Map<number, ICustomRepositoryGroup[]>()
  for (const cg of customGroups) {
    for (const repoId of cg.repositoryIds) {
      const existing = repoToCustomGroups.get(repoId) ?? []
      existing.push(cg)
      repoToCustomGroups.set(repoId, existing)
    }
  }

  const groups = new Map<string, RepoGroupItem>()

  const addToGroup = (group: RepositoryListGroup, repo: Repositoryish) => {
    const key = getGroupKey(group)
    let rg = groups.get(key)
    if (!rg) {
      rg = { group, repos: [] }
      groups.set(key, rg)
    }

    rg.repos.push(repo)
  }

  for (const repo of repositories) {
    if (favoriteSet.has(repo.id) && repo instanceof Repository) {
      addToGroup({ kind: 'favorites' }, repo)
    }

    const memberGroups = repoToCustomGroups.get(repo.id)
    const inCustomGroup =
      memberGroups !== undefined && repo instanceof Repository
    if (inCustomGroup) {
      for (const cg of memberGroups!) {
        addToGroup(
          { kind: 'custom-group', groupId: cg.id, groupName: cg.name },
          repo
        )
      }
    }

    const inRecent =
      recentSet?.has(repo.id) === true && repo instanceof Repository
    if (inRecent) {
      addToGroup({ kind: 'recent' }, repo)
    }

    if (!inCustomGroup && !inRecent) {
      addToGroup(getGroupForRepository(repo), repo)
    }
  }

  return Array.from(groups)
    .sort(([xKey], [yKey]) => compare(xKey, yKey))
    .map(([, { group, repos }]) => ({
      identifier: group,
      items: toSortedListItems(
        group,
        repos,
        localRepositoryStateLookup,
        groups,
        favoriteSet,
        submoduleMap,
        existingRepoPaths
      ),
    }))
}

// Returns the display title for a repository, which is either the alias
// (if available) or the name.
const getDisplayTitle = (r: Repositoryish) =>
  r instanceof Repository && r.alias != null ? r.alias : r.name

/** Groups whose items are always duplicated in another group (dedup skip). */
const isVirtualGroup = (kind: RepositoryListGroup['kind']) =>
  kind === 'recent' || kind === 'favorites' || kind === 'custom-group'

/** Whether a group supports user-defined ordering via drag-to-reorder. */
export const isReorderableGroup = (kind: RepositoryListGroup['kind']) =>
  kind === 'favorites' || kind === 'custom-group'

/** Read the per-group custom order map from localStorage. */
export function getCustomOrderMap(): Record<string, ReadonlyArray<number>> {
  try {
    const raw = localStorage.getItem(RepositoryCustomOrderKey)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

/** Write the per-group custom order map to localStorage. */
export function setCustomOrderMap(
  orderMap: Record<string, ReadonlyArray<number>>
) {
  localStorage.setItem(RepositoryCustomOrderKey, JSON.stringify(orderMap))
}

const toSortedListItems = (
  group: RepositoryListGroup,
  repositories: ReadonlyArray<Repositoryish>,
  localRepositoryStateLookup: ReadonlyMap<number, ILocalRepositoryState>,
  groups: Map<string, RepoGroupItem>,
  favoriteSet: ReadonlySet<number>,
  submoduleMap: ReadonlyMap<number, ReadonlyArray<IDeclaredSubmodule>>,
  existingRepoPaths: ReadonlySet<string>
): IRepositoryListItem[] => {
  const key = getGroupKey(group)
  const groupNames = new Map<string, number>()
  const allNames = new Map<string, number>()

  for (const groupItem of groups.values()) {
    // Items in virtual groups are by definition present in another
    // group and therefore we don't want to count them for disambiguation.
    if (isVirtualGroup(groupItem.group.kind)) {
      continue
    }

    for (const title of groupItem.repos.map(getDisplayTitle)) {
      allNames.set(title, (allNames.get(title) ?? 0) + 1)
      if (groupItem.group === group) {
        groupNames.set(title, (groupNames.get(title) ?? 0) + 1)
      }
    }
  }

  const items = repositories.map(r => {
    const repoState = localRepositoryStateLookup.get(r.id)
    const title = getDisplayTitle(r)

    return {
      text: r instanceof Repository ? [title, nameOf(r)] : [title],
      id: r.id.toString(),
      repository: r,
      isFavorite: favoriteSet.has(r.id),
      needsDisambiguation:
        ((groupNames.get(title) ?? 0) > 1 && group.kind === 'enterprise') ||
        ((allNames.get(title) ?? 0) > 1 && isVirtualGroup(group.kind)),
      aheadBehind: repoState?.aheadBehind ?? null,
      changedFilesCount: repoState?.changedFilesCount ?? 0,
      groupKey: key,
      nestingLevel: 0,
      parentRepoId: null,
      hasChildren: false,
    }
  })

  // For reorderable groups, apply user-defined order if available
  if (isReorderableGroup(group.kind)) {
    const orderMap = getCustomOrderMap()
    const customOrder = orderMap[key]
    if (customOrder && customOrder.length > 0) {
      const orderIndex = new Map(customOrder.map((id, idx) => [id, idx]))
      return applyNesting(
        submoduleMap,
        existingRepoPaths,
        items.sort((a, b) => {
          const ai = orderIndex.get(a.repository.id)
          const bi = orderIndex.get(b.repository.id)
          // Items with custom order come first, in order; rest alphabetical after
          if (ai !== undefined && bi !== undefined) {
            return ai - bi
          }
          if (ai !== undefined) {
            return -1
          }
          if (bi !== undefined) {
            return 1
          }
          return caseInsensitiveCompare(
            getDisplayTitle(a.repository),
            getDisplayTitle(b.repository)
          )
        })
      )
    }
  }

  return applyNesting(
    submoduleMap,
    existingRepoPaths,
    items.sort(({ repository: x }, { repository: y }) =>
      caseInsensitiveCompare(getDisplayTitle(x), getDisplayTitle(y))
    )
  )
}

/**
 * Whether `child` lives on disk inside `parent` (a strict descendant path).
 * Used to detect monorepo→subrepo relationships from absolute repo paths.
 */
export const isPathInside = (child: string, parent: string): boolean => {
  const base = parent.endsWith(sep) ? parent : parent + sep
  return child.length > base.length && child.startsWith(base)
}

/**
 * Re-order a flat, already-sorted list of repository items into a monorepo
 * tree: each subrepo (a repo whose on-disk path sits inside another in-group
 * repo) is pulled directly beneath its closest enclosing repo and tagged with a
 * nesting level. Root ordering (alphabetical or user drag-order) is preserved;
 * children inherit their parent's relative sibling order.
 */
const applyNesting = (
  submoduleMap: ReadonlyMap<number, ReadonlyArray<IDeclaredSubmodule>>,
  existingRepoPaths: ReadonlySet<string>,
  items: ReadonlyArray<IRepositoryListItem>
): IRepositoryListItem[] => {
  // Only real (non-cloning) repositories have stable on-disk paths to nest by.
  const pathItems = items.filter(i => i.repository instanceof Repository)

  // macOS/Windows filesystems are case-insensitive; git paths from .gitmodules
  // may differ in case from the path stored in the app. Normalise once.
  const normalise = __DARWIN__ || __WIN32__
    ? (p: string) => p.toLowerCase()
    : (p: string) => p
  const normalisedExisting = new Set([...existingRepoPaths].map(normalise))

  // Build ghost rows for submodules declared in a repo's .gitmodules that
  // haven't been added to the app yet (so they're not already nested).
  const ghostChildrenOf = new Map<string, IRepositoryListItem[]>()
  for (const item of pathItems) {
    const repo = item.repository as Repository
    const declared = submoduleMap.get(repo.id)
    if (declared === undefined || declared.length === 0) {
      continue
    }
    for (const sub of declared) {
      // `git submodule status` yields paths relative to the parent worktree;
      // resolve to absolute so dedup and "add" both point at the real root
      // (not the relative path, which resolves against cwd → .git/modules).
      const absPath = join(repo.path, sub.path)
      if (normalisedExisting.has(normalise(absPath))) {
        continue // already added → it's a real nested child, skip the ghost
      }
      const ghosts = ghostChildrenOf.get(item.id) ?? []
      ghosts.push({
        text: [sub.name],
        id: `ghost:${sub.path}`,
        repository: repo, // placeholder; ghosts are never selected as a repo
        needsDisambiguation: false,
        isFavorite: false,
        aheadBehind: null,
        changedFilesCount: 0,
        groupKey: item.groupKey,
        nestingLevel: 0, // assigned during emit
        parentRepoId: repo.id,
        hasChildren: false,
        ghost: { path: absPath, name: sub.name, parentRepoId: repo.id },
      })
      ghostChildrenOf.set(item.id, ghosts)
    }
  }

  const hasGhosts = ghostChildrenOf.size > 0
  if (pathItems.length < 2 && !hasGhosts) {
    return [...items]
  }

  const parentOf = new Map<string, string | null>()
  for (const item of items) {
    const repo = item.repository
    if (!(repo instanceof Repository)) {
      parentOf.set(item.id, null)
      continue
    }
    let best: IRepositoryListItem | null = null
    let bestLen = -1
    for (const other of pathItems) {
      if (other === item) {
        continue
      }
      const otherPath = (other.repository as Repository).path
      if (isPathInside(repo.path, otherPath) && otherPath.length > bestLen) {
        best = other
        bestLen = otherPath.length
      }
    }
    parentOf.set(item.id, best ? best.id : null)
  }

  const childrenOf = new Map<string, IRepositoryListItem[]>()
  const roots: IRepositoryListItem[] = []
  for (const item of items) {
    const parentId = parentOf.get(item.id) ?? null
    if (parentId === null) {
      roots.push(item)
    } else {
      const arr = childrenOf.get(parentId) ?? []
      arr.push(item)
      childrenOf.set(parentId, arr)
    }
  }

  const out: IRepositoryListItem[] = []
  const emit = (item: IRepositoryListItem, level: number) => {
    const kids = childrenOf.get(item.id) ?? []
    const ghostKids = ghostChildrenOf.get(item.id) ?? []
    const parentId = parentOf.get(item.id) ?? null
    out.push({
      ...item,
      nestingLevel: level,
      parentRepoId: parentId !== null ? parseInt(parentId, 10) : null,
      hasChildren: kids.length > 0 || ghostKids.length > 0,
    })
    for (const kid of kids) {
      emit(kid, level + 1)
    }
    // Un-added declared submodules render after the real nested subrepos.
    for (const ghost of ghostKids) {
      out.push({ ...ghost, nestingLevel: level + 1 })
    }
  }
  for (const root of roots) {
    emit(root, 0)
  }
  return out
}
