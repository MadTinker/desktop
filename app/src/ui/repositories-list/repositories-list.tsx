import * as React from 'react'

import {
  commitGrammar,
  RepositoryListItem,
  GhostSubmoduleListItem,
} from './repository-list-item'
import {
  groupRepositories,
  IRepositoryListItem,
  IGhostSubmodule,
  IDeclaredSubmodule,
  Repositoryish,
  RepositoryListGroup,
  getGroupKey,
  isReorderableGroup,
  getCustomOrderMap,
  setCustomOrderMap,
} from './group-repositories'
import { basename, join } from 'path'
import { listSubmodules } from '../../lib/git'
import { IFilterListGroup } from '../lib/filter-list'
import { IMatches } from '../../lib/fuzzy-find'
import { ILocalRepositoryState, Repository } from '../../models/repository'
import { Dispatcher } from '../dispatcher'
import { Button } from '../lib/button'
import { Octicon } from '../octicons'
import * as octicons from '../octicons/octicons.generated'
import { showContextualMenu } from '../../lib/menu-item'
import { IMenuItem } from '../../lib/menu-item'
import { PopupType } from '../../models/popup'
import { encodePathAsUrl } from '../../lib/path'
import { TooltippedContent } from '../lib/tooltipped-content'
import memoizeOne from 'memoize-one'
import { DynamicKeyboardShortcut } from '../keyboard-shortcut/dynamic-keyboard-shortcut'
import { generateRepositoryListContextMenu } from '../repositories-list/repository-list-item-context-menu'
import { SectionFilterList } from '../lib/section-filter-list'
import { assertNever } from '../../lib/fatal-error'
import { IAheadBehind } from '../../models/branch'
import {
  ICustomRepositoryGroup,
  CollapsedRepositoryGroupsKey,
  CollapsedRepositoryParentsKey,
} from './repository-group-types'
import { getStringArray, setStringArray } from '../../lib/local-storage'

const BlankSlateImage = encodePathAsUrl(__dirname, 'static/empty-no-repo.svg')

interface IRepositoriesListProps {
  readonly selectedRepository: Repositoryish | null
  readonly repositories: ReadonlyArray<Repositoryish>
  readonly recentRepositories: ReadonlyArray<number>
  readonly favoriteRepositories: ReadonlyArray<number>
  readonly customRepositoryGroups: ReadonlyArray<ICustomRepositoryGroup>

  /** A cache of the latest repository state values, keyed by the repository id */
  readonly localRepositoryStateLookup: ReadonlyMap<
    number,
    ILocalRepositoryState
  >

  /** Called when a repository has been selected. */
  readonly onSelectionChanged: (repository: Repositoryish) => void

  /** Whether the user has enabled the setting to confirm removing a repository from the app */
  readonly askForConfirmationOnRemoveRepository: boolean

  /** Called when the repository should be removed. */
  readonly onRemoveRepository: (repository: Repositoryish) => void

  /** Called when the repository should be shown in Finder/Explorer/File Manager. */
  readonly onShowRepository: (repository: Repositoryish) => void

  /** Called when the repository should be opened on GitHub in the default web browser. */
  readonly onViewOnGitHub: (repository: Repositoryish) => void

  /** Called when the repository should be shown in the shell. */
  readonly onOpenInShell: (repository: Repositoryish) => void

  /** Called when the repository should be opened in an external editor */
  readonly onOpenInExternalEditor: (repository: Repositoryish) => void

  /** The current external editor selected by the user */
  readonly externalEditorLabel?: string

  /** The label for the user's preferred shell. */
  readonly shellLabel?: string

  /** The callback to fire when the filter text has changed */
  readonly onFilterTextChanged: (text: string) => void

  /** The text entered by the user to filter their repository list */
  readonly filterText: string

  readonly dispatcher: Dispatcher
}

