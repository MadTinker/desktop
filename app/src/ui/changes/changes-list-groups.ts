import { basename } from 'path'

import {
  AppFileStatusKind,
  WorkingDirectoryFileChange,
} from '../../models/status'
import { IFilterListGroup, IFilterListItem } from '../lib/filter-list'
import { IMatches } from '../../lib/fuzzy-find'
import { buildChangesTree, IChangesFolder } from './changes-folder-tree'

export interface IChangesListItem extends IFilterListItem {
  readonly id: string
  readonly text: ReadonlyArray<string>
  readonly change: WorkingDirectoryFileChange
  /** How far to indent the row when the list is grouped into folders. */
  readonly depth: number
  /**
   * The portion of the path to display. Equal to the full path unless the file
   * sits underneath a folder header, in which case it's the file name.
   */
  readonly displayPath: string
  /**
   * The folder header the file sits under, or null when the file is at the
   * repository root or the list isn't grouped into folders.
   */
  readonly folderPath: string | null
}

/** The identifier of the group holding files that aren't under any folder */
export const RootGroupIdentifier = 'changed-files'

export const folderGroupIdentifier = (path: string) => `folder:${path}`

export interface IChangesListGroupState {
  readonly groups: ReadonlyArray<IFilterListGroup<IChangesListItem>>
  /** The folder shown by each group header, by group identifier */
  readonly folders: Map<string, IChangesFolder>
  /** The ids of the files hidden only because their folder is folded up */
  readonly collapsedFileIDs: ReadonlySet<string>
}

/**
 * The folders to treat as folded up while rendering. A fold hides the files
 * inside it, which would swallow the very rows a filter is meant to surface,
 * so filtering unfolds everything. The folds themselves are untouched and come
 * back the moment the filter is cleared.
 */
export function getEffectiveCollapsedFolders(
  collapsedFolders: ReadonlySet<string>,
  filtersActive: boolean
): ReadonlySet<string> {
  return filtersActive ? EmptyCollapsedFolders : collapsedFolders
}

const EmptyCollapsedFolders: ReadonlySet<string> = new Set<string>()

/**
 * Line a set of matched characters up with the path a row actually displays.
 *
 * Matches are found against the full path but a row underneath a folder header
 * only shows the file name, so the indices have to move with it. A match that
 * lands in the folder part can't be shown on a file name at all, so those rows
 * fall back to displaying the full path.
 */
export function fitMatchesToDisplayPath(
  path: string,
  displayPath: string,
  matches: IMatches | undefined
): { displayPath: string; matches: IMatches | undefined } {
  const prefixLength = path.length - displayPath.length

  if (prefixLength <= 0 || matches === undefined || !matches.title.length) {
    return { displayPath, matches }
  }

  if (matches.title.some(i => i < prefixLength)) {
    return { displayPath: path, matches }
  }

  return {
    displayPath,
    matches: {
      title: matches.title.map(i => i - prefixLength),
      subtitle: matches.subtitle,
    },
  }
}

export function createListItem(
  file: WorkingDirectoryFileChange,
  depth: number,
  displayPath: string,
  folderPath: string | null = null
): IChangesListItem {
  return {
    text: [file.path],
    id: file.id,
    change: file,
    depth,
    displayPath,
    folderPath,
  }
}

/**
 * Arrange the working directory files into the groups backing the list. When
 * the user is filtering by text we show a flat list of full paths so that the
 * matched characters line up with what they typed; otherwise the files are
 * grouped into foldable folders.
 */
export function createGroupState(
  files: ReadonlyArray<WorkingDirectoryFileChange>,
  collapsedFolders: ReadonlySet<string>,
  groupByFolder: boolean
): IChangesListGroupState {
  if (!groupByFolder) {
    return {
      groups: [
        {
          identifier: RootGroupIdentifier,
          showHeader: false,
          items: files.map(f => createListItem(f, 0, f.path)),
        },
      ],
      folders: new Map(),
      collapsedFileIDs: new Set(),
    }
  }

  const groups = new Array<IFilterListGroup<IChangesListItem>>()
  const folders = new Map<string, IChangesFolder>()
  const collapsedFileIDs = new Set<string>()

  for (const section of buildChangesTree(files, collapsedFolders)) {
    const { folder } = section

    if (folder === null) {
      groups.push({
        identifier: RootGroupIdentifier,
        showHeader: false,
        items: section.files.map(f => createListItem(f, 0, f.path)),
      })
      continue
    }

    const identifier = folderGroupIdentifier(folder.path)
    folders.set(identifier, folder)

    if (folder.collapsed) {
      folder.allFiles.forEach(f => collapsedFileIDs.add(f.id))
    }

    groups.push({
      identifier,
      showHeaderWhenEmpty: true,
      items: section.files.map(f =>
        // Renames and copies render the path they came from alongside the
        // current one, so shortening only the latter would read as a move
        // between folders that didn't happen.
        createListItem(
          f,
          folder.depth + 1,
          f.status.kind === AppFileStatusKind.Renamed ||
            f.status.kind === AppFileStatusKind.Copied
            ? f.path
            : basename(f.path),
          folder.path
        )
      ),
    })
  }

  return { groups, folders, collapsedFileIDs }
}

/** Where a folder header sits in the scrolled list. */
export interface IFolderHeaderPosition {
  readonly identifier: string
  readonly top: number
  readonly height: number
}

/**
 * Where each folder header sits in the scrolled list, so that the one whose
 * files are on screen can be pinned to the top of it. Every row is the same
 * height and a group is a header row followed by its files, which is all the
 * arithmetic this takes.
 */
export function getFolderHeaderLayout(
  groups: ReadonlyArray<IFilterListGroup<IChangesListItem>>,
  filteredItems: ReadonlyMap<string, IChangesListItem>,
  filtersActive: boolean,
  rowHeight: number
): ReadonlyArray<IFolderHeaderPosition> {
  const sections = new Array<IFolderHeaderPosition>()

  let top = 0

  for (const group of groups) {
    const hasHeader = group.showHeader !== false
    const visibleItems = filtersActive
      ? group.items.filter(i => filteredItems.has(i.id)).length
      : group.items.length

    // Mirrors the filter list, which drops a group with nothing in it unless
    // the group asked for its header to stay.
    if (visibleItems === 0 && !(hasHeader && group.showHeaderWhenEmpty)) {
      continue
    }

    const height = (hasHeader ? rowHeight : 0) + visibleItems * rowHeight

    if (hasHeader) {
      sections.push({ identifier: group.identifier, top, height })
    }

    top += height
  }

  return sections
}

/**
 * The folder header to pin to the top of the list at the given scroll offset,
 * along with how far to push it up as the next folder arrives underneath it.
 * Null when the top of the list is a header of its own, or files that aren't
 * in any folder.
 */
export function getPinnedFolderHeader(
  sections: ReadonlyArray<IFolderHeaderPosition>,
  scrollTop: number,
  rowHeight: number
): { identifier: string; offset: number } | null {
  if (scrollTop <= 0) {
    return null
  }

  const section = sections.find(
    s => s.top < scrollTop && s.top + s.height > scrollTop
  )

  if (section === undefined) {
    return null
  }

  return {
    identifier: section.identifier,
    offset: Math.min(0, section.top + section.height - scrollTop - rowHeight),
  }
}
