import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert'
import { Repository } from '../../src/models/repository'
import {
  autoCollapseFileThreshold,
  clearCollapsedFolders,
  getCollapsedFolders,
  getInitialCollapsedFolders,
  setCollapsedFolders,
} from '../../src/ui/changes/collapsed-folders-store'
import {
  AppFileStatusKind,
  WorkingDirectoryFileChange,
} from '../../src/models/status'
import { DiffSelection, DiffSelectionType } from '../../src/models/diff'

const repository = (path: string) => new Repository(path, 1, null, false)

const file = (path: string) =>
  new WorkingDirectoryFileChange(
    path,
    { kind: AppFileStatusKind.Modified },
    DiffSelection.fromInitialSelection(DiffSelectionType.All)
  )

const files = (count: number, folders = 4) =>
  Array.from({ length: count }, (_, i) =>
    file(`folder-${i % folders}/nested/file-${i}.ts`)
  )

describe('collapsed folders store', () => {
  beforeEach(() => localStorage.clear())

  it('has nothing collapsed for a repository it has not seen', () => {
    assert.strictEqual(getCollapsedFolders(repository('/tmp/repo')).size, 0)
  })

  it('round-trips the collapsed folders of a repository', () => {
    const repo = repository('/tmp/repo')
    setCollapsedFolders(repo, new Set(['docs', 'src/lib']))

    assert.deepStrictEqual(Array.from(getCollapsedFolders(repo)).sort(), [
      'docs',
      'src/lib',
    ])
  })

  it('keeps repositories apart', () => {
    setCollapsedFolders(repository('/tmp/one'), new Set(['docs']))
    setCollapsedFolders(repository('/tmp/two'), new Set(['src']))

    assert.deepStrictEqual(
      Array.from(getCollapsedFolders(repository('/tmp/one'))),
      ['docs']
    )
    assert.deepStrictEqual(
      Array.from(getCollapsedFolders(repository('/tmp/two'))),
      ['src']
    )
  })

  it('forgets folders that are expanded again', () => {
    const repo = repository('/tmp/repo')
    setCollapsedFolders(repo, new Set(['docs']))
    setCollapsedFolders(repo, new Set())

    assert.strictEqual(getCollapsedFolders(repo).size, 0)
  })

  it('drops everything it knows about a repository', () => {
    const repo = repository('/tmp/repo')
    setCollapsedFolders(repo, new Set(['docs']))
    clearCollapsedFolders(repo)

    assert.strictEqual(getCollapsedFolders(repo).size, 0)
  })
})

describe('getInitialCollapsedFolders', () => {
  beforeEach(() => localStorage.clear())

  it('leaves a small working directory unfolded', () => {
    const repo = repository('/tmp/repo')
    const collapsed = getInitialCollapsedFolders(repo, files(10))

    assert.strictEqual(collapsed.size, 0)
  })

  it('folds every folder up when there are a lot of changes', () => {
    const repo = repository('/tmp/repo')
    const collapsed = getInitialCollapsedFolders(
      repo,
      files(autoCollapseFileThreshold + 1)
    )

    assert.deepStrictEqual(Array.from(collapsed).sort(), [
      'folder-0/nested',
      'folder-1/nested',
      'folder-2/nested',
      'folder-3/nested',
    ])
  })

  it('does not auto fold once the user has folded something themselves', () => {
    const repo = repository('/tmp/repo')
    setCollapsedFolders(repo, new Set(['folder-0/nested']))

    const collapsed = getInitialCollapsedFolders(
      repo,
      files(autoCollapseFileThreshold + 1)
    )

    assert.deepStrictEqual(Array.from(collapsed), ['folder-0/nested'])
  })

  it('does not auto fold a big diff the user has unfolded', () => {
    const repo = repository('/tmp/repo')
    setCollapsedFolders(repo, new Set())

    const collapsed = getInitialCollapsedFolders(
      repo,
      files(autoCollapseFileThreshold + 1)
    )

    assert.strictEqual(collapsed.size, 0)
  })
})
