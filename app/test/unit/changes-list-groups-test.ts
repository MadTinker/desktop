import { describe, it } from 'node:test'
import assert from 'node:assert'
import {
  AppFileStatus,
  AppFileStatusKind,
  WorkingDirectoryFileChange,
} from '../../src/models/status'
import { DiffSelection, DiffSelectionType } from '../../src/models/diff'
import {
  createGroupState,
  folderGroupIdentifier,
  RootGroupIdentifier,
  shouldGroupByFolder,
} from '../../src/ui/changes/changes-list-groups'

function file(
  path: string,
  status: AppFileStatus = { kind: AppFileStatusKind.Modified }
) {
  return new WorkingDirectoryFileChange(
    path,
    status,
    DiffSelection.fromInitialSelection(DiffSelectionType.All)
  )
}

describe('changes list groups', () => {
  it('puts every file in one headerless group when not grouping by folder', () => {
    const files = [file('src/index.ts'), file('README.md')]
    const { groups, folders, collapsedFileIDs } = createGroupState(
      files,
      new Set(['src']),
      false
    )

    assert.strictEqual(groups.length, 1)
    assert.strictEqual(groups[0].identifier, RootGroupIdentifier)
    assert.strictEqual(groups[0].showHeader, false)
    assert.deepStrictEqual(
      groups[0].items.map(i => i.displayPath),
      ['src/index.ts', 'README.md']
    )
    assert.deepStrictEqual(
      groups[0].items.map(i => i.depth),
      [0, 0]
    )
    assert.strictEqual(folders.size, 0)
    assert.strictEqual(collapsedFileIDs.size, 0)
  })

  it('gives each folder its own group and indents the files inside it', () => {
    const { groups, folders } = createGroupState(
      [file('src/index.ts'), file('src/lib/util.ts'), file('README.md')],
      new Set(),
      true
    )

    assert.deepStrictEqual(
      groups.map(g => g.identifier),
      [
        folderGroupIdentifier('src'),
        folderGroupIdentifier('src/lib'),
        RootGroupIdentifier,
      ]
    )

    assert.deepStrictEqual(
      groups[0].items.map(i => [i.displayPath, i.depth]),
      [['index.ts', 1]]
    )
    assert.deepStrictEqual(
      groups[1].items.map(i => [i.displayPath, i.depth]),
      [['util.ts', 2]]
    )
    assert.deepStrictEqual(
      groups[2].items.map(i => [i.displayPath, i.depth]),
      [['README.md', 0]]
    )

    assert.strictEqual(folders.get(folderGroupIdentifier('src'))?.label, 'src')
    assert.strictEqual(
      folders.get(folderGroupIdentifier('src/lib'))?.label,
      'lib'
    )
  })

  it('keeps the header of a collapsed folder and reports the files it hides', () => {
    const hidden = file('src/lib/util.ts')
    const { groups, collapsedFileIDs } = createGroupState(
      [file('src/index.ts'), hidden],
      new Set(['src/lib']),
      true
    )

    const collapsedGroup = groups.find(
      g => g.identifier === folderGroupIdentifier('src/lib')
    )

    assert.notStrictEqual(collapsedGroup, undefined)
    assert.deepStrictEqual(collapsedGroup?.items, [])
    // Without this the section filter list drops the group and the folder
    // vanishes rather than folding up.
    assert.strictEqual(collapsedGroup?.showHeaderWhenEmpty, true)
    assert.deepStrictEqual(Array.from(collapsedFileIDs), [hidden.id])
  })

  it('hides the files of every folder below a collapsed one', () => {
    const { groups, collapsedFileIDs } = createGroupState(
      [file('src/index.ts'), file('src/lib/util.ts')],
      new Set(['src']),
      true
    )

    assert.deepStrictEqual(
      groups.map(g => g.identifier),
      [folderGroupIdentifier('src')]
    )
    assert.strictEqual(collapsedFileIDs.size, 2)
  })

  it('shows the full path of a renamed file so the rename arrow still reads', () => {
    const renamed = file('src/new-name.ts', {
      kind: AppFileStatusKind.Renamed,
      oldPath: 'src/old-name.ts',
      renameIncludesModifications: false,
    })

    const { groups } = createGroupState([renamed], new Set(), true)

    assert.deepStrictEqual(
      groups[0].items.map(i => i.displayPath),
      ['src/new-name.ts']
    )
  })

  it('filters on the full path regardless of what is displayed', () => {
    const { groups } = createGroupState([file('src/index.ts')], new Set(), true)

    assert.deepStrictEqual(groups[0].items[0].text, ['src/index.ts'])
  })
})

describe('shouldGroupByFolder', () => {
  it('groups when the preference is on and nothing is being filtered', () => {
    assert.strictEqual(shouldGroupByFolder(true, true, ''), true)
    assert.strictEqual(shouldGroupByFolder(true, false, ''), true)
  })

  it('falls back to the flat list while filtering by text', () => {
    assert.strictEqual(shouldGroupByFolder(true, true, 'util'), false)
  })

  it('never groups when the preference is off', () => {
    assert.strictEqual(shouldGroupByFolder(false, true, ''), false)
    assert.strictEqual(shouldGroupByFolder(false, false, ''), false)
    assert.strictEqual(shouldGroupByFolder(false, true, 'util'), false)
  })

  it('ignores stale filter text when the filter is hidden', () => {
    assert.strictEqual(shouldGroupByFolder(true, false, 'util'), true)
  })
})
