import assert from 'node:assert'
import { describe, it } from 'node:test'

import { reduceTerminalSessions } from '../../../src/ui/terminal-sessions'

describe('reduceTerminalSessions', () => {
  it('materialises a session for the active repo when the panel is open', () => {
    const next = reduceTerminalSessions([], {
      visible: true,
      activeRepoPath: '/a',
      knownRepoPaths: ['/a', '/b'],
    })
    assert.deepStrictEqual(next, ['/a'])
  })

  it('spawns nothing while the panel is closed', () => {
    const prev: ReadonlyArray<string> = []
    const next = reduceTerminalSessions(prev, {
      visible: false,
      activeRepoPath: '/a',
      knownRepoPaths: ['/a'],
    })
    // No change -> same reference back.
    assert.strictEqual(next, prev)
  })

  it('does not add an active repo that is not a known repository', () => {
    const prev: ReadonlyArray<string> = []
    const next = reduceTerminalSessions(prev, {
      visible: true,
      activeRepoPath: '/ghost',
      knownRepoPaths: ['/a'],
    })
    assert.strictEqual(next, prev)
  })

  it('keeps prior sessions mounted across an A→B→A swap', () => {
    const known = ['/a', '/b']

    // Open on A.
    const afterA = reduceTerminalSessions([], {
      visible: true,
      activeRepoPath: '/a',
      knownRepoPaths: known,
    })
    assert.deepStrictEqual(afterA, ['/a'])

    // Swap to B — A's session must stay mounted so its pty survives.
    const afterB = reduceTerminalSessions(afterA, {
      visible: true,
      activeRepoPath: '/b',
      knownRepoPaths: known,
    })
    assert.deepStrictEqual(afterB, ['/a', '/b'])

    // Swap back to A — no churn; both sessions still present.
    const backToA = reduceTerminalSessions(afterB, {
      visible: true,
      activeRepoPath: '/a',
      knownRepoPaths: known,
    })
    assert.strictEqual(backToA, afterB, 'returning to A should be a no-op')
  })

  it('keeps sessions alive while hidden, then reuses them on reopen', () => {
    const known = ['/a', '/b']

    const afterA = reduceTerminalSessions([], {
      visible: true,
      activeRepoPath: '/a',
      knownRepoPaths: known,
    })

    // Close the panel and browse to B — nothing new spawns while hidden.
    const whileHidden = reduceTerminalSessions(afterA, {
      visible: false,
      activeRepoPath: '/b',
      knownRepoPaths: known,
    })
    assert.strictEqual(whileHidden, afterA, 'no session for B while closed')

    // Reopen on B — B is materialised now, A is still there.
    const afterReopen = reduceTerminalSessions(whileHidden, {
      visible: true,
      activeRepoPath: '/b',
      knownRepoPaths: known,
    })
    assert.deepStrictEqual(afterReopen, ['/a', '/b'])
  })

  it('evicts a session when its repository leaves the app (no orphan ptys)', () => {
    // Repo /a removed from the app; its session must be dropped so unmounting
    // the pane kills its ptys.
    const next = reduceTerminalSessions(['/a', '/b'], {
      visible: true,
      activeRepoPath: '/b',
      knownRepoPaths: ['/b'],
    })
    assert.deepStrictEqual(next, ['/b'])
  })

  it('evicts the active repo too when it is removed', () => {
    const next = reduceTerminalSessions(['/a'], {
      visible: true,
      activeRepoPath: '/a',
      knownRepoPaths: [],
    })
    assert.deepStrictEqual(next, [])
  })

  it('is a no-op when the active repo already has a session', () => {
    const prev = ['/a']
    const next = reduceTerminalSessions(prev, {
      visible: true,
      activeRepoPath: '/a',
      knownRepoPaths: ['/a'],
    })
    assert.strictEqual(next, prev)
  })
})
