import { Repository } from '../../models/repository'
import { getStringArray, setStringArray } from '../../lib/local-storage'

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
