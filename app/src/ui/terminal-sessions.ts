export interface ITerminalSessionInputs {
  /** Whether the panel is currently open. */
  readonly visible: boolean
  /** Active repo whose session should exist, or null for a non-repo selection. */
  readonly activeRepoPath: string | null
  /** Every repository currently known to the app (used for eviction). */
  readonly knownRepoPaths: ReadonlyArray<string>
}

/**
 * Reduce the set of live terminal sessions (one per repoPath) for the bottom
 * panel, given the current inputs.
 *
 * The rules encode the panel's persistence contract:
 *  - a session is materialised for the active repo only while the panel is
 *    open, so browsing repos with the panel closed spawns nothing;
 *  - existing sessions are retained even when they are not the active repo (or
 *    the panel is hidden), so a repo's terminals survive swaps and close/reopen;
 *  - a session whose repository is no longer known is dropped, so removing a
 *    repo tears its panes down and leaves no orphaned ptys.
 *
 * Returns the *same array reference* when nothing changes, letting callers
 * cheaply detect a no-op. Pure — no React, no xterm — so it is unit-testable in
 * a plain Node environment.
 */
export function reduceTerminalSessions(
  prev: ReadonlyArray<string>,
  { visible, activeRepoPath, knownRepoPaths }: ITerminalSessionInputs
): ReadonlyArray<string> {
  const known = new Set(knownRepoPaths)

  // Drop sessions for repositories that have left the app.
  let sessions = prev.filter(p => known.has(p))

  // Materialise the active repo's session the first time it is shown while the
  // panel is open.
  if (
    visible &&
    activeRepoPath !== null &&
    known.has(activeRepoPath) &&
    !sessions.includes(activeRepoPath)
  ) {
    sessions = [...sessions, activeRepoPath]
  }

  // Identical contents -> hand back the original reference to signal "no change".
  if (
    sessions.length === prev.length &&
    sessions.every((p, i) => p === prev[i])
  ) {
    return prev
  }

  return sessions
}
