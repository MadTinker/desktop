import { describe, it } from 'node:test'
import assert from 'node:assert'
import {
  AppFileStatusKind,
  WorkingDirectoryFileChange,
} from '../../src/models/status'
import { DiffSelection, DiffSelectionType } from '../../src/models/diff'
import {
  buildChangesTree,
  getAllFolderPaths,
  getFolderTreePaths,
} from '../../src/ui/changes/changes-folder-tree'

function file(path: string) {
  return new WorkingDirectoryFileChange(
    path,
    { kind: AppFileStatusKind.Modified },
    DiffSelection.fromInitialSelection(DiffSelectionType.All)
  )
}

function summarize(
  sections: ReturnType<typeof buildChangesTree>
): ReadonlyArray<string> {
  return sections.map(s =>
    s.folder === null
      ? `<root>: ${s.files.map(f => f.path).join(', ')}`
      : `${'  '.repeat(s.folder.depth)}${s.folder.label} (${
          s.folder.allFiles.length
        })${s.folder.collapsed ? ' [collapsed]' : ''}: ${s.files
          .map(f => f.path)
          .join(', ')}`
  )
}

describe('changes-folder-tree', () => {
  it('keeps root level files in a folderless section', () => {
    const sections = buildChangesTree(
      [file('.gitmodules'), file('README.md')],
      new Set()
    )

    assert.deepStrictEqual(summarize(sections), [
      '<root>: .gitmodules, README.md',
    ])
  })

  it('groups files by folder, folders before root files', () => {
    const sections = buildChangesTree(
      [file('.gitmodules'), file('src/index.ts'), file('src/lib/util.ts')],
      new Set()
    )

    assert.deepStrictEqual(summarize(sections), [
      'src (2): src/index.ts',
      '  lib (1): src/lib/util.ts',
      '<root>: .gitmodules',
    ])
  })

  it('compresses folders that hold nothing but a single subfolder', () => {
    const sections = buildChangesTree(
      [file('docs/api/v2/spec.md'), file('docs/api/v2/readme.md')],
      new Set()
    )

    assert.deepStrictEqual(summarize(sections), [
      'docs/api/v2 (2): docs/api/v2/spec.md, docs/api/v2/readme.md',
    ])
  })

  it('does not compress a folder that holds files of its own', () => {
    const sections = buildChangesTree(
      [file('docs/index.md'), file('docs/api/spec.md')],
      new Set()
    )

    assert.deepStrictEqual(summarize(sections), [
      'docs (2): docs/index.md',
      '  api (1): docs/api/spec.md',
    ])
  })

  it('hides the files and subfolders of a collapsed folder', () => {
    const sections = buildChangesTree(
      [file('docs/index.md'), file('docs/api/spec.md'), file('README.md')],
      new Set(['docs'])
    )

    assert.deepStrictEqual(summarize(sections), [
      'docs (2) [collapsed]: ',
      '<root>: README.md',
    ])
  })

  it('collapses on the compressed path', () => {
    const files = [file('docs/api/v2/spec.md')]
    const paths = getAllFolderPaths(files)

    assert.deepStrictEqual(paths, ['docs/api/v2'])
    assert.deepStrictEqual(summarize(buildChangesTree(files, new Set(paths))), [
      'docs/api/v2 (1) [collapsed]: ',
    ])
  })

  it('reports every folder path, nested ones included', () => {
    assert.deepStrictEqual(
      getAllFolderPaths([
        file('src/index.ts'),
        file('src/lib/util.ts'),
        file('docs/readme.md'),
      ]),
      ['docs', 'src', 'src/lib']
    )
  })

  it('sorts folders case insensitively', () => {
    const sections = buildChangesTree(
      [file('Zebra/a.txt'), file('apple/b.txt')],
      new Set()
    )

    assert.deepStrictEqual(summarize(sections), [
      'apple (1): apple/b.txt',
      'Zebra (1): Zebra/a.txt',
    ])
  })
})

describe('getFolderTreePaths', () => {
  it('returns the folder and every folder beneath it', () => {
    const files = [
      file('src/index.ts'),
      file('src/lib/util.ts'),
      file('src/lib/deep/thing.ts'),
      file('srcs/other.ts'),
      file('docs/readme.md'),
    ]

    assert.deepStrictEqual(getFolderTreePaths(files, 'src'), [
      'src',
      'src/lib',
      'src/lib/deep',
    ])
  })

  it('does not mistake a sibling with a shared prefix for a child', () => {
    const files = [file('src/index.ts'), file('srcs/other.ts')]

    assert.deepStrictEqual(getFolderTreePaths(files, 'src'), ['src'])
  })
})
