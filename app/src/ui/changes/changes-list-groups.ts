import { basename } from 'path'

import {
  AppFileStatusKind,
  WorkingDirectoryFileChange,
} from '../../models/status'
import { IFilterListGroup, IFilterListItem } from '../lib/filter-list'
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

export function createListItem(
  file: WorkingDirectoryFileChange,
  depth: number,
  displayPath: string
): IChangesListItem {
  return { text: [file.path], id: file.id, change: file, depth, displayPath }
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
            : basename(f.path)
        )
      ),
    })
  }

  return { groups, folders, collapsedFileIDs }
}
