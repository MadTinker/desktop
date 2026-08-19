import { Repository } from '../../models/repository'
import {
  RemoteAllowList,
  RemotePolicyConfigKey,
  parseRemoteAllowList,
  remotePolicyConfigKeyFor,
  serializeRemoteAllowList,
} from '../../models/remote-policy'
import { getConfigValuesMatching, setConfigValue } from './config'
import { git } from './core'

/**
 * Matches every `branch.<name>.madnessRemotes` key.
 *
 * Git lower-cases section and variable names before matching (subsection names
 * — the branch — keep their case), hence the lower-case variable here.
 */
const PolicyKeyRegexp = `^branch\\..*\\.${RemotePolicyConfigKey.toLowerCase()}$`

const KeyPrefix = 'branch.'
const KeySuffix = `.${RemotePolicyConfigKey.toLowerCase()}`

/**
 * Extract the branch name from a canonical policy config key.
 *
 * Branch names may contain dots (`release/1.4`), so the name is everything
 * between the fixed prefix and the fixed suffix rather than a naive split.
 * Returns null for keys that don't have the expected shape.
 */
export function branchNameFromPolicyKey(key: string): string | null {
  if (!key.startsWith(KeyPrefix) || !key.endsWith(KeySuffix)) {
    return null
  }

  const name = key.slice(KeyPrefix.length, key.length - KeySuffix.length)

  return name.length === 0 ? null : name
}

/**
 * Read every branch's push policy from the repository config.
 *
 * One `git config --get-regexp` invocation regardless of how many branches the
 * repository has. Branches with no policy are absent from the map; callers
 * should treat a missing entry as `{ kind: 'unset' }`.
 */
export async function getRemotePolicies(
  repository: Repository
): Promise<Map<string, RemoteAllowList>> {
  const values = await getConfigValuesMatching(repository, PolicyKeyRegexp)
  const policies = new Map<string, RemoteAllowList>()

  for (const [key, value] of values) {
    const branchName = branchNameFromPolicyKey(key)

    if (branchName === null) {
      continue
    }

    const allowed = parseRemoteAllowList(value)

    // An empty or whitespace value parses to `unset`, which is the same as not
    // having the key at all. Don't put it in the map and imply otherwise.
    if (allowed.kind !== 'unset') {
      policies.set(branchName, allowed)
    }
  }

  return policies
}

/** Read a single branch's push policy. */
export async function getRemotePolicy(
  repository: Repository,
  branchName: string
): Promise<RemoteAllowList> {
  const policies = await getRemotePolicies(repository)
  return policies.get(branchName) ?? { kind: 'unset' }
}

/**
 * Write a branch's push policy, or clear it when the policy is `unset`.
 */
export async function setRemotePolicy(
  repository: Repository,
  branchName: string,
  allowed: RemoteAllowList
): Promise<void> {
  const key = remotePolicyConfigKeyFor(branchName)
  const value = serializeRemoteAllowList(allowed)

  if (value === null) {
    return clearRemotePolicy(repository, branchName)
  }

  await setConfigValue(repository, key, value)
}

/** Remove a branch's push policy entirely. */
export async function clearRemotePolicy(
  repository: Repository,
  branchName: string
): Promise<void> {
  // `git config --unset-all` exits with 5 when the key doesn't exist, which
  // `removeConfigValue` treats as an error. Clearing a policy that was never
  // set is a no-op as far as callers are concerned, so go direct and accept it.
  await git(
    ['config', '--unset-all', remotePolicyConfigKeyFor(branchName)],
    repository.path,
    'clearRemotePolicy',
    { successExitCodes: new Set([0, 5]) }
  )
}

/**
 * Move a branch's policy to a new name, following a rename.
 *
 * Policies are keyed by branch name, so without this a rename silently drops
 * the lock — which for a safety feature fails in the wrong direction.
 */
export async function renameRemotePolicy(
  repository: Repository,
  oldBranchName: string,
  newBranchName: string
): Promise<void> {
  if (oldBranchName === newBranchName) {
    return
  }

  const allowed = await getRemotePolicy(repository, oldBranchName)

  if (allowed.kind === 'unset') {
    return
  }

  await setRemotePolicy(repository, newBranchName, allowed)
  await clearRemotePolicy(repository, oldBranchName)
}
