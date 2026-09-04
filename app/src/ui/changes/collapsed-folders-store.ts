import { Repository } from '../../models/repository'
import { getStringArray, setStringArray } from '../../lib/local-storage'
import { WorkingDirectoryFileChange } from '../../models/status'
import { getAllFolderPaths } from './changes-folder-tree'

/**
 * A working directory with more changed files than this starts folded up, so
 * that a huge rebase or a first look at a big repository opens as a list of
 * folders rather than a wall of paths.
 */
export const autoCollapseFileThreshold = 100

/**
 * Which folders the user has folded up in the changes list, kept per
 * repository so that it survives switching repositories and restarts.
 */
function keyFor(repository: Repository) {
  return `changes-collapsed-folders/${repository.path}`
}

export function getCollapsedFolders(
  repository: Repository
): ReadonlySet<string> {
  return new Set(getStringArray(keyFor(repository)))
}

export function setCollapsedFolders(
  repository: Repository,
  folders: ReadonlySet<string>
) {
  setStringArray(keyFor(repository), Array.from(folders))
}

/** Whether the user has folded (or unfolded) anything in this repository yet */
export function hasStoredCollapsedFolders(repository: Repository) {
  return localStorage.getItem(keyFor(repository)) !== null
}

/** Forget a repository's folds, for when the repository itself is forgotten. */
export function clearCollapsedFolders(repository: Repository) {
  localStorage.removeItem(keyFor(repository))
}

/**
 * The folders to start a repository off with: whatever the user last left
 * folded, or every folder when there are enough changes that a flat list would
 * be unreadable and the user hasn't expressed a preference yet.
 *
 * Nothing is written to storage here - an auto folded list stays auto folded
 * until the user folds something themselves, at which point their choice is
 * what's remembered.
 */
export function getInitialCollapsedFolders(
  repository: Repository,
  files: ReadonlyArray<WorkingDirectoryFileChange>
): ReadonlySet<string> {
  if (hasStoredCollapsedFolders(repository)) {
    return getCollapsedFolders(repository)
  }

  return files.length > autoCollapseFileThreshold
    ? new Set(getAllFolderPaths(files))
    : new Set()
}
