/**
 * Submodule operations the CLI can trigger. init/pull/push run repo-wide when
 * no submodulePath is given, or against a single submodule when one is. sync
 * and rollback always require a submodulePath.
 */
export type SubmoduleCLIOp = 'init' | 'pull' | 'push' | 'sync' | 'rollback'

export type GroupCLIOp = 'ls' | 'create' | 'rm'

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
      /** When set, target a single submodule instead of the whole repo. */
      readonly submodulePath?: string
    }
  | {
      readonly kind: 'foreach'
      readonly path: string
      readonly command: string
      readonly recursive: boolean
      /** File the combined stdout is written to for the CLI to print. */
      readonly resultPath?: string
    }
  | {
      readonly kind: 'group-op'
      readonly op: GroupCLIOp
      /** Group name (required for create/rm; ignored for ls). */
      readonly name?: string
      /** File the listing is written to for the CLI to print (ls only). */
      readonly resultPath?: string
    }
  | {
      readonly kind: 'favorite'
      readonly path: string
    }
