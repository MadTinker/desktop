export type HookToggleState = Record<string, boolean>

const storageKey = (repoPath: string) =>
  `madness-desktop-hooks-${repoPath}`

/** Returns true (enabled) by default when no stored state exists. */
export function getRepoHookEnabled(
  repoPath: string,
  hookName: string
): boolean {
  try {
    const raw = localStorage.getItem(storageKey(repoPath))
    if (!raw) {
      return true
    }
    const state: HookToggleState = JSON.parse(raw)
    return state[hookName] !== false
  } catch {
    return true
  }
}

export function setRepoHookEnabled(
  repoPath: string,
  hookName: string,
  enabled: boolean
): void {
  try {
    const raw = localStorage.getItem(storageKey(repoPath))
    const state: HookToggleState = raw ? JSON.parse(raw) : {}
    state[hookName] = enabled
    localStorage.setItem(storageKey(repoPath), JSON.stringify(state))
  } catch {
    // localStorage unavailable in some test environments
  }
}
