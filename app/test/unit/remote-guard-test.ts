import { describe, it, TestContext } from 'node:test'
import assert from 'node:assert'
import { chmod, mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import { exec } from 'dugite'

import { getBuiltinScript } from '../../src/lib/hooks/loadout-scripts'
import { BUILTIN_LOADOUTS } from '../../src/lib/hooks/loadout-presets'
import { RemoteGuardBlockMarker } from '../../src/models/remote-policy'
import { containsRemoteGuardBlock } from '../../src/lib/remote-guard-output'
import { setRemotePolicy } from '../../src/lib/git'
import { Repository } from '../../src/models/repository'
import { setupEmptyRepository } from '../helpers/repositories'
import { createTempDirectory } from '../helpers/temp'

/**
 * These exercise the *embedded* hook script — the one shipped inside
 * loadout-scripts.ts — against real repositories rather than a copy of it.
 * The script lives in a JS template literal, so shell syntax such as
 * `${ref#refs/heads/}` has to survive escaping; running it is the only way to
 * know that it did.
 */

const git = (args: ReadonlyArray<string>, path: string) => exec([...args], path)

interface IGuardedRepository {
  readonly repository: Repository
  readonly push: (
    remote: string,
    ...args: ReadonlyArray<string>
  ) => Promise<{ exitCode: number; output: string }>
}

/** A repository with the guard installed and two bare remotes to push at. */
async function setupGuardedRepository(
  t: TestContext
): Promise<IGuardedRepository> {
  const repository = await setupEmptyRepository(t)
  const path = repository.path

  const script = getBuiltinScript('remote-guard')
  assert.notStrictEqual(script, undefined, 'remote-guard should be registered')

  // A repository created by `git init` with an empty template dir has no
  // hooks directory at all.
  const hooksDir = join(path, '.git', 'hooks')
  await mkdir(hooksDir, { recursive: true })

  const hookPath = join(hooksDir, 'pre-push')
  await writeFile(hookPath, script!.script)
  await chmod(hookPath, 0o755)

  await git(['config', 'user.email', 'test@example.com'], path)
  await git(['config', 'user.name', 'Test'], path)
  await writeFile(join(path, 'file.txt'), 'contents')
  await git(['add', '.'], path)
  await git(['commit', '-m', 'initial'], path)

  for (const name of ['origin', 'gitea']) {
    const remotePath = await createTempDirectory(t)
    await exec(['init', '--bare', remotePath], remotePath)
    await git(['remote', 'add', name, remotePath], path)
  }

  const push = async (remote: string, ...args: ReadonlyArray<string>) => {
    const result = await git(['push', remote, ...args], path)
    return {
      exitCode: result.exitCode,
      output: `${result.stdout}${result.stderr}`,
    }
  }

  return { repository, push }
}

async function checkoutNewBranch(repository: Repository, name: string) {
  await git(['checkout', '-b', name], repository.path)
  await writeFile(join(repository.path, `${name.replace(/\//g, '-')}.txt`), 'x')
  await git(['add', '.'], repository.path)
  await git(['commit', '-m', `work on ${name}`], repository.path)
}

describe('hooks/remote-guard', () => {
  it('is registered as a pre-push hook', () => {
    const script = getBuiltinScript('remote-guard')

    assert.notStrictEqual(script, undefined)
    assert.strictEqual(script!.hookType, 'pre-push')
    assert.match(script!.script, /^#!\/usr\/bin\/env bash/)
    assert.ok(
      script!.script.includes(RemoteGuardBlockMarker),
      'the script must print the marker the app watches for'
    )
  })

  it('is included in every builtin loadout', () => {
    for (const loadout of BUILTIN_LOADOUTS) {
      assert.ok(
        loadout.scriptIds.includes('remote-guard'),
        `${loadout.id} should install the remote guard`
      )
    }
  })

  it('blocks a branch locked to no remote', async t => {
    const { repository, push } = await setupGuardedRepository(t)
    await checkoutNewBranch(repository, 'scratch')
    await setRemotePolicy(repository, 'scratch', { kind: 'none' })

    const { exitCode, output } = await push('origin', 'scratch')

    assert.notStrictEqual(exitCode, 0)
    assert.ok(containsRemoteGuardBlock(output))
    assert.match(output, /is local only/)
  })

  it('blocks a remote the branch is not permitted to reach', async t => {
    const { repository, push } = await setupGuardedRepository(t)
    await checkoutNewBranch(repository, 'feature/auth')
    await setRemotePolicy(repository, 'feature/auth', {
      kind: 'only',
      remotes: ['origin'],
    })

    const { exitCode, output } = await push('gitea', 'feature/auth')

    assert.notStrictEqual(exitCode, 0)
    assert.ok(containsRemoteGuardBlock(output))
    assert.match(output, /may only be pushed to: origin/)
  })

  it('permits a remote the branch is allowed to reach', async t => {
    const { repository, push } = await setupGuardedRepository(t)
    await checkoutNewBranch(repository, 'feature/auth')
    await setRemotePolicy(repository, 'feature/auth', {
      kind: 'only',
      remotes: ['origin'],
    })

    const { exitCode, output } = await push('origin', 'feature/auth')

    assert.strictEqual(exitCode, 0, output)
    assert.ok(!containsRemoteGuardBlock(output))
  })

  it('permits any remote for an explicitly unrestricted branch', async t => {
    const { repository, push } = await setupGuardedRepository(t)
    await checkoutNewBranch(repository, 'wide')
    await setRemotePolicy(repository, 'wide', { kind: 'all' })

    assert.strictEqual((await push('gitea', 'wide')).exitCode, 0)
  })

  it('leaves branches without a policy alone', async t => {
    const { repository, push } = await setupGuardedRepository(t)
    await checkoutNewBranch(repository, 'unpoliced')

    assert.strictEqual((await push('gitea', 'unpoliced')).exitCode, 0)
  })

  it('rejects a whole batch push when any branch in it is blocked', async t => {
    const { repository, push } = await setupGuardedRepository(t)
    await checkoutNewBranch(repository, 'shareable')
    await checkoutNewBranch(repository, 'scratch')
    await setRemotePolicy(repository, 'scratch', { kind: 'none' })

    const { exitCode, output } = await push('origin', '--all')

    assert.notStrictEqual(exitCode, 0)
    assert.ok(containsRemoteGuardBlock(output))

    // Nothing may have landed — a partial push is worse than a refused one.
    const remoteHeads = await git(
      ['ls-remote', '--heads', 'origin'],
      repository.path
    )
    assert.strictEqual(remoteHeads.stdout.trim(), '')
  })

  it('does not block a branch deletion', async t => {
    const { repository, push } = await setupGuardedRepository(t)
    await checkoutNewBranch(repository, 'disposable')

    assert.strictEqual((await push('origin', 'disposable')).exitCode, 0)

    await setRemotePolicy(repository, 'disposable', { kind: 'none' })

    assert.strictEqual((await push('origin', ':disposable')).exitCode, 0)
  })

  it('does not block tag pushes', async t => {
    const { repository, push } = await setupGuardedRepository(t)
    await setRemotePolicy(repository, 'master', { kind: 'none' })
    await git(['tag', 'v1'], repository.path)

    assert.strictEqual((await push('origin', 'v1')).exitCode, 0)
  })
})

describe('lib/remote-guard-output', () => {
  it('recognises the marker across every terminal output shape', () => {
    const text = `${RemoteGuardBlockMarker} 'x' is local only.`

    assert.ok(containsRemoteGuardBlock(text))
    assert.ok(containsRemoteGuardBlock(Buffer.from(text)))
    assert.ok(
      containsRemoteGuardBlock([
        Buffer.from(text.slice(0, 5)),
        Buffer.from(text.slice(5)),
      ]),
      'a marker split across chunks must still be found'
    )
  })

  it('ignores unrelated hook failures', () => {
    assert.ok(
      !containsRemoteGuardBlock('error: some other pre-push hook failed')
    )
    assert.ok(!containsRemoteGuardBlock('BLOCKED: by an unrelated tool'))
  })
})
