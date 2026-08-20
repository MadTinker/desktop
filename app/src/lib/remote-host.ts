import { parseRemote } from './remote-parsing'

/**
 * The hosting service a remote points at, as far as we can tell from its URL.
 *
 * Used only to label remotes in the UI, so an unrecognised host is a perfectly
 * good answer rather than a problem — self-hosted Gitea, an internal GitLab and
 * a bare path on a NAS are all normal.
 */
export type RemoteHost =
  | 'github'
  | 'gitlab'
  | 'bitbucket'
  | 'gitea'
  | 'azure'
  | 'local'
  | 'other'

const knownHosts: ReadonlyArray<{
  readonly host: RemoteHost
  readonly matches: (hostname: string) => boolean
}> = [
  {
    host: 'github',
    matches: h => h === 'github.com' || h.endsWith('.github.com'),
  },
  {
    host: 'gitlab',
    matches: h => h === 'gitlab.com' || h.startsWith('gitlab.'),
  },
  {
    host: 'bitbucket',
    matches: h => h === 'bitbucket.org' || h.startsWith('bitbucket.'),
  },
  {
    host: 'gitea',
    matches: h => h.startsWith('gitea.') || h.startsWith('codeberg.'),
  },
  {
    host: 'azure',
    matches: h => h === 'dev.azure.com' || h.endsWith('.visualstudio.com'),
  },
]

/** Work out which service a remote URL points at. */
export function getRemoteHost(url: string): RemoteHost {
  const trimmed = url.trim()

  if (trimmed.length === 0) {
    return 'other'
  }

  // A remote can be a plain filesystem path — a bare repo on a drive or a
  // sibling clone — which has no hostname to classify.
  if (
    trimmed.startsWith('/') ||
    trimmed.startsWith('.') ||
    trimmed.startsWith('file://') ||
    /^[a-zA-Z]:[\\/]/.test(trimmed)
  ) {
    return 'local'
  }

  const parsed = parseRemote(trimmed)

  if (parsed === null) {
    return 'other'
  }

  // parseRemote's `hostname` can carry path segments for URLs whose project
  // path sits above the repository — Azure DevOps comes back as
  // `dev.azure.com/org/project`. Only the host itself identifies the service.
  const hostname = parsed.hostname.toLowerCase().split('/')[0]

  return knownHosts.find(k => k.matches(hostname))?.host ?? 'other'
}

/** A display label for a remote host. */
export function getRemoteHostLabel(host: RemoteHost): string {
  switch (host) {
    case 'github':
      return 'GitHub'
    case 'gitlab':
      return 'GitLab'
    case 'bitbucket':
      return 'Bitbucket'
    case 'gitea':
      return 'Gitea'
    case 'azure':
      return 'Azure DevOps'
    case 'local':
      return 'Local'
    case 'other':
      return 'Git'
  }
}
