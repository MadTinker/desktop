import { describe, it } from 'node:test'
import assert from 'node:assert'
import { mkdtemp, writeFile, rm } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { mergeSettings, expandTier } from '../../src/lib/claude-hooks/installer'
import type { ClaudeLoadoutManifest } from '../../src/lib/claude-hooks/types'

/**
 * Verifies the two pure pieces of the Claude Code Loadout installer that don't
 * touch git or electron: tier expansion (token substitution + `extends` chain)
 * and the settings.json merge (append-only, dedupe-by-command, never clobber).
 */
describe('claude loadout installer', () => {
  const allCommands = (settings: {
    hooks?: Record<string, Array<{ hooks: Array<{ command: string }> }>>
  }) =>
    Object.values(settings.hooks ?? {})
      .flat()
      .flatMap(g => g.hooks)
      .map(h => h.command)

  describe('expandTier', () => {
    const manifest: ClaudeLoadoutManifest = {
      version: 1,
      pathToken: '{{HOOKS_DIR}}',
      tiers: {
        minimal: {
          label: 'Minimal',
          summary: '',
          deps: ['python3'],
          events: {
            SessionStart: ['python3 {{HOOKS_DIR}}/session_start.py'],
          },
        },
        standard: {
          label: 'Standard',
          summary: '',
          extends: 'minimal',
          deps: ['python3'],
          events: {
            Stop: ['python3 {{HOOKS_DIR}}/stop.py'],
          },
        },
        full: {
          label: 'Full',
          summary: '',
          extends: 'standard',
          deps: ['python3'],
          events: {},
        },
      },
    }

    it('substitutes the path token', () => {
      const expanded = expandTier(manifest, 'minimal', '/home/x/.claude/hooks')
      assert.deepEqual(expanded.SessionStart, [
        'python3 /home/x/.claude/hooks/session_start.py',
      ])
    })

    it('merges the extends chain (base events included)', () => {
      const expanded = expandTier(manifest, 'standard', '/h')
      assert.ok(expanded.SessionStart, 'inherited SessionStart from minimal')
      assert.ok(expanded.Stop, 'own Stop event present')
    })

    it('throws on an unknown tier', () => {
      assert.throws(() => expandTier(manifest, 'nope' as any, '/h'))
    })
  })

  describe('mergeSettings', () => {
    const withTempSettings = async (
      contents: unknown,
      fn: (settingsPath: string) => Promise<void>
    ) => {
      const dir = await mkdtemp(join(tmpdir(), 'claude-loadout-'))
      const settingsPath = join(dir, 'settings.json')
      if (contents !== undefined) {
        await writeFile(settingsPath, JSON.stringify(contents))
      }
      try {
        await fn(settingsPath)
      } finally {
        await rm(dir, { recursive: true, force: true })
      }
    }

    it('preserves an existing user hook and appends ours', async () => {
      const userCommand = 'python3 /my/own/hook.py'
      await withTempSettings(
        { hooks: { SessionStart: [{ hooks: [{ command: userCommand }] }] } },
        async settingsPath => {
          const { settings, added } = await mergeSettings(settingsPath, {
            SessionStart: ['python3 /h/session_start.py'],
            Stop: ['python3 /h/stop.py'],
          })
          const cmds = allCommands(settings)
          assert.ok(cmds.includes(userCommand), 'user hook preserved')
          assert.ok(cmds.includes('python3 /h/session_start.py'))
          assert.ok(cmds.includes('python3 /h/stop.py'))
          assert.deepEqual(added.sort(), [
            'python3 /h/session_start.py',
            'python3 /h/stop.py',
          ])
        }
      )
    })

    it('creates settings from scratch when the file is absent', async () => {
      await withTempSettings(undefined, async settingsPath => {
        const { settings, added } = await mergeSettings(settingsPath, {
          SessionStart: ['python3 /h/session_start.py'],
        })
        assert.deepEqual(added, ['python3 /h/session_start.py'])
        assert.deepEqual(allCommands(settings), ['python3 /h/session_start.py'])
      })
    })

    it('is idempotent — re-merging adds no duplicates', async () => {
      await withTempSettings(undefined, async settingsPath => {
        const expanded = { SessionStart: ['python3 /h/session_start.py'] }
        const first = await mergeSettings(settingsPath, expanded)
        await writeFile(settingsPath, JSON.stringify(first.settings))
        const second = await mergeSettings(settingsPath, expanded)
        assert.deepEqual(second.added, [], 'nothing added on second merge')
        assert.equal(allCommands(second.settings).length, 1)
      })
    })
  })
})
