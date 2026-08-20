/**
 * Which remotes a branch is permitted to be pushed to.
 *
 * Persisted per-branch in the repository's own `.git/config` as
 * `branch.<name>.madnessRemotes`, so the policy travels with the repository,
 * is legible to anyone running `git config --list`, and can be enforced by the
 * `remote-guard` pre-push hook when a push happens outside Madness Desktop.
 */
export type RemoteAllowList =
  /** No policy has been recorded — the user is asked on the first push. */
  | { readonly kind: 'unset' }
  /** Local-only. This branch is never pushed anywhere. */
  | { readonly kind: 'none' }
  /** No restriction. */
  | { readonly kind: 'all' }
  /** Pushable only to the named remotes. */
  | { readonly kind: 'only'; readonly remotes: ReadonlyArray<string> }

/**
 * Prefix the `remote-guard` pre-push hook prints when it refuses a push.
 *
 * The app watches for this in a failed hook's output so it can present a
 * policy explanation and hard-abort, rather than the generic "a hook failed,
 * abort or ignore?" prompt — a block the user can click past isn't a block.
 * It's deliberately distinctive so another project's pre-push hook saying the
 * word "blocked" can't be mistaken for ours.
 */
export const RemoteGuardBlockMarker = 'MADNESS-REMOTE-BLOCKED:'

/** The config variable each branch's policy is stored under. */
export const RemotePolicyConfigKey = 'madnessRemotes'

/**
 * Values that mean something other than "a remote called this".
 *
 * A git remote may legally be named `all` or `none`, but such a remote cannot
 * be named in a policy — the stored value would be indistinguishable from the
 * reserved word. Callers that build an allow list from user input should
 * reject these names rather than silently storing an ambiguous value; see
 * `isReservedRemoteName`.
 */
const ReservedValues = ['all', 'none']

/** Is this remote name unusable in a policy because it collides with a keyword? */
export function isReservedRemoteName(remoteName: string): boolean {
  return ReservedValues.includes(remoteName.toLowerCase())
}

/** The config key holding the policy for a given branch. */
export function remotePolicyConfigKeyFor(branchName: string): string {
  return `branch.${branchName}.${RemotePolicyConfigKey}`
}

/**
 * Parse a raw `branch.<name>.madnessRemotes` config value.
 *
 * A missing or empty value is `unset` rather than `none` — "we never asked" and
 * "never push this" must not be conflated, and the pre-push guard treats an
 * empty value the same way.
 */
export function parseRemoteAllowList(value: string | null): RemoteAllowList {
  if (value === null) {
    return { kind: 'unset' }
  }

  const trimmed = value.trim()

  if (trimmed.length === 0) {
    return { kind: 'unset' }
  }

  const lowered = trimmed.toLowerCase()

  if (lowered === 'none') {
    return { kind: 'none' }
  }

  if (lowered === 'all') {
    return { kind: 'all' }
  }

  const remotes = dedupe(trimmed.split(/\s+/).filter(x => x.length > 0))

  // Defensive: the split can only be empty if the value was pure whitespace,
  // which the trim above already handled, but an empty `only` list would be a
  // silent "allow nothing" and is better expressed as `none`.
  return remotes.length === 0 ? { kind: 'none' } : { kind: 'only', remotes }
}

/**
 * Render an allow list as a config value.
 *
 * Returns null when the policy should be removed from the config entirely
 * (i.e. `unset`) rather than written as an empty string.
 */
export function serializeRemoteAllowList(
  allowed: RemoteAllowList
): string | null {
  switch (allowed.kind) {
    case 'unset':
      return null
    case 'none':
      return 'none'
    case 'all':
      return 'all'
    case 'only': {
      const remotes = dedupe(allowed.remotes.filter(x => x.trim().length > 0))
      return remotes.length === 0 ? 'none' : remotes.join(' ')
    }
  }
}

/**
 * May this branch be pushed to this remote?
 *
 * `unset` is not a decision, so it answers false — the caller is expected to
 * ask the user before pushing rather than treating silence as consent.
 */
export function isRemoteAllowed(
  allowed: RemoteAllowList,
  remoteName: string
): boolean {
  switch (allowed.kind) {
    case 'unset':
    case 'none':
      return false
    case 'all':
      return true
    case 'only':
      return allowed.remotes.includes(remoteName)
  }
}

/** A human-readable summary of a policy, for tooltips and block messages. */
export function describeRemoteAllowList(allowed: RemoteAllowList): string {
  switch (allowed.kind) {
    case 'unset':
      return 'No push policy set'
    case 'none':
      return 'Local only — never pushed'
    case 'all':
      return 'Any remote'
    case 'only':
      return `Only ${allowed.remotes.join(', ')}`
  }
}

function dedupe(values: ReadonlyArray<string>): ReadonlyArray<string> {
  return [...new Set(values)]
}
