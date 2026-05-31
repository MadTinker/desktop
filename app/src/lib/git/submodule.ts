import { join, resolve } from 'path'
import { readFile } from 'fs/promises'

import { git, IGitStringExecutionOptions } from './core'
import { Repository } from '../../models/repository'
import { SubmoduleEntry, SubmoduleEntryStatus } from '../../models/submodule'
import { pathExists } from '../path-exists'
import {
  executionOptionsWithProgress,
  IGitOutput,
  PushProgressParser,
  PullProgressParser,
} from '../progress'
import {
  envForRemoteOperation,
  getFallbackUrlForProxyResolve,
} from './environment'
import { AuthenticationErrors } from './authentication'
import { getRemotes } from './remote'
import { getSymbolicRef } from './refs'
import { IRemote } from '../../models/remote'
import { Progress, IPushProgress, IPullProgress } from '../../models/progress'
import { CommitOneLine } from '../../models/commit'

/**
 * Resolve the push refspec for a repository that may be in detached HEAD state.
 *
 * Returns undefined when on a normal branch (let git use the tracking config).
 * Returns 'HEAD:<branch>' when detached, derived from the upstream tracking ref.
 * Returns null when detached with no upstream — caller should skip the push.
 */
async function resolvePushRefspec(
  repo: Repository
): Promise<string | null | undefined> {
  const headRef = await getSymbolicRef(repo, 'HEAD')
  if (headRef !== null) {
    // On a branch — no explicit refspec needed
    return undefined
  }

  // Detached HEAD — try to find the upstream tracking branch
  const upstreamResult = await git(
    ['rev-parse', '--abbrev-ref', '@{upstream}'],
    repo.path,
    'getUpstreamRef',
    { successExitCodes: new Set([0, 128]) }
  )

  if (upstreamResult.exitCode !== 0) {
    return null
  }

  // upstream is e.g. "origin/main" — strip the remote prefix
  const upstream = upstreamResult.stdout.trim()
  const slashIdx = upstream.indexOf('/')
  if (slashIdx === -1) {
    return null
  }

  const remoteBranch = upstream.slice(slashIdx + 1)
  return `HEAD:refs/heads/${remoteBranch}`
}

/**
 * Update submodules after a git operation.
 *
 * @param repository - The repository in which to update submodules
 * @param remote - The remote for environment setup (can be null)
 * @param progressCallback - An optional function which will be invoked
 *                           with information about the current progress
 *                           of the submodule update operation.
 * @param progressKind - The kind of progress event ('checkout', 'pull', etc.)
 * @param title - The title to use for progress reporting
 * @param targetOrRemote - The target (for checkout) or remote name (for pull)
 * @param allowFileProtocol - Whether to allow file:// protocol for submodules
 */
export async function updateSubmodulesAfterOperation<T extends Progress>(
  repository: Repository,
  remote: IRemote | null,
  progressCallback: ((progress: T) => void) | undefined,
  progressKind: T['kind'],
  title: string,
  targetOrRemote: string,
  allowFileProtocol: boolean
): Promise<void> {
  const opts: IGitStringExecutionOptions = {
    env: await envForRemoteOperation(
      getFallbackUrlForProxyResolve(repository, remote)
    ),
    expectedErrors: AuthenticationErrors,
  }

  const args = [
    ...(allowFileProtocol ? ['-c', 'protocol.file.allow=always'] : []),
    'submodule',
    'update',
    '--init',
    '--recursive',
  ]

  if (!progressCallback) {
    await git(args, repository.path, 'updateSubmodules', opts)
    return
  }

  // Initial progress
  progressCallback({
    kind: progressKind,
    title,
    description: 'Updating submodules',
    value: 0,
    // Add the target or remote field based on the progress kind
    ...(progressKind === 'checkout'
      ? { target: targetOrRemote }
      : { remote: targetOrRemote }),
  } as T)

  let submoduleEventCount = 0

  const progressOpts = await executionOptionsWithProgress(
    { ...opts, trackLFSProgress: true },
    {
      parse(line: string): IGitOutput {
        if (
          line.match(/^Submodule path (.)+?: checked out /) ||
          line.startsWith('Cloning into ')
        ) {
          submoduleEventCount += 1
        }

        return {
          kind: 'context',
          text: `Updating submodules: ${line}`,
          // Math taken from https://math.stackexchange.com/a/2323106
          // We do this to fake a progress that slows down as we process more
          // events, as we don't know how many submodules there are upfront, or
          // what does git have to do with them (cloning, just checking them
          // out...)
          percent: 1 - Math.exp(-submoduleEventCount * 0.25),
        }
      },
    },
    progress => {
      const description =
        progress.kind === 'progress' ? progress.details.text : progress.text

      const value = progress.percent

      progressCallback({
        kind: progressKind,
        title,
        description,
        value,
        ...(progressKind === 'checkout'
          ? { target: targetOrRemote }
          : { remote: targetOrRemote }),
      } as T)
    }
  )

  await git(args, repository.path, 'updateSubmodules', progressOpts)

  // Final progress
  progressCallback({
    kind: progressKind,
    title,
    description: 'Submodules updated',
    value: 1,
    ...(progressKind === 'checkout'
      ? { target: targetOrRemote }
      : { remote: targetOrRemote }),
  } as T)
}

