import { describe, it } from 'node:test'
import assert from 'node:assert'
import { writeFile } from 'fs/promises'
import { join } from 'path'
import { exec } from 'dugite'

import {
  buildSyncMatrix,
  cellStateFromAheadBehind,
  deriveCellState,
  describeCellState,
  pendingCells,
  remoteTrackingRef,
  withResolvedCell,
} from '../../src/lib/remote-sync-matrix'
import { getRefMap } from '../../src/lib/git'
import { IRemote } from '../../src/models/remote'
import { RemoteAllowList } from '../../src/models/remote-policy'
import { setupEmptyRepository } from '../helpers/repositories'

const unset: RemoteAllowList = { kind: 'unset' }

const remotes: ReadonlyArray<IRemote> = [
  { name: 'origin', url: 'https://github.com/x/y.git' },
  { name: 'bitbucket', url: 'https://bitbucket.org/x/y.git' },
]

/** Build a ref map the way `getRefMap` would return one. */
function refs(entries: Record<string, string>): Map<string, string> {
  return new Map(Object.entries(entries))
}

describe('lib/remote-sync-matrix', () => {
  describe('deriveCellState', () => {
    it('reports a branch missing from a remote as absent, not behind', () => {
      const state = deriveCellState(
        { name: 'feature', sha: 'aaa' },
        'bitbucket',
        refs({}),
        unset
      )

      assert.strictEqual(state.kind, 'absent')
    })

    it('resolves matching shas as synced without needing a comparison', () => {
      const state = deriveCellState(
        { name: 'main', sha: 'aaa' },
        'origin',
        refs({ [remoteTrackingRef('origin', 'main')]: 'aaa' }),
        unset
      )

      assert.strictEqual(state.kind, 'synced')
    })

    it('defers to a comparison when the shas differ', () => {
      const state = deriveCellState(
        { name: 'main', sha: 'aaa' },
        'origin',
        refs({ [remoteTrackingRef('origin', 'main')]: 'bbb' }),
        unset
      )

      assert.strictEqual(state.kind, 'loading')
      // Object ids, not refs — AheadBehindStore caches on what it's handed and
      // can't notice a ref moving underneath it.
      assert.deepStrictEqual(
        state.kind === 'loading' ? [state.from, state.to] : null,
        ['aaa', 'bbb']
      )
    })

    it('reports a forbidden remote as locked even when the branch is there', () => {
      const state = deriveCellState(
        { name: 'scratch', sha: 'aaa' },
        'origin',
        refs({ [remoteTrackingRef('origin', 'scratch')]: 'aaa' }),
        { kind: 'none' }
      )

      assert.strictEqual(state.kind, 'locked')
    })

    it('does not treat an unset policy as a lock', () => {
      const state = deriveCellState(
        { name: 'main', sha: 'aaa' },
        'origin',
        refs({}),
        unset
      )

      // Absent, because there's no tracking ref — but crucially not locked.
      assert.strictEqual(state.kind, 'absent')
    })

    it('permits a remote named in an only policy', () => {
      const state = deriveCellState(
        { name: 'feature', sha: 'aaa' },
        'origin',
        refs({ [remoteTrackingRef('origin', 'feature')]: 'aaa' }),
        { kind: 'only', remotes: ['origin'] }
      )

      assert.strictEqual(state.kind, 'synced')
    })
  })

  describe('cellStateFromAheadBehind', () => {
    it('maps a null count to absent', () => {
      assert.strictEqual(cellStateFromAheadBehind(null).kind, 'absent')
    })

    it('maps zeroes to synced', () => {
      assert.strictEqual(
        cellStateFromAheadBehind({ ahead: 0, behind: 0 }).kind,
        'synced'
      )
    })

    it('distinguishes ahead, behind and diverged', () => {
      assert.strictEqual(
        cellStateFromAheadBehind({ ahead: 2, behind: 0 }).kind,
        'ahead'
      )
      assert.strictEqual(
        cellStateFromAheadBehind({ ahead: 0, behind: 3 }).kind,
        'behind'
      )
      assert.strictEqual(
        cellStateFromAheadBehind({ ahead: 2, behind: 3 }).kind,
        'diverged'
      )
    })
  })

  describe('buildSyncMatrix', () => {
    it('produces a cell per branch and remote', () => {
      const matrix = buildSyncMatrix(
        [
          { name: 'main', sha: 'aaa' },
          { name: 'feature', sha: 'bbb' },
        ],
        remotes,
        refs({}),
        new Map()
      )

      assert.strictEqual(matrix.rows.length, 2)
      assert.deepStrictEqual(
        matrix.rows.map(r => r.cells.map(c => c.remoteName)),
        [
          ['origin', 'bitbucket'],
          ['origin', 'bitbucket'],
        ]
      )
    })

    it('applies each branch its own policy', () => {
      const matrix = buildSyncMatrix(
        [
          { name: 'main', sha: 'aaa' },
          { name: 'scratch', sha: 'bbb' },
        ],
        remotes,
        refs({ [remoteTrackingRef('origin', 'main')]: 'aaa' }),
        new Map<string, RemoteAllowList>([['scratch', { kind: 'none' }]])
      )

      const [mainRow, scratchRow] = matrix.rows

      assert.strictEqual(mainRow.cells[0].state.kind, 'synced')
      assert.ok(scratchRow.cells.every(c => c.state.kind === 'locked'))
    })

    it('lists only the cells that still need comparing', () => {
      const matrix = buildSyncMatrix(
        [{ name: 'main', sha: 'aaa' }],
        remotes,
        refs({
          [remoteTrackingRef('origin', 'main')]: 'bbb',
          // no bitbucket ref, so that cell is absent rather than pending
        }),
        new Map()
      )

      const pending = pendingCells(matrix)

      assert.strictEqual(pending.length, 1)
      assert.strictEqual(pending[0].remoteName, 'origin')
    })
  })

  describe('withResolvedCell', () => {
    const pendingMatrix = () =>
      buildSyncMatrix(
        [{ name: 'main', sha: 'aaa' }],
        remotes,
        refs({ [remoteTrackingRef('origin', 'main')]: 'bbb' }),
        new Map()
      )

    it('fills in a resolved comparison', () => {
      const resolved = withResolvedCell(pendingMatrix(), 'main', 'origin', {
        ahead: 2,
        behind: 1,
      })

      assert.strictEqual(resolved.rows[0].cells[0].state.kind, 'diverged')
      assert.strictEqual(pendingCells(resolved).length, 0)
    })

    it('returns the same object when nothing matched, so renders can be skipped', () => {
      const matrix = pendingMatrix()

      assert.strictEqual(
        withResolvedCell(matrix, 'nonexistent', 'origin', null),
        matrix
      )
      assert.strictEqual(
        withResolvedCell(matrix, 'main', 'nonexistent', null),
        matrix
      )
    })
  })

  it('describes every state', () => {
    assert.strictEqual(describeCellState({ kind: 'synced' }), 'In sync')
    assert.strictEqual(
      describeCellState({ kind: 'absent' }),
      'Not on this remote'
    )
    assert.strictEqual(
      describeCellState({
        kind: 'diverged',
        aheadBehind: { ahead: 2, behind: 1 },
      }),
      '2 ahead, 1 behind'
    )
  })
})

describe('git/getRefMap', () => {
  it('reads local and remote-tracking refs from a real repository', async t => {
    const repository = await setupEmptyRepository(t)
    const path = repository.path

    await exec(['config', 'user.email', 'test@example.com'], path)
    await exec(['config', 'user.name', 'Test'], path)
    await writeFile(join(path, 'a.txt'), 'a')
    await exec(['add', '.'], path)
    await exec(['commit', '-m', 'initial'], path)

    const head = await exec(['rev-parse', 'HEAD'], path)
    const sha = head.stdout.trim()

    // Fabricate a remote-tracking ref without needing a real remote.
    await exec(['update-ref', 'refs/remotes/origin/master', sha], path)

    const refs = await getRefMap(repository)

    assert.strictEqual(refs.get('refs/heads/master'), sha)
    assert.strictEqual(refs.get('refs/remotes/origin/master'), sha)
  })

  it('returns an empty map for a repository with no refs', async t => {
    const repository = await setupEmptyRepository(t)
    const refs = await getRefMap(repository)
    assert.strictEqual(refs.size, 0)
  })
})
