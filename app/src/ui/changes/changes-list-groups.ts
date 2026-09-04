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