export async function listSubmodules(
  repository: Repository
): Promise<ReadonlyArray<SubmoduleEntry>> {
  const [submodulesFile, submodulesDir] = await Promise.all([
    pathExists(join(repository.path, '.gitmodules')),
    pathExists(join(repository.path, '.git', 'modules')),
  ])

  if (!submodulesFile && !submodulesDir) {
    // repo path + .gitmodules and + .git/modules covers the vast majority of
    // "normal" repositories but if we're in a linked worktree the modules
    // directory is actually in the git common dir so we'll also check for the
    // existence of the modules directory there as well before giving up on the
    // existence of submodules in this repo. We're reading the commondir file
    // ourselves here instead of calling out to git to avoid the cost of
    // spawning a process on Windows
    const commonDirPath = join(repository.resolvedGitDir, 'commondir')
    const commonDir = await readFile(commonDirPath, 'utf8')
      .then(content => content.replace(/\r?\n$/, ''))
      .then(p => (p ? resolve(repository.resolvedGitDir, p) : null))
      .catch(() => null)

    if (!commonDir || !(await pathExists(join(commonDir, 'modules')))) {
      log.info('No submodules found. Skipping "git submodule status"')
      return []
    }
  }

  // We don't recurse when listing submodules here because we don't have a good
  // story about managing these currently. So for now we're only listing
  // changes to the top-level submodules to be consistent with `git status`
  const { stdout, exitCode } = await git(
    ['submodule', 'status', '--'],
    repository.path,
    'listSubmodules',
    { successExitCodes: new Set([0, 128]) }
  )

  if (exitCode === 128) {
    // unable to parse submodules in repository, giving up
    return []
  }

  const submodules = new Array<SubmoduleEntry>()

  // entries are of the format:
  //  1eaabe34fc6f486367a176207420378f587d3b48 git (v2.16.0-rc0)
  //
  // first character:
  //   - " " if no change
  //   - "-" if the submodule is not initialized
  //   - "+" if the currently checked out submodule commit does not match the SHA-1 found in the index of the containing repository
  //   - "U" if the submodule has merge conflicts
  //
  // then the 40-character SHA represents the current commit
  //
  // then the path to the submodule
  //
  // then the output of `git describe` for the submodule in braces
  // we're not leveraging this in the app, so go and read the docs
  // about it if you want to learn more:
  //
  // https://git-scm.com/docs/git-describe
  // Description suffix is optional — uninitialized submodules don't output it
  const statusRe = /^(.)([^ ]+) (.+?)(?:\s+\((.+?)\))?$/gm

  for (const [, statusChar, sha, path, describe] of stdout.matchAll(statusRe)) {
    const status = charToSubmoduleStatus(statusChar)
    submodules.push(new SubmoduleEntry(sha, path, describe ?? '', status))
  }

  return submodules
}

/**
 * Check if a file path is registered as a submodule in .gitmodules.
 * Cheaper than `listSubmodules` — doesn't run `git submodule status`.
 */
export async function isSubmodulePath(
  repository: Repository,
  filePath: string
): Promise<boolean> {
  const gitmodulesPath = join(repository.path, '.gitmodules')
  if (!(await pathExists(gitmodulesPath))) {
    return false
  }

  const { stdout, exitCode } = await git(
    [
      'config',
      '--file',
      '.gitmodules',
      '--get-regexp',
      'submodule\\..*\\.path',
    ],
    repository.path,
    'isSubmodulePath',
    { successExitCodes: new Set([0, 1]) }
  )

  if (exitCode !== 0) {
    return false
  }

  const paths = stdout
    .split('\n')
    .filter(line => line.length > 0)
    .map(line => line.replace(/^submodule\..*\.path\s+/, ''))

  return paths.includes(filePath)
}

