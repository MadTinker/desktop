import { describe, it } from 'node:test'
import assert from 'node:assert'
import { readFile } from 'fs/promises'
import { join } from 'path'

import {
  clearRemotePolicy,
  getRemotePolicies,
  getRemotePolicy,
  renameRemotePolicy,
  setRemotePolicy,
} from '../../../src/lib/git'
import { branchNameFromPolicyKey } from '../../../src/lib/git/remote-policy'
import {
  RemoteAllowList,
  describeRemoteAllowList,
  isRemoteAllowed,
  isReservedRemoteName,
  parseRemoteAllowList,
  serializeRemoteAllowList,
} from '../../../src/models/remote-policy'
import { setupEmptyRepository } from '../../helpers/repositories'

describe('models/remote-policy', () => {
  describe('parseRemoteAllowList', () => {
    it('treats a missing value as unset rather than a restriction', () => {
      assert.deepStrictEqual(parseRemoteAllowList(null), { kind: 'unset' })
    })

    it('treats an empty or whitespace value as unset', () => {
      assert.deepStrictEqual(parseRemoteAllowList(''), { kind: 'unset' })
      assert.deepStrictEqual(parseRemoteAllowList('   '), { kind: 'unset' })
    })

    it('parses the reserved words case-insensitively', () => {
      assert.deepStrictEqual(parseRemoteAllowList('none'), { kind: 'none' })
      assert.deepStrictEqual(parseRemoteAllowList('NONE'), { kind: 'none' })
      assert.deepStrictEqual(parseRemoteAllowList('all'), { kind: 'all' })
      assert.deepStrictEqual(parseRemoteAllowList(' All '), { kind: 'all' })
    })

    it('parses a space separated remote list', () => {
      assert.deepStrictEqual(parseRemoteAllowList('origin bitbucket'), {
        kind: 'only',
        remotes: ['origin', 'bitbucket'],
      })
    })

    it('tolerates irregular whitespace and duplicates', () => {
      assert.deepStrictEqual(
        parseRemoteAllowList('  origin\t\torigin  gitea '),
        {
          kind: 'only',
          remotes: ['origin', 'gitea'],
        }
      )
    })
  })

  describe('serializeRemoteAllowList', () => {
    it('returns null for unset so the key is removed, not blanked', () => {
      assert.strictEqual(serializeRemoteAllowList({ kind: 'unset' }), null)
    })

    it('round-trips every kind', () => {
      const cases: ReadonlyArray<RemoteAllowList> = [
        { kind: 'none' },
        { kind: 'all' },
        { kind: 'only', remotes: ['origin'] },
        { kind: 'only', remotes: ['origin', 'bitbucket', 'gitea'] },
      ]

      for (const allowed of cases) {
        const value = serializeRemoteAllowList(allowed)
        assert.notStrictEqual(value, null)
        assert.deepStrictEqual(parseRemoteAllowList(value), allowed)
      }
    })

    it('collapses an empty allow list to none rather than an empty value', () => {
      assert.strictEqual(
        serializeRemoteAllowList({ kind: 'only', remotes: [] }),
        'none'
      )
    })
  })

  describe('isRemoteAllowed', () => {
    it('does not treat unset as consent', () => {
      assert.strictEqual(isRemoteAllowed({ kind: 'unset' }, 'origin'), false)
    })

    it('blocks everything for none and permits everything for all', () => {
      assert.strictEqual(isRemoteAllowed({ kind: 'none' }, 'origin'), false)
      assert.strictEqual(isRemoteAllowed({ kind: 'all' }, 'anything'), true)
    })

    it('permits only the named remotes', () => {
      const allowed: RemoteAllowList = { kind: 'only', remotes: ['origin'] }
      assert.strictEqual(isRemoteAllowed(allowed, 'origin'), true)
      assert.strictEqual(isRemoteAllowed(allowed, 'bitbucket'), false)
    })
  })

  it('flags remote names that collide with the reserved words', () => {
    assert.strictEqual(isReservedRemoteName('all'), true)
    assert.strictEqual(isReservedRemoteName('None'), true)
    assert.strictEqual(isReservedRemoteName('origin'), false)
  })

  it('describes each policy for display', () => {
    assert.strictEqual(
      describeRemoteAllowList({ kind: 'only', remotes: ['origin', 'gitea'] }),
      'Only origin, gitea'
    )
    assert.strictEqual(
      describeRemoteAllowList({ kind: 'none' }),
      'Local only — never pushed'
    )
  })
})