interface IRepositoriesListState {
  readonly newRepositoryMenuExpanded: boolean
  readonly selectedItem: IRepositoryListItem | null
  readonly collapsedGroups: ReadonlySet<string>
  /** Repo IDs (as strings) whose nested subrepos are collapsed */
  readonly collapsedParents: ReadonlySet<string>
  /** Repository ID currently being dragged */
  readonly dragSourceId: number | null
  /** Group key of the drag source */
  readonly dragGroupKey: string | null
  /** Repository ID currently under the drag cursor */
  readonly dragTargetId: number | null
  /** Counter to force re-render after reorder */
  readonly reorderVersion: number
  /** Submodules declared in each repo's .gitmodules, keyed by repo id. */
  readonly submoduleMap: ReadonlyMap<number, ReadonlyArray<IDeclaredSubmodule>>
}

const RowHeight = 29

// Persists each repository's declared submodules across panel open/close and
// unrelated re-renders, keyed per repo (id + path). Keying per repo — rather
// than by a whole-list signature — means one repo changing (or the list
// growing) never invalidates the others, so re-opening the panel reuses the
// cache instead of re-running `git submodule status` across the whole list
// (which made the list visibly jump as ghost rows popped in). Cleared on app
// restart.
const submoduleCache = new Map<string, ReadonlyArray<IDeclaredSubmodule>>()

function submoduleCacheKey(repo: Repository): string {
  return `${repo.id}:${repo.path}`
}

/**
 * Drop any subrepo whose monorepo parent (or any ancestor) is collapsed, so a
 * collapsed folder hides its entire nested subtree.
 */
function hideCollapsedSubrepos(
  items: ReadonlyArray<IRepositoryListItem>,
  collapsedParents: ReadonlySet<string>
): IRepositoryListItem[] {
  const parentById = new Map(
    items.map(i => [i.id, i.parentRepoId] as const)
  )
  return items.filter(item => {
    let parentId = item.parentRepoId
    while (parentId !== null) {
      const key = parentId.toString()
      if (collapsedParents.has(key)) {
        return false
      }
      parentId = parentById.get(key) ?? null
    }
    return true
  })
}

/**
 * Iterate over all groups until a list item is found that matches
 * the id of the provided repository.
 */
function findMatchingListItem(
  groups: ReadonlyArray<
    IFilterListGroup<IRepositoryListItem, RepositoryListGroup>
  >,
  selectedRepository: Repositoryish | null
) {
  if (selectedRepository !== null) {
    for (const group of groups) {
      for (const item of group.items) {
        // Ghost rows borrow their parent's repository as a placeholder — never
        // treat them as the selected repo.
        if (item.ghost === undefined && item.repository.id === selectedRepository.id) {
          return item
        }
      }
    }
  }

  return null
}

/** The list of user-added repositories. */
export class RepositoriesList extends React.Component<
  IRepositoriesListProps,
  IRepositoriesListState
