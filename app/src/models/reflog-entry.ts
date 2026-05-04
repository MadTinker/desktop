export interface IReflogEntry {
  readonly sha: string
  readonly shortSha: string
  /** Reflog selector, e.g. "HEAD@{0}" */
  readonly selector: string
  /** Reflog subject, e.g. "checkout: moving from main to feature" */
  readonly description: string
  readonly date: Date
  /** Author name from git log */
  readonly author: string
  /** Action type derived from description: commit | checkout | merge | reset | rebase | cherry-pick | pull | other */
  readonly action: string
}
