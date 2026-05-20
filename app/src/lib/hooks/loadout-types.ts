/** Hook types supported by the loadout system. */
export type GitHookType =
  | 'pre-commit'
  | 'prepare-commit-msg'
  | 'post-commit'
  | 'post-checkout'
  | 'pre-push'

/** A single injectable hook script that can be part of a loadout. */
export interface HookScript {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly hookType: GitHookType
  readonly script: string
}

/** A named collection of hook scripts that can be installed together. */
export interface HookLoadout {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly scriptIds: ReadonlyArray<string>
  readonly builtin: boolean
}

/** Tracks which loadout is installed in a repository and per-script overrides. */
export interface LoadoutInstallation {
  readonly repoPath: string
  readonly loadoutId: string
  readonly installedAt: string
  readonly disabledScripts: ReadonlyArray<string>
}
