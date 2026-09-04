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
  fitMatchesToDisplayPath,
  getEffectiveCollapsedFolders,
  getFolderHeaderLayout,
  getPinnedFolderHeader,
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

  it('tells each file which folder header it sits under', () => {
    const { groups } = createGroupState(
      [file('src/lib/util.ts'), file('README.md')],
      new Set(),
      true
    )

    const items = groups.flatMap(g => g.items)

    assert.deepStrictEqual(
      items.map(i => [i.displayPath, i.folderPath]),
      [
        ['util.ts', 'src/lib'],
        ['README.md', null],
      ]
    )
  })

  it('leaves the folder off every file when not grouping by folder', () => {
    const { groups } = createGroupState(
      [file('src/lib/util.ts')],
      new Set(),
      false
    )

    assert.strictEqual(groups[0].items[0].folderPath, null)
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

describe('getEffectiveCollapsedFolders', () => {
  const collapsed = new Set(['src', 'docs'])

  it('honors the folds when nothing is being filtered', () => {
    assert.strictEqual(
      getEffectiveCollapsedFolders(collapsed, false),
      collapsed
    )
  })

  it('unfolds everything while a filter is on so matches are not hidden', () => {
    assert.strictEqual(getEffectiveCollapsedFolders(collapsed, true).size, 0)
  })
})

describe('fitMatchesToDisplayPath', () => {
  const matches = (title: ReadonlyArray<number>) => ({ title, subtitle: [] })

  it('leaves a row showing its full path alone', () => {
    const result = fitMatchesToDisplayPath(
      'src/util.ts',
      'src/util.ts',
      matches([0, 1])
    )

    assert.strictEqual(result.displayPath, 'src/util.ts')
    assert.deepStrictEqual(result.matches?.title, [0, 1])
  })

  it('moves the matched characters onto the file name', () => {
    const result = fitMatchesToDisplayPath(
      'src/lib/util.ts',
      'util.ts',
      matches([8, 9])
    )

    assert.strictEqual(result.displayPath, 'util.ts')
    assert.deepStrictEqual(result.matches?.title, [0, 1])
  })

  it('falls back to the full path when the match is in the folder part', () => {
    const result = fitMatchesToDisplayPath(
      'src/lib/util.ts',
      'util.ts',
      matches([1, 9])
    )

    assert.strictEqual(result.displayPath, 'src/lib/util.ts')
    assert.deepStrictEqual(result.matches?.title, [1, 9])
  })

  it('shortens rows that have no matches at all', () => {
    const result = fitMatchesToDisplayPath('src/lib/util.ts', 'util.ts', {
      title: [],
      subtitle: [],
    })

    assert.strictEqual(result.displayPath, 'util.ts')
  })
})

describe('folder header pinning', () => {
  const rowHeight = 10

  // docs: header + 1 file, src: header + 2 files, then 1 file at the root
  const files = [
    file('docs/readme.md'),
    file('src/index.ts'),
    file('src/main.ts'),
    file('LICENSE'),
  ]

  const layout = (collapsed: ReadonlySet<string> = new Set()) => {
    const { groups } = createGroupState(files, collapsed, true)
    return getFolderHeaderLayout(groups, new Map(), false, rowHeight)
  }

  it('stacks the folder headers up in the order they are rendered', () => {
    assert.deepStrictEqual(layout(), [
      { identifier: folderGroupIdentifier('docs'), top: 0, height: 20 },
      { identifier: folderGroupIdentifier('src'), top: 20, height: 30 },
    ])
  })

  it('gives a folded up folder just its header', () => {
    assert.deepStrictEqual(layout(new Set(['src'])), [
      { identifier: folderGroupIdentifier('docs'), top: 0, height: 20 },
      { identifier: folderGroupIdentifier('src'), top: 20, height: 10 },
    ])
  })

  it('counts only the matching files while a filter is on', () => {
    const { groups } = createGroupState(files, new Set(), true)
    const matched = new Map(
      groups
        .flatMap(g => g.items)
        .filter(i => i.change.path !== 'src/main.ts')
        .map(i => [i.id, i])
    )

    assert.deepStrictEqual(
      getFolderHeaderLayout(groups, matched, true, rowHeight),
      [
        { identifier: folderGroupIdentifier('docs'), top: 0, height: 20 },
        { identifier: folderGroupIdentifier('src'), top: 20, height: 20 },
      ]
    )
  })

  it('pins nothing at the top of the list', () => {
    assert.strictEqual(getPinnedFolderHeader(layout(), 0, rowHeight), null)
  })

  it('pins the folder whose files are on screen', () => {
    assert.deepStrictEqual(getPinnedFolderHeader(layout(), 25, rowHeight), {
      identifier: folderGroupIdentifier('src'),
      offset: 0,
    })
  })

  it('pushes the pinned header off as the next folder arrives', () => {
    // 15px in, the docs section (0-20) has 5px left, so the header showing on
    // top of it is half way out of view.
    assert.deepStrictEqual(getPinnedFolderHeader(layout(), 15, rowHeight), {
      identifier: folderGroupIdentifier('docs'),
      offset: -5,
    })
  })

  it('pins nothing over the files that sit at the repository root', () => {
    assert.strictEqual(getPinnedFolderHeader(layout(), 55, rowHeight), null)
  })
})
