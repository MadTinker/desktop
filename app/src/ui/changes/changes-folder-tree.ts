import { WorkingDirectoryFileChange } from '../../models/status'

/** A foldable directory in the changes list. */
export interface IChangesFolder {
  /**
   * The full path of the folder relative to the repository root, e.g.
   * `docs/api`. Used as the identity for collapsed state.
   */
  readonly path: string

  /**
   * The text shown in the folder header. Folders whose only child is another
   * folder are compressed into a single row so this may span several path
   * components, e.g. `docs/api`.
   */
  readonly label: string

  /** How deeply nested the folder is, used for indentation. */
  readonly depth: number

  /** The files directly inside this folder (empty when collapsed). */
  readonly files: ReadonlyArray<WorkingDirectoryFileChange>

  /** Every changed file at or below this folder, regardless of collapsed state. */
  readonly allFiles: ReadonlyArray<WorkingDirectoryFileChange>

  readonly collapsed: boolean
}

/**
 * A contiguous run of rows in the changes list; a folder header followed by the
 * files directly inside it. A section with a null folder holds the files at the
 * repository root.
 */
export interface IChangesTreeSection {
  readonly folder: IChangesFolder | null
  readonly files: ReadonlyArray<WorkingDirectoryFileChange>
}

interface IMutableNode {
  readonly path: string
  readonly name: string
  readonly children: Map<string, IMutableNode>
  readonly files: Array<WorkingDirectoryFileChange>
}

function createNode(path: string, name: string): IMutableNode {
  return { path, name, children: new Map(), files: [] }
}

/**
 * Collapse folders that contain nothing but a single subfolder into that
 * subfolder, e.g. `docs` -> `docs/api` when `docs` holds no files of its own.
 */
function compress(node: IMutableNode): IMutableNode {
  const children = new Map(
    Array.from(node.children, ([name, child]) => [name, compress(child)])
  )

  if (node.files.length === 0 && children.size === 1) {
    const [child] = children.values()
    return {
      path: child.path,
      name: `${node.name}/${child.name}`,
      children: child.children,
      files: child.files,
    }
  }

  return { path: node.path, name: node.name, children, files: node.files }
}

function collectFiles(
  node: IMutableNode,
  files: Array<WorkingDirectoryFileChange>
) {
  files.push(...node.files)

  for (const child of node.children.values()) {
    collectFiles(child, files)
  }

  return files
}

function sortedChildren(node: IMutableNode) {
  return Array.from(node.children.values()).sort((x, y) =>
    x.name.toLowerCase().localeCompare(y.name.toLowerCase())
  )
}

function emit(
  node: IMutableNode,
  depth: number,
  collapsedFolders: ReadonlySet<string>,
  sections: Array<IChangesTreeSection>
) {
  const collapsed = collapsedFolders.has(node.path)

  const folder: IChangesFolder = {
    path: node.path,
    label: node.name,
    depth,
    files: collapsed ? [] : node.files,
    allFiles: collectFiles(node, []),
    collapsed,
  }

  sections.push({ folder, files: folder.files })

  if (collapsed) {
    return
  }

  for (const child of sortedChildren(node)) {
    emit(child, depth + 1, collapsedFolders, sections)
  }
}

/**
 * Arrange the working directory files into folder sections, honoring the set of
 * collapsed folder paths.
 *
 * Folders come before the files at the same level, mirroring how file trees are
 * conventionally laid out. The files within a folder keep the order they were
 * given in (git reports them sorted by path).
 */
export function buildChangesTree(
  files: ReadonlyArray<WorkingDirectoryFileChange>,
  collapsedFolders: ReadonlySet<string>
): ReadonlyArray<IChangesTreeSection> {
  const root = createNode('', '')

  for (const file of files) {
    // Paths from git are always posix separated, even on Windows.
    const components = file.path.split('/')
    const fileName = components.pop()

    if (fileName === undefined) {
      continue
    }

    let node = root

    for (const component of components) {
      const path = node.path === '' ? component : `${node.path}/${component}`
      let child = node.children.get(component)

      if (child === undefined) {
        child = createNode(path, component)
        node.children.set(component, child)
      }

      node = child
    }

    node.files.push(file)
  }

  // The root itself is never compressed, only the folders within it.
  const compressed: IMutableNode = {
    ...root,
    children: new Map(
      Array.from(root.children, ([name, child]) => [name, compress(child)])
    ),
  }

  const sections = new Array<IChangesTreeSection>()

  for (const child of sortedChildren(compressed)) {
    emit(child, 0, collapsedFolders, sections)
  }

  if (compressed.files.length > 0) {
    sections.push({ folder: null, files: compressed.files })
  }

  return sections
}

/** Every folder path in the working directory, collapsed chains included. */
export function getAllFolderPaths(
  files: ReadonlyArray<WorkingDirectoryFileChange>
): ReadonlyArray<string> {
  return buildChangesTree(files, new Set<string>())
    .map(s => s.folder?.path)
    .filter((p): p is string => p !== undefined && p !== null)
}