export async function resetSubmodulePaths(
  repository: Repository,
  paths: ReadonlyArray<string>
): Promise<void> {
  if (paths.length === 0) {
    return
  }

  await git(
    ['submodule', 'update', '--recursive', '--force', '--', ...paths],
    repository.path,
    'updateSubmodule'
  )
}

function charToSubmoduleStatus(char: string): SubmoduleEntryStatus {
  switch (char) {
    case '-':
      return 'uninitialized'
    case '+':
      return 'modified'
    case 'U':
      return 'conflict'
    default:
      return 'initialized'
  }
}

/** Initialize an uninitialized submodule at the given relative path. */
export async function initSubmodule(
  repository: Repository,
  submodulePath: string
): Promise<void> {
  await git(
    ['submodule', 'update', '--init', '--', submodulePath],
    repository.path,
    'initSubmodule'
  )
}

/** Sync and update a submodule at the given relative path. */
export async function syncSubmodule(
  repository: Repository,
  submodulePath: string
): Promise<void> {
  await git(
    ['submodule', 'sync', '--', submodulePath],
    repository.path,
    'syncSubmodule'
  )
  await git(
    ['submodule', 'update', '--recursive', '--', submodulePath],
    repository.path,
    'syncSubmoduleUpdate'
  )
}

/**
 * Push a single submodule to its configured upstream remote.
 *
 * Creates a lightweight Repository for the submodule path, resolves the
 * first available remote (preferring `origin`), then runs `git push` inside
 * the submodule working tree with optional progress reporting.  Submodules
 * with no configured remotes are silently skipped.
 */
export async function pushSubmodule(
  repository: Repository,
  submodulePath: string,
  progressCallback?: (progress: IPushProgress) => void
): Promise<void> {
  const submoduleRepo = new Repository(
    join(repository.path, submodulePath),
    -1,
    null,
    false
  )

  const remotes = await getRemotes(submoduleRepo)
  if (remotes.length === 0) {
    return
  }

  const remote = remotes.find(r => r.name === 'origin') ?? remotes[0]

  const refspec = await resolvePushRefspec(submoduleRepo)
  if (refspec === null) {
    // Detached HEAD with no upstream tracking branch — nothing to push
    log.warn(
      `[pushSubmodule] ${submodulePath} is in detached HEAD with no upstream; skipping push`
    )
    return
  }

  const args = ['push', remote.name]
  if (refspec !== undefined) {
    args.push(refspec)
  }

  let opts: IGitStringExecutionOptions = {
    env: await envForRemoteOperation(remote.url),
    expectedErrors: AuthenticationErrors,
  }

  if (progressCallback) {
    args.push('--progress')
    const title = `Pushing ${submodulePath}`
    const kind = 'push'

    opts = await executionOptionsWithProgress(
      { ...opts, trackLFSProgress: true },
      new PushProgressParser(),
      progress => {
        const description =
          progress.kind === 'progress' ? progress.details.text : progress.text
        progressCallback({
          kind,
          title,
          description,
          value: progress.percent,
          remote: remote.name,
          branch: submodulePath,
          submodule: submodulePath,
        })
      }
    )

    progressCallback({
      kind: 'push',
      title,
      value: 0,
      remote: remote.name,
      branch: submodulePath,
      submodule: submodulePath,
    })
  }

  await git(args, submoduleRepo.path, 'pushSubmodule', opts)
}

/**
 * Pull a single submodule from its configured upstream remote.
 *
 * Mirrors pushSubmodule: resolves `origin` (or the first available remote),
 * then runs `git pull --ff --progress` inside the submodule working tree.
 * Submodules with no configured remotes are silently skipped.
 */
export async function pullSubmodule(
  repository: Repository,
  submodulePath: string,
  progressCallback?: (progress: IPullProgress) => void
): Promise<void> {
  const submoduleRepo = new Repository(
    join(repository.path, submodulePath),
    -1,
    null,
    false
  )

  const remotes = await getRemotes(submoduleRepo)
  if (remotes.length === 0) {
    return
  }

  const remote = remotes.find(r => r.name === 'origin') ?? remotes[0]
  const args = ['pull', '--ff']

  let opts: IGitStringExecutionOptions = {
    env: await envForRemoteOperation(remote.url),
    expectedErrors: AuthenticationErrors,
  }

  if (progressCallback) {
    args.push('--progress')
    const title = `Pulling ${submodulePath}`
    const kind = 'pull'

    opts = await executionOptionsWithProgress(
      { ...opts, trackLFSProgress: true },
      new PullProgressParser(),
      progress => {
        if (progress.kind === 'context') {
          if (!progress.text.startsWith('remote: Counting objects')) {
            return
          }
        }

        const description =
          progress.kind === 'progress' ? progress.details.text : progress.text

        progressCallback({
          kind,
          title,
          description,
          value: progress.percent,
          remote: remote.name,
          submodule: submodulePath,
        })
      }
    )

    progressCallback({
      kind: 'pull',
      title,
      value: 0,
      remote: remote.name,
      submodule: submodulePath,
    })
  }

  await git(args, submoduleRepo.path, 'pullSubmodule', opts)
}