> {
  /**
   * A memoized function for grouping repositories for display
   * in the FilterList. The group will not be recomputed as long
   * as the provided list of repositories is equal to the last
   * time the method was called (reference equality).
   */
  private getRepositoryGroups = memoizeOne(
    (
      repositories: ReadonlyArray<Repositoryish> | null,
      localRepositoryStateLookup: ReadonlyMap<number, ILocalRepositoryState>,
      recentRepositories: ReadonlyArray<number>,
      favoriteRepositories: ReadonlyArray<number>,
      customRepositoryGroups: ReadonlyArray<ICustomRepositoryGroup>,
      submoduleMap: ReadonlyMap<number, ReadonlyArray<IDeclaredSubmodule>>,
      _reorderVersion?: number
    ) => {
      if (repositories === null) {
        return []
      }
      const existingRepoPaths = new Set(
        repositories
          .filter((r): r is Repository => r instanceof Repository)
          .map(r => r.path)
      )
      return groupRepositories(
        repositories,
        localRepositoryStateLookup,
        recentRepositories,
        favoriteRepositories,
        customRepositoryGroups,
        submoduleMap,
        existingRepoPaths
      )
    }
  )

  /**
   * A memoized function for finding the selected list item based
   * on an IAPIRepository instance. The selected item will not be
   * recomputed as long as the provided list of repositories and
   * the selected data object is equal to the last time the method
   * was called (reference equality).
   *
   * See findMatchingListItem for more details.
   */
  private getSelectedListItem = memoizeOne(findMatchingListItem)

  public constructor(props: IRepositoriesListProps) {
    super(props)

    this.state = {
      newRepositoryMenuExpanded: false,
      selectedItem: null,
      collapsedGroups: new Set(getStringArray(CollapsedRepositoryGroupsKey)),
      collapsedParents: new Set(getStringArray(CollapsedRepositoryParentsKey)),
      dragSourceId: null,
      dragGroupKey: null,
      dragTargetId: null,
      reorderVersion: 0,
      submoduleMap: new Map(),
    }
  }

  private submodulesUnmounted = false
  private submoduleScanInFlight = new Set<string>()
  private lastSelectedRepoId: number | null = null

  public componentDidMount() {
    this.invalidateSelectedRepoSubmodules()
    this.loadSubmodules()
  }

  public componentDidUpdate() {
    this.invalidateSelectedRepoSubmodules()
    this.loadSubmodules()
  }

  public componentWillUnmount() {
    this.submodulesUnmounted = true
  }

  /**
   * Drop the active repository's cached submodules whenever it becomes selected
   * — including on panel open (mount) — so the very next `loadSubmodules` re-scans
   * just that one repo. The rest of the list keeps serving from cache, so a
   * submodule added to the repo you're working on shows up on the next open
   * without re-scanning (and re-jumbling) the whole list.
   */
  private invalidateSelectedRepoSubmodules() {
    const selected = this.props.selectedRepository
    const id = selected instanceof Repository ? selected.id : null
    if (id === this.lastSelectedRepoId) {
      return
    }
    this.lastSelectedRepoId = id
    if (selected instanceof Repository) {
      submoduleCache.delete(submoduleCacheKey(selected))
    }
  }

  /**
   * Surface declared-but-not-added submodules as ghost rows nested under their
   * monorepo. Each repository is scanned with `git submodule status` at most
   * once per session and cached per repo (id + path); opening the panel again
   * or an unrelated re-render reuses the cache, so only genuinely-new or
   * changed repos incur git work. This keeps the list from jumping as ghost
   * rows re-populate every time the panel is opened.
   */
  private async loadSubmodules() {
    const repos = (this.props.repositories ?? []).filter(
      (r): r is Repository => r instanceof Repository
    )

    // Show whatever's already cached right away (no git), and collect the
    // repos we haven't scanned yet.
    const toScan = new Array<Repository>()
    for (const repo of repos) {
      const key = submoduleCacheKey(repo)
      if (!submoduleCache.has(key) && !this.submoduleScanInFlight.has(key)) {
        toScan.push(repo)
      }
    }

    this.applyCachedSubmoduleMap(repos)

    if (toScan.length === 0) {
      return
    }

    for (const repo of toScan) {
      this.submoduleScanInFlight.add(submoduleCacheKey(repo))
    }

    await Promise.all(
      toScan.map(async repo => {
        const key = submoduleCacheKey(repo)
        try {
          const entries = await listSubmodules(repo)
          // Uninitialized submodules have no working tree on disk yet, so
          // there's nothing to add — only surface checked-out ones as ghosts.
          const usable = entries
            .filter(e => e.status !== 'uninitialized')
            .map(e => ({
              path: join(repo.path, e.path),
              name: basename(e.path),
            }))
          submoduleCache.set(key, usable)
        } catch {
          // A repo we can't read submodules for contributes no ghosts. Cache
          // the empty result so we don't retry it on every render.
          submoduleCache.set(key, [])
        } finally {
          this.submoduleScanInFlight.delete(key)
        }
      })
    )

    if (!this.submodulesUnmounted) {
      this.applyCachedSubmoduleMap(repos)
    }
  }

  /**
   * Rebuild `submoduleMap` from the per-repo cache and push it to state, but
   * only when it differs from what's already rendered — so a `componentDidUpdate`
   * that changed nothing submodule-related doesn't trigger a needless re-render.
   */
  private applyCachedSubmoduleMap(repos: ReadonlyArray<Repository>) {
    const next = new Map<number, ReadonlyArray<IDeclaredSubmodule>>()
    for (const repo of repos) {
      const cached = submoduleCache.get(submoduleCacheKey(repo))
      if (cached !== undefined && cached.length > 0) {
        next.set(repo.id, cached)
      }
    }

    const current = this.state.submoduleMap
    if (current.size === next.size) {
      let identical = true
      for (const [id, subs] of next) {
        const cur = current.get(id)
        if (
          cur === undefined ||
          cur.length !== subs.length ||
          cur.some((s, i) => s.path !== subs[i].path)
        ) {
          identical = false
          break
        }
      }
      if (identical) {
        return
      }
    }

    this.setState({ submoduleMap: next })
  }

  private renderItem = (item: IRepositoryListItem, matches: IMatches) => {
    if (item.ghost !== undefined) {
      return (
        <GhostSubmoduleListItem
          key={item.id}
          ghost={item.ghost}
          nestingLevel={item.nestingLevel}
          onAdd={this.onAddSubmodule}
        />
      )
    }

    const repository = item.repository
    const draggable = isReorderableGroup(
      item.groupKey.startsWith('0:')
        ? 'favorites'
        : item.groupKey.startsWith('1:')
          ? 'custom-group'
          : 'other'
    )

    return (
      <RepositoryListItem
        key={repository.id}
        repository={repository}
        needsDisambiguation={item.needsDisambiguation}
        isFavorite={item.isFavorite}
        matches={matches}
        aheadBehind={item.aheadBehind}
        changedFilesCount={item.changedFilesCount}
        isDraggable={draggable}
        isDragSource={this.state.dragSourceId === repository.id}
        isDragTarget={this.state.dragTargetId === repository.id}
        onDragStart={
          draggable
            ? e => this.onRepoDragStart(e, repository.id, item.groupKey)
            : undefined
        }
        onDragOver={
          draggable ? e => this.onRepoDragOver(e, repository.id) : undefined
        }
        onDrop={
          draggable ? e => this.onRepoDrop(e, repository.id) : undefined
        }
        onDragEnd={this.onRepoDragEnd}
        nestingLevel={item.nestingLevel}
        hasChildren={item.hasChildren}
        isCollapsed={this.state.collapsedParents.has(item.id)}
        onToggleCollapsed={() => this.toggleParentCollapsed(item.id)}
      />
    )
  }

  private toggleParentCollapsed(repoItemId: string) {
    this.setState(prev => {
      const next = new Set(prev.collapsedParents)
      if (next.has(repoItemId)) {
        next.delete(repoItemId)
      } else {
        next.add(repoItemId)
      }
      setStringArray(CollapsedRepositoryParentsKey, [...next])
      return { collapsedParents: next }
    })
  }

  private getAheadBehindTooltip = (aheadBehind: IAheadBehind | null) => {
    if (aheadBehind === null) {
      return null
    }

    const { ahead, behind } = aheadBehind

    if (behind === 0 && ahead === 0) {
      return null
    }

    return (
      'The currently checked out branch is' +
      (behind ? ` ${commitGrammar(behind)} behind ` : '') +
      (behind && ahead ? 'and' : '') +
      (ahead ? ` ${commitGrammar(ahead)} ahead of ` : '') +
      'its tracked branch.'
    )
  }

  private renderRowFocusTooltip = (
    item: IRepositoryListItem
  ): JSX.Element | string | null => {
    const { repository, aheadBehind, changedFilesCount } = item
    const gitHubRepo =
      repository instanceof Repository ? repository.gitHubRepository : null
    const alias = repository instanceof Repository ? repository.alias : null
    const realName = gitHubRepo ? gitHubRepo.fullName : repository.name
    const aheadBehindTooltip = this.getAheadBehindTooltip(aheadBehind)
    const hasChanges = changedFilesCount > 0
    const uncommittedChangesTooltip = hasChanges
      ? `There are uncommitted changes in this repository.`
      : null

    const ahead = aheadBehind?.ahead ?? 0
    const behind = aheadBehind?.behind ?? 0

    return (
      <div className="repository-list-item-tooltip list-item-tooltip">
        <div>
          <div className="label">Full Name: </div>
          {realName}
          {alias && <> ({alias})</>}
        </div>
        <div>
          <div className="label">Path: </div>
          {repository.path}
        </div>
        {aheadBehindTooltip && (
          <div>
            <div className="label">
              <div className="ahead-behind">
                {ahead > 0 && <Octicon symbol={octicons.arrowUp} />}
                {behind > 0 && <Octicon symbol={octicons.arrowDown} />}
              </div>
            </div>
            {aheadBehindTooltip}
          </div>
        )}
        {uncommittedChangesTooltip && (
          <div>
            <div className="label">
              <span className="change-indicator-wrapper">
                <Octicon symbol={octicons.dotFill} />
              </span>
            </div>
            {uncommittedChangesTooltip}
          </div>
        )}
      </div>
    )
  }

  private getGroupLabel(group: RepositoryListGroup) {
    const { kind } = group
    if (kind === 'favorites') {
      return 'Favorites'
    } else if (kind === 'custom-group') {
      return group.groupName
    } else if (kind === 'enterprise') {
      return group.host
    } else if (kind === 'other') {
      return 'Other'
    } else if (kind === 'dotcom') {
      return group.owner.login
    } else if (kind === 'recent') {
      return 'Recent'
    } else {
      assertNever(kind, `Unknown repository group kind ${kind}`)
    }
  }

  private renderGroupHeader = (group: RepositoryListGroup) => {
    const label = this.getGroupLabel(group)
    const key = getGroupKey(group)
    const collapsed = this.state.collapsedGroups.has(key)

    return (
      <div
        key={key}
        className="filter-list-group-header collapsible-group-header"
        onClick={() => this.toggleGroupCollapsed(key)}
      >
        <Octicon
          className="collapse-chevron"
          symbol={collapsed ? octicons.chevronRight : octicons.chevronDown}
        />
        <TooltippedContent
          tooltip={label}
          onlyWhenOverflowed={true}
          tagName="span"
        >
          {label}
        </TooltippedContent>
      </div>
    )
  }

  private toggleGroupCollapsed(groupKey: string) {
    this.setState(prev => {
      const next = new Set(prev.collapsedGroups)
      if (next.has(groupKey)) {
        next.delete(groupKey)
      } else {
        next.add(groupKey)
      }
      setStringArray(CollapsedRepositoryGroupsKey, [...next])
      return { collapsedGroups: next }
    })
  }

  private onItemClick = (item: IRepositoryListItem) => {
    if (item.ghost !== undefined) {
      this.onAddSubmodule(item.ghost)
      return
    }
    const hasIndicator =
      item.changedFilesCount > 0 ||
      (item.aheadBehind !== null
        ? item.aheadBehind.ahead > 0 || item.aheadBehind.behind > 0
        : false)
    this.props.dispatcher.recordRepoClicked(hasIndicator)
    this.props.onSelectionChanged(item.repository)
  }

  /** Add an un-added declared submodule without switching to it. */
  private onAddSubmodule = async (ghost: IGhostSubmodule) => {
    const added = await this.props.dispatcher.addRepositories([ghost.path])
    const repo = added[0]
    if (repo === undefined) {
      return
    }

    // Inherit every custom group the parent repo belongs to.
    for (const group of this.props.customRepositoryGroups) {
      if (group.repositoryIds.includes(ghost.parentRepoId)) {
        this.props.dispatcher.addRepositoryToGroup(repo.id, group.id)
      }
    }
  }

  private onItemContextMenu = (
    item: IRepositoryListItem,
    event: React.MouseEvent<HTMLDivElement>
  ) => {
    event.preventDefault()

    if (item.ghost !== undefined) {
      // Ghost rows aren't real repos yet — no repo context menu.
      return
    }

    const items = generateRepositoryListContextMenu({
      onRemoveRepository: this.props.onRemoveRepository,
      onShowRepository: this.props.onShowRepository,
      onOpenInShell: this.props.onOpenInShell,
      onOpenInExternalEditor: this.props.onOpenInExternalEditor,
      askForConfirmationOnRemoveRepository:
        this.props.askForConfirmationOnRemoveRepository,
      externalEditorLabel: this.props.externalEditorLabel,
      onChangeRepositoryAlias: this.onChangeRepositoryAlias,
      onRemoveRepositoryAlias: this.onRemoveRepositoryAlias,
      onViewOnGitHub: this.props.onViewOnGitHub,
      onCreateWorktree: this.onCreateWorktree,
      onShowWorktrees: this.onShowWorktrees,
      repository: item.repository,
      shellLabel: this.props.shellLabel,
      isFavorite: item.isFavorite,
      customRepositoryGroups: this.props.customRepositoryGroups,
      onToggleFavorite: this.onToggleFavorite,
      onAddToGroup: this.onAddToGroup,
      onRemoveFromGroup: this.onRemoveFromGroup,
      onCreateGroup: this.onCreateGroup,
    })

    showContextualMenu(items)
  }

  private getItemAriaLabel = (item: IRepositoryListItem) =>
    item.ghost !== undefined
      ? `Add submodule ${item.ghost.name}`
      : item.repository.name
  private getGroupAriaLabelGetter =
    (
      groups: ReadonlyArray<
        IFilterListGroup<IRepositoryListItem, RepositoryListGroup>
      >
    ) =>
    (group: number) =>
      this.getGroupLabel(groups[group].identifier)

  public render() {
    const allGroups = this.getRepositoryGroups(
      this.props.repositories,
      this.props.localRepositoryStateLookup,
      this.props.recentRepositories,
      this.props.favoriteRepositories,
      this.props.customRepositoryGroups,
      this.state.submoduleMap,
      this.state.reorderVersion
    )

    // Hide items in collapsed groups — header-only groups are supported
    // by the SectionFilterList when renderGroupHeader is provided. Also hide
    // subrepos nested under a collapsed monorepo parent.
    const { collapsedGroups, collapsedParents } = this.state
    const groups = allGroups.map(g => {
      if (collapsedGroups.has(getGroupKey(g.identifier))) {
        return { ...g, items: [] as IRepositoryListItem[] }
      }
      if (collapsedParents.size === 0) {
        return g
      }
      return { ...g, items: hideCollapsedSubrepos(g.items, collapsedParents) }
    })

    const selectedItem =
      this.state.selectedItem ??
      this.getSelectedListItem(allGroups, this.props.selectedRepository)

    return (
      <div className="repository-list">
        <SectionFilterList<IRepositoryListItem, RepositoryListGroup>
          rowHeight={RowHeight}
          selectedItem={selectedItem}
          filterText={this.props.filterText}
          onFilterTextChanged={this.props.onFilterTextChanged}
          renderItem={this.renderItem}
          renderRowFocusTooltip={this.renderRowFocusTooltip}
          renderGroupHeader={this.renderGroupHeader}
          onItemClick={this.onItemClick}
          renderPostFilter={this.renderPostFilter}
          renderNoItems={this.renderNoItems}
          groups={groups}
          invalidationProps={{
            repositories: this.props.repositories,
            filterText: this.props.filterText,
            collapsedGroups: this.state.collapsedGroups,
            collapsedParents: this.state.collapsedParents,
            submoduleMap: this.state.submoduleMap,
            reorderVersion: this.state.reorderVersion,
          }}
          onItemContextMenu={this.onItemContextMenu}
          getGroupAriaLabel={this.getGroupAriaLabelGetter(groups)}
          getItemAriaLabel={this.getItemAriaLabel}
          onSelectionChanged={this.onSelectionChanged}
        />
      </div>
    )
  }

  private onSelectionChanged = (selectedItem: IRepositoryListItem | null) => {
    this.setState({ selectedItem })
  }

  private renderPostFilter = () => {
    return (
      <Button
        className="new-repository-button"
        onClick={this.onNewRepositoryButtonClick}
        ariaExpanded={this.state.newRepositoryMenuExpanded}
        onKeyDown={this.onNewRepositoryButtonKeyDown}
      >
        Add
        <Octicon symbol={octicons.triangleDown} />
      </Button>
    )
  }

  private onNewRepositoryButtonKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>
  ) => {
    if (event.key === 'ArrowDown') {
      this.onNewRepositoryButtonClick()
    }
  }

  private renderNoItems = () => {
    return (
      <div className="no-items no-results-found">
        <img src={BlankSlateImage} className="blankslate-image" alt="" />
        <div className="title">Sorry, I can't find that repository</div>

        <div className="protip">
          ProTip! Press{' '}
          <div className="kbd-shortcut">
            <DynamicKeyboardShortcut actionId="add-local-repository" />
          </div>{' '}
          to quickly add a local repository, and{' '}
          <div className="kbd-shortcut">
            <DynamicKeyboardShortcut actionId="clone-repository" />
          </div>{' '}
          to clone from anywhere within the app
        </div>
      </div>
    )
  }

  private onNewRepositoryButtonClick = () => {
    const items: IMenuItem[] = [
      {
        label: __DARWIN__ ? 'Clone Repository…' : 'Clone repository…',
        action: this.onCloneRepository,
      },
      {
        label: __DARWIN__ ? 'Create New Repository…' : 'Create new repository…',
        action: this.onCreateNewRepository,
      },
      {
        label: __DARWIN__
          ? 'Add Existing Repository…'
          : 'Add existing repository…',
        action: this.onAddExistingRepository,
      },
    ]

    this.setState({ newRepositoryMenuExpanded: true })
    showContextualMenu(items).then(() => {
      this.setState({ newRepositoryMenuExpanded: false })
    })
  }

  private onCloneRepository = () => {
    this.props.dispatcher.showPopup({
      type: PopupType.CloneRepository,
      initialURL: null,
    })
  }

  private onAddExistingRepository = () => {
    this.props.dispatcher.showPopup({ type: PopupType.AddRepository })
  }

  private onCreateNewRepository = () => {
    this.props.dispatcher.showPopup({ type: PopupType.CreateRepository })
  }

  private onChangeRepositoryAlias = (repository: Repository) => {
    this.props.dispatcher.showPopup({
      type: PopupType.ChangeRepositoryAlias,
      repository,
    })
  }

  private onRemoveRepositoryAlias = (repository: Repository) => {
    this.props.dispatcher.changeRepositoryAlias(repository, null)
  }

  private onToggleFavorite = (repository: Repositoryish) => {
    this.props.dispatcher.toggleFavoriteRepository(repository.id)
  }

  private onAddToGroup = (repository: Repositoryish, groupId: string) => {
    this.props.dispatcher.addRepositoryToGroup(repository.id, groupId)

    // Propagate group membership to any already-added submodules of this repo.
    const submodules = this.state.submoduleMap.get(repository.id)
    if (submodules !== undefined) {
      const subPaths = new Set(submodules.map(s => s.path))
      for (const repo of this.props.repositories) {
        if (subPaths.has(repo.path)) {
          this.props.dispatcher.addRepositoryToGroup(repo.id, groupId)
        }
      }
    }
  }

  private onRemoveFromGroup = (repository: Repositoryish, groupId: string) => {
    this.props.dispatcher.removeRepositoryFromGroup(repository.id, groupId)

    // Propagate group removal to any already-added submodules of this repo.
    const submodules = this.state.submoduleMap.get(repository.id)
    if (submodules !== undefined) {
      const subPaths = new Set(submodules.map(s => s.path))
      for (const repo of this.props.repositories) {
        if (subPaths.has(repo.path)) {
          this.props.dispatcher.removeRepositoryFromGroup(repo.id, groupId)
        }
      }
    }
  }

  private onRepoDragStart = (
    e: React.DragEvent<HTMLDivElement>,
    repoId: number,
    groupKey: string
  ) => {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(repoId))
    this.setState({ dragSourceId: repoId, dragGroupKey: groupKey })
  }

  private onRepoDragOver = (
    e: React.DragEvent<HTMLDivElement>,
    repoId: number
  ) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (this.state.dragTargetId !== repoId) {
      this.setState({ dragTargetId: repoId })
    }
  }

  private onRepoDrop = (
    e: React.DragEvent<HTMLDivElement>,
    targetRepoId: number
  ) => {
    e.preventDefault()
    const { dragSourceId, dragGroupKey } = this.state

    if (
      dragSourceId === null ||
      dragGroupKey === null ||
      dragSourceId === targetRepoId
    ) {
      this.resetDragState()
      return
    }

    // Find the group items to determine current order
    const allGroups = this.getRepositoryGroups(
      this.props.repositories,
      this.props.localRepositoryStateLookup,
      this.props.recentRepositories,
      this.props.favoriteRepositories,
      this.props.customRepositoryGroups,
      this.state.submoduleMap,
      this.state.reorderVersion
    )

    const group = allGroups.find(
      g => getGroupKey(g.identifier) === dragGroupKey
    )
    if (!group) {
      this.resetDragState()
      return
    }

    // Build new order: current item IDs in display order (excluding ghost
    // submodule placeholders, which aren't reorderable repositories).
    const ids = group.items
      .filter(i => i.ghost === undefined)
      .map(i => i.repository.id)
    const fromIdx = ids.indexOf(dragSourceId)
    const toIdx = ids.indexOf(targetRepoId)

    if (fromIdx === -1 || toIdx === -1) {
      this.resetDragState()
      return
    }

    // Move source to target position
    ids.splice(fromIdx, 1)
    ids.splice(toIdx, 0, dragSourceId)

    // Persist
    const orderMap = getCustomOrderMap()
    orderMap[dragGroupKey] = ids
    setCustomOrderMap(orderMap)

    this.setState(prev => ({
      dragSourceId: null,
      dragGroupKey: null,
      dragTargetId: null,
      reorderVersion: prev.reorderVersion + 1,
    }))
  }

  private onRepoDragEnd = () => {
    this.resetDragState()
  }

  private resetDragState() {
    this.setState({
      dragSourceId: null,
      dragGroupKey: null,
      dragTargetId: null,
    })
  }

  private onCreateGroup = (repository: Repositoryish) => {
    this.props.dispatcher.showPopup({
      type: PopupType.CreateRepositoryGroup,
      repository:
        repository instanceof Repository ? repository : undefined,
    })
  }

  private onCreateWorktree = (repository: Repository) => {
    this.props.dispatcher.showPopup({
      type: PopupType.AddWorktree,
      repository,
    })
  }

  private onShowWorktrees = (repository: Repository) => {
    this.props.dispatcher.selectRepository(repository)
    this.props.dispatcher.showWorktreesFoldout()
  }
}
