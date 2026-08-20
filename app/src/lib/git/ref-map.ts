import { git } from './core'
import { GitError } from 'dugite'
import { Repository } from '../../models/repository'
import { createForEachRefParser } from './git-delimiter-parser'

/**
 * Read every local branch and remote-tracking ref, mapped to its object id.
 *
 * One `for-each-ref` gives the whole picture, which is what lets a branch ×
 * remote comparison resolve most of its cells — everything already in sync —
 * without running a single `rev-list`.
 */
export async function getRefMap(
  repository: Repository,
  ...prefixes: ReadonlyArray<string>
): Promise<Map<string, string>> {
  const { formatArgs, parse } = createForEachRefParser({
    fullName: '%(refname)',
    sha: '%(objectname)',
  })

  const refPrefixes =
    prefixes.length > 0 ? [...prefixes] : ['refs/heads', 'refs/remotes']

  const result = await git(
    ['for-each-ref', ...formatArgs, ...refPrefixes],
    repository.path,
    'getRefMap',
    { expectedErrors: new Set([GitError.NotAGitRepository]) }
  )

  const refs = new Map<string, string>()

  if (result.gitError === GitError.NotAGitRepository) {
    return refs
  }

  for (const { fullName, sha } of parse(result.stdout)) {
    if (fullName.length > 0 && sha.length > 0) {
      refs.set(fullName, sha)
    }
  }

  return refs
}
