import { describe, it } from 'node:test'
import assert from 'node:assert'

import { reduceTerminalSessions } from '../../src/ui/terminal-sessions'

const A = '/repos/alpha'
const B = '/repos/beta'
const C = '/repos/gamma'

const allKnown = [A, B, C]

/** Convenience wrapper so the cases below read like the user's actions. */
function reduce(
  prev: ReadonlyArray<string>,
  visible: boolean,
  activeRepoPath: string | null,
  knownRepoPaths: ReadonlyArray<string> = allKnown
) {
  return reduceTerminalSessions(prev, {
    visible,
    activeRepoPath,
    knownRepoPaths,
  })
}

describe('ui/terminal-sessions', () => {
  describe('materialising sessions', () => {
    it('spawns nothing while the panel is closed', () => {
      assert.deepStrictEqual(reduce([], false, A), [])
    })

    it('materialises the active repo when the panel opens', () => {
      assert.deepStrictEqual(reduce([], true, A), [A])
    })

    it('spawns nothing for a non-repository selection', () => {
      assert.deepStrictEqual(reduce([], true, null), [])
    })

    it('spawns nothing for a repo the app does not know about', () => {
      assert.deepStrictEqual(reduce([], true, '/repos/ghost'), [])
    })

    it('keeps first-shown order as new repos are visited', () => {
      let s = reduce([], true, B)
      s = reduce(s, true, A)
      s = reduce(s, true, C)
      assert.deepStrictEqual(s, [B, A, C])
    })
  })

  describe('surviving repo swaps', () => {
    it('retains a repo session after swapping away and back', () => {
      const afterA = reduce([], true, A)
      const afterB = reduce(afterA, true, B)

      // A is no longer active but must stay mounted so its tabs, live
      // processes and scrollback survive the swap.
      assert.deepStrictEqual(afterB, [A, B])

      const backToA = reduce(afterB, true, A)
      assert.deepStrictEqual(backToA, [A, B])
    })

    it('returns the same array reference when nothing changes', () => {
      const sessions = reduce([], true, A)
      assert.strictEqual(reduce(sessions, true, A), sessions)
      assert.strictEqual(reduce(sessions, true, B, [A]), sessions)
      assert.strictEqual(reduce(sessions, false, A), sessions)
    })

    it('retains every session while the panel is closed', () => {
      const open = reduce(reduce([], true, A), true, B)
      const closed = reduce(open, false, B)
      assert.strictEqual(closed, open)

      // Reopening on a repo that already has a session must not re-add it.
      assert.strictEqual(reduce(closed, true, B), open)
    })

    it('retains sessions while a non-repository selection is active', () => {
      const open = reduce([], true, A)
      assert.strictEqual(reduce(open, true, null), open)
    })
  })

  describe('eviction', () => {
    it('drops the session of a repository removed from the app', () => {
      const open = reduce(reduce([], true, A), true, B)
      assert.deepStrictEqual(reduce(open, true, B, [B, C]), [B])
    })

    it('drops every session when all repositories are removed', () => {
      const open = reduce(reduce([], true, A), true, B)
      assert.deepStrictEqual(reduce(open, true, null, []), [])
    })

    it('does not resurrect a removed repo that is still the active path', () => {
      const open = reduce([], true, A)
      // A is gone from the app but the selection has not caught up yet.
      assert.deepStrictEqual(reduce(open, true, A, [B, C]), [])
    })
  })
})
