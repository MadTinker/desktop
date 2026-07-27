import { describe, it } from 'node:test'
import assert from 'node:assert'
import { join } from 'path'
import { exec } from 'dugite'

import {
  pushAllSubmodules,
  pushSubmodule,
} from '../../../src/lib/git/submodule'
import { setupEmptyRepository } from '../../helpers/repositories'
import { makeCommit } from '../../helpers/repository-scaffolding'
import { createTempDirectory } from '../../helpers/temp'
import { Repository } from '../../../src/models/repository'

/**
 * Creates a bare clone of a repository to stand in for a submodule's upstream.
 */
async function createBareUpstream(
  t: import('node:test').TestContext,
  source: Repository
): Promise<string> {
  const barePath = await createTempDirectory(t)
  await exec(['clone', '--bare', source.path, barePath], source.path)
  return barePath
}

/** A repository with one commit, so it can be cloned and pushed to. */
async function seedRepository(
  t: import('node:test').TestContext
): Promise<Repository> {
  const repo = await setupEmptyRepository(t)
  await makeCommit(repo, {
    entries: [{ path: 'README.md', contents: 'initial' }],
    commitMessage: 'initial commit',
  })
  return repo
}

/**
 * Registers `barePath` as a real submodule of `parent` at `name` and returns its
 * working tree. `protocol.file.allow` is needed because the upstream is a path.
 */
async function addSubmodule(
  parent: Repository,
  barePath: string,
  name: string
): Promise<Repository> {
  await exec(
    ['-c', 'protocol.file.allow=always', 'submodule', 'add', barePath, name],
    parent.path
  )
  return new Repository(join(parent.path, name), -1, null, false)
}

/**
 * Clones `barePath` into `<parent>/<name>` so it looks like an initialized
 * submodule working tree to `pushSubmodule` — which only needs a git repository
 * at that path, not a registered gitlink.
 */
async function cloneInto(
  parent: Repository,
  barePath: string,
  name: string
): Promise<Repository> {
  await exec(['clone', barePath, name], parent.path)
  const path = join(parent.path, name)
  await exec(['config', 'user.name', 'Some User'], path)
  await exec(['config', 'user.email', 'user@example.com'], path)
  return new Repository(path, -1, null, false)
}

async function tipOf(path: string): Promise<string> {
  const result = await exec(['rev-parse', 'HEAD'], path)
  return result.stdout.trim()
}

describe('git/submodule pushSubmodule', () => {
  it('pushes a submodule that has unpushed commits', async t => {
    const seed = await seedRepository(t)
    const barePath = await createBareUpstream(t, seed)
    const parent = await setupEmptyRepository(t)
    const submodule = await cloneInto(parent, barePath, 'sub')

    await makeCommit(submodule, {
      entries: [{ path: 'new-file.txt', contents: 'new content' }],
      commitMessage: 'add new file',
    })

    await pushSubmodule(parent, 'sub')

    assert.equal(await tipOf(barePath), await tipOf(submodule.path))
  })

  it('skips a submodule that is behind its own remote', async t => {
    const seed = await seedRepository(t)
    const barePath = await createBareUpstream(t, seed)
    const parent = await setupEmptyRepository(t)
    const submodule = await cloneInto(parent, barePath, 'sub')

    // Someone else moves the submodule's remote forward...
    await makeCommit(seed, {
      entries: [{ path: 'theirs.txt', contents: 'theirs' }],
      commitMessage: 'their commit',
    })
    await exec(['push', barePath, 'HEAD'], seed.path)

    // ...and we learn about it, leaving the submodule behind with nothing of
    // its own to push. Pushing anyway would earn a non-fast-forward rejection.
    await exec(['fetch', 'origin'], submodule.path)
    const remoteTip = await tipOf(barePath)

    await pushSubmodule(parent, 'sub')

    assert.notEqual(await tipOf(submodule.path), remoteTip)
    assert.equal(await tipOf(barePath), remoteTip)
  })

  it('skips a submodule with no remotes', async t => {
    const parent = await setupEmptyRepository(t)
    await exec(['init', 'sub'], parent.path)

    await pushSubmodule(parent, 'sub')
  })
})

describe('git/submodule pushAllSubmodules', () => {
  it('pushes every submodule even when one fails, then reports it', async t => {
    // Two independent submodule upstreams: 'a-bad' will be rejected, and it
    // sorts first, so the good one only gets pushed if the batch carries on.
    const badSeed = await seedRepository(t)
    const badBare = await createBareUpstream(t, badSeed)
    const goodSeed = await seedRepository(t)
    const goodBare = await createBareUpstream(t, goodSeed)

    const parent = await seedRepository(t)
    const bad = await addSubmodule(parent, badBare, 'a-bad')
    const good = await addSubmodule(parent, goodBare, 'b-good')

    // Diverge 'a-bad': a commit of ours, and a commit of theirs on its remote.
    await makeCommit(bad, {
      entries: [{ path: 'mine.txt', contents: 'mine' }],
      commitMessage: 'my commit',
    })
    await makeCommit(badSeed, {
      entries: [{ path: 'theirs.txt', contents: 'theirs' }],
      commitMessage: 'their commit',
    })
    await exec(['push', badBare, 'HEAD'], badSeed.path)
    const badRemoteTip = await tipOf(badBare)

    await makeCommit(good, {
      entries: [{ path: 'mine.txt', contents: 'mine' }],
      commitMessage: 'my commit',
    })

    await assert.rejects(pushAllSubmodules(parent), (e: Error) => {
      assert.match(e.message, /a-bad/)
      assert.doesNotMatch(e.message, /b-good/)
      return true
    })

    // The failing submodule left its remote alone, the other one still landed.
    assert.equal(await tipOf(badBare), badRemoteTip)
    assert.equal(await tipOf(goodBare), await tipOf(good.path))
  })
})
