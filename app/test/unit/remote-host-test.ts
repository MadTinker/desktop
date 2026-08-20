import { describe, it } from 'node:test'
import assert from 'node:assert'

import { getRemoteHost, getRemoteHostLabel } from '../../src/lib/remote-host'

describe('lib/remote-host', () => {
  it('recognises GitHub over https and ssh', () => {
    assert.strictEqual(
      getRemoteHost('https://github.com/octocat/Hello-World.git'),
      'github'
    )
    assert.strictEqual(
      getRemoteHost('git@github.com:octocat/Hello-World.git'),
      'github'
    )
  })

  it('recognises Bitbucket over https and ssh', () => {
    assert.strictEqual(
      getRemoteHost('https://bitbucket.org/team/repo.git'),
      'bitbucket'
    )
    assert.strictEqual(
      getRemoteHost('git@bitbucket.org:team/repo.git'),
      'bitbucket'
    )
  })

  it('recognises the other common hosts', () => {
    assert.strictEqual(getRemoteHost('https://gitlab.com/g/p.git'), 'gitlab')
    assert.strictEqual(getRemoteHost('https://codeberg.org/g/p.git'), 'gitea')
    assert.strictEqual(
      getRemoteHost('https://dev.azure.com/o/p/_git/r'),
      'azure'
    )
  })

  it('recognises self-hosted instances by subdomain', () => {
    assert.strictEqual(
      getRemoteHost('https://gitlab.example.com/g/p.git'),
      'gitlab'
    )
    assert.strictEqual(
      getRemoteHost('git@bitbucket.internal:team/repo.git'),
      'bitbucket'
    )
  })

  it('treats filesystem paths as local', () => {
    assert.strictEqual(getRemoteHost('/srv/git/repo.git'), 'local')
    assert.strictEqual(getRemoteHost('../sibling.git'), 'local')
    assert.strictEqual(getRemoteHost('file:///srv/git/repo.git'), 'local')
    assert.strictEqual(getRemoteHost('C:\\repos\\thing.git'), 'local')
  })

  it('falls back to other for anything unrecognised', () => {
    assert.strictEqual(
      getRemoteHost('https://git.mycompany.net/g/p.git'),
      'other'
    )
    assert.strictEqual(getRemoteHost(''), 'other')
    assert.strictEqual(getRemoteHost('   '), 'other')
  })

  it('labels every host', () => {
    assert.strictEqual(getRemoteHostLabel('github'), 'GitHub')
    assert.strictEqual(getRemoteHostLabel('bitbucket'), 'Bitbucket')
    assert.strictEqual(getRemoteHostLabel('other'), 'Git')
  })
})
