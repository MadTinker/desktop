/** Repo-wide submodule operations the CLI can trigger. */
export type SubmoduleCLIOp = 'init' | 'pull' | 'push'

export type CLIAction =
  | {
      readonly kind: 'open-repository'
      readonly path: string
    }
  | {
      readonly kind: 'clone-url'
      readonly url: string
      readonly branch?: string
      /** Custom group name to drop the cloned repo into (created if missing). */
      readonly group?: string
    }
  | {
      readonly kind: 'add-to-group'
      readonly path: string
      /** Custom group name; created on the fly if it doesn't exist yet. */
      readonly group: string
    }
  | {
      readonly kind: 'submodule-op'
      readonly path: string
      readonly op: SubmoduleCLIOp
    }
