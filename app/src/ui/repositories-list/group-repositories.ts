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
  customGroups: ReadonlyArray<ICustomRepositoryGroup> = []
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
    if (memberGroups !== undefined && repo instanceof Repository) {
      for (const cg of memberGroups) {
        addToGroup(
          { kind: 'custom-group', groupId: cg.id, groupName: cg.name },
          repo
        )
      }
    }

    if (recentSet?.has(repo.id) && repo instanceof Repository) {
      addToGroup({ kind: 'recent' }, repo)
    }

    addToGroup(getGroupForRepository(repo), repo)
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
        favoriteSet
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
  favoriteSet: ReadonlySet<number>
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
    }
  })

  // For reorderable groups, apply user-defined order if available
  if (isReorderableGroup(group.kind)) {
    const orderMap = getCustomOrderMap()
    const customOrder = orderMap[key]
    if (customOrder && customOrder.length > 0) {
      const orderIndex = new Map(customOrder.map((id, idx) => [id, idx]))
      return items.sort((a, b) => {
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
    }
  }

  return items.sort(({ repository: x }, { repository: y }) =>
    caseInsensitiveCompare(getDisplayTitle(x), getDisplayTitle(y))
  )
}
