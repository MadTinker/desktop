import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert'
import { Repository } from '../../src/models/repository'
import {
  getCollapsedFolders,
  setCollapsedFolders,
} from '../../src/ui/changes/collapsed-folders-store'

const repository = (path: string) => new Repository(path, 1, null, false)

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
})