describe('git/remote-policy', () => {
  describe('branchNameFromPolicyKey', () => {
    it('handles branch names containing dots', () => {
      assert.strictEqual(
        branchNameFromPolicyKey('branch.release/1.4.madnessremotes'),
        'release/1.4'
      )
    })

    it('rejects keys of another shape', () => {
      assert.strictEqual(branchNameFromPolicyKey('branch.foo.remote'), null)
      assert.strictEqual(branchNameFromPolicyKey('core.bare'), null)
      assert.strictEqual(
        branchNameFromPolicyKey('branch..madnessremotes'),
        null
      )
    })
  })

  it('writes a policy a human can read in .git/config', async t => {
    const repository = await setupEmptyRepository(t)

    await setRemotePolicy(repository, 'dan/scratch', { kind: 'none' })
    await setRemotePolicy(repository, 'feature/auth', {
      kind: 'only',
      remotes: ['origin', 'bitbucket'],
    })

    const config = await readFile(
      join(repository.path, '.git', 'config'),
      'utf8'
    )

    assert.match(config, /\[branch "dan\/scratch"\]/)
    assert.match(config, /madnessRemotes = none/)
    assert.match(config, /\[branch "feature\/auth"\]/)
    assert.match(config, /madnessRemotes = origin bitbucket/)
  })

  it('round-trips every policy kind through a real repository', async t => {
    const repository = await setupEmptyRepository(t)

    const cases: ReadonlyArray<[string, RemoteAllowList]> = [
      ['locked-out', { kind: 'none' }],
      ['wide-open', { kind: 'all' }],
      ['single', { kind: 'only', remotes: ['origin'] }],
      ['several', { kind: 'only', remotes: ['origin', 'bitbucket'] }],
    ]

    for (const [branch, allowed] of cases) {
      await setRemotePolicy(repository, branch, allowed)
      assert.deepStrictEqual(await getRemotePolicy(repository, branch), allowed)
    }
  })

  it('reads every branch policy in a single pass', async t => {
    const repository = await setupEmptyRepository(t)

    await setRemotePolicy(repository, 'dan/scratch', { kind: 'none' })
    await setRemotePolicy(repository, 'release/1.4', {
      kind: 'only',
      remotes: ['origin'],
    })
    await setRemotePolicy(repository, 'main', { kind: 'all' })

    const policies = await getRemotePolicies(repository)

    assert.strictEqual(policies.size, 3)
    assert.deepStrictEqual(policies.get('dan/scratch'), { kind: 'none' })
    assert.deepStrictEqual(policies.get('release/1.4'), {
      kind: 'only',
      remotes: ['origin'],
    })
    assert.deepStrictEqual(policies.get('main'), { kind: 'all' })
  })

  it('preserves the case of the branch name', async t => {
    const repository = await setupEmptyRepository(t)

    await setRemotePolicy(repository, 'Dan/Scratch', { kind: 'none' })

    const policies = await getRemotePolicies(repository)
    assert.deepStrictEqual(policies.get('Dan/Scratch'), { kind: 'none' })
    assert.strictEqual(policies.get('dan/scratch'), undefined)
  })

  it('returns an empty map for a repository with no policies', async t => {
    const repository = await setupEmptyRepository(t)
    const policies = await getRemotePolicies(repository)
    assert.strictEqual(policies.size, 0)
  })

  it('reports an unpoliced branch as unset', async t => {
    const repository = await setupEmptyRepository(t)
    assert.deepStrictEqual(await getRemotePolicy(repository, 'main'), {
      kind: 'unset',
    })
  })

  it('clears a policy, and tolerates clearing one that is already absent', async t => {
    const repository = await setupEmptyRepository(t)

    await setRemotePolicy(repository, 'main', { kind: 'none' })
    await clearRemotePolicy(repository, 'main')

    assert.deepStrictEqual(await getRemotePolicy(repository, 'main'), {
      kind: 'unset',
    })

    await clearRemotePolicy(repository, 'never-had-one')
  })

  it('clears the policy when asked to set it to unset', async t => {
    const repository = await setupEmptyRepository(t)

    await setRemotePolicy(repository, 'main', { kind: 'none' })
    await setRemotePolicy(repository, 'main', { kind: 'unset' })

    const policies = await getRemotePolicies(repository)
    assert.strictEqual(policies.size, 0)
  })

  it('moves the policy when a branch is renamed', async t => {
    const repository = await setupEmptyRepository(t)

    await setRemotePolicy(repository, 'dan/scratch', {
      kind: 'only',
      remotes: ['gitea'],
    })
    await renameRemotePolicy(repository, 'dan/scratch', 'dan/scratch-2')

    const policies = await getRemotePolicies(repository)

    assert.strictEqual(policies.size, 1)
    assert.deepStrictEqual(policies.get('dan/scratch-2'), {
      kind: 'only',
      remotes: ['gitea'],
    })
  })

  it('does nothing when renaming a branch that has no policy', async t => {
    const repository = await setupEmptyRepository(t)

    await renameRemotePolicy(repository, 'unpoliced', 'still-unpoliced')

    const policies = await getRemotePolicies(repository)
    assert.strictEqual(policies.size, 0)
  })
})
