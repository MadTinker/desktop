import { describe, it } from 'node:test'
import assert from 'node:assert'
import { join } from 'path'
import { exec } from 'dugite'

import { pushSubmodule } from '../../../src/lib/git/submodule'
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
    const seed = await setupEmptyRepository(t)
    await makeCommit(seed, {
      entries: [{ path: 'README.md', contents: 'initial' }],
      commitMessage: 'initial commit',
    })

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
    const seed = await setupEmptyRepository(t)
    await makeCommit(seed, {
      entries: [{ path: 'README.md', contents: 'initial' }],
      commitMessage: 'initial commit',
    })

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