/**
 * Pull all initialized submodules to their latest upstream commits.
 *
 * Equivalent to running `git pull --ff` inside each initialized submodule.
 * Submodules that are uninitialized or have no remotes are skipped silently.
 *
 * @param repository - The parent repository containing the submodules
 * @param progressCallback - Optional per-submodule progress callback. Receives
 *   pull progress enriched with the current submodule index and total count so
 *   the caller can render aggregate progress.
 */
export async function pullAllSubmodules(
  repository: Repository,
  progressCallback?: (
    progress: IPullProgress & { index: number; total: number }
  ) => void
): Promise<void> {
  const allSubmodules = await listSubmodules(repository)
  const active = allSubmodules.filter(s => s.status !== 'uninitialized')
  const total = active.length

  for (let i = 0; i < total; i++) {
    const submodule = active[i]
    await pullSubmodule(
      repository,
      submodule.path,
      progressCallback
        ? progress => progressCallback({ ...progress, index: i, total })
        : undefined
    )
  }
}

/**
 * Initialize all uninitialized submodules.
 *
 * Filters to only submodules with status 'uninitialized' and calls
 * initSubmodule for each. Already-initialized submodules are skipped.
 */
export async function initAllSubmodules(
  repository: Repository,
  progressCallback?: (progress: {
    index: number
    total: number
    path: string
  }) => void
): Promise<void> {
  const allSubmodules = await listSubmodules(repository)
  const uninit = allSubmodules.filter(s => s.status === 'uninitialized')
  const total = uninit.length

  for (let i = 0; i < total; i++) {
    const submodule = uninit[i]
    progressCallback?.({ index: i, total, path: submodule.path })
    await initSubmodule(repository, submodule.path)
  }
}

/**
 * Push all initialized submodules to their configured upstream remotes.
 *
 * Mirrors pullAllSubmodules: iterates active submodules and calls
 * pushSubmodule for each. Submodules with no remotes are skipped silently.
 */
export async function pushAllSubmodules(
  repository: Repository,
  progressCallback?: (
    progress: IPushProgress & { index: number; total: number }
  ) => void
): Promise<void> {
  const allSubmodules = await listSubmodules(repository)
  const active = allSubmodules.filter(s => s.status !== 'uninitialized')
  const total = active.length

  for (let i = 0; i < total; i++) {
    const submodule = active[i]
    await pushSubmodule(
      repository,
      submodule.path,
      progressCallback
        ? progress => progressCallback({ ...progress, index: i, total })
        : undefined
    )
  }
}

/**
 * Run a shell command in every submodule via `git submodule foreach`.
 *
 * @param repository - The parent repository
 * @param command - Shell command to run in each submodule (e.g. "git status")
 * @param recursive - Pass --recursive to also traverse nested submodules
 * @returns Combined stdout from all submodules
 */
export async function foreachSubmodule(
  repository: Repository,
  command: string,
  recursive: boolean
): Promise<string> {
  const args = ['submodule', 'foreach']
  if (recursive) {
    args.push('--recursive')
  }
  args.push(command)

  const { stdout } = await git(
    args,
    repository.path,
    'foreachSubmodule',
    { successExitCodes: new Set([0, 1]) }
  )

  return stdout
}

/**
 * Return commits between two SHAs in a submodule directory.
 * Runs `git log --oneline oldSHA..newSHA` inside the submodule.
 */
export async function getSubmoduleCommitsBetween(
  submodulePath: string,
  oldSHA: string,
  newSHA: string
): Promise<ReadonlyArray<CommitOneLine>> {
  const { stdout } = await git(
    ['log', '--oneline', `${oldSHA}..${newSHA}`],
    submodulePath,
    'getSubmoduleCommitsBetween',
    { successExitCodes: new Set([0, 128]) }
  )

  return stdout
    .split('\n')
    .filter(line => line.length > 0)
    .map(line => {
      const spaceIndex = line.indexOf(' ')
      return {
        sha: line.substring(0, spaceIndex),
        summary: line.substring(spaceIndex + 1),
      }
    })
}
