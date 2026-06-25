/**
 * Shared descriptor for an editable dotfile surfaced in the integrated
 * Dotfiles panel. Resolved in the main process (see
 * `main-process/dotfiles-store.ts`) and consumed by the renderer's
 * `DotfilesTabs` component. The renderer never handles raw filesystem paths
 * for reads/writes — it addresses files by `id`, so the main process is the
 * single point that maps an id to an on-disk path.
 */
export type DotfileId = 'zshrc' | 'gitconfig' | 'aliases' | 'repo-config'

export type DotfileMode = 'shell' | 'properties'

export interface IDotfileDescriptor {
  readonly id: DotfileId
  /** Tab label, e.g. `.zshrc`. */
  readonly label: string
  /** Resolved absolute path — for display/title only. */
  readonly path: string
  /** CodeMirror mode bucket. */
  readonly mode: DotfileMode
  /** Whether the file exists on disk; when false a write creates it. */
  readonly exists: boolean
}
