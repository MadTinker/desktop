/**
 * Claude Code Loadout installer.
 *
 * Clones the claude-hooks repo into a managed directory, then merges the chosen
 * tier's hook commands into ~/.claude/settings.json — appending only, never
 * clobbering user/non-managed entries. Everything we write is recorded in a
 * sidecar so uninstall removes precisely those entries.
 *
 * Runs in the main process (uses fs + child_process). The caller resolves the
 * real home/.claude path via app.getPath('home') and passes it in, keeping this
 * module free of electron imports and unit-testable.
 */

import { spawn } from 'child_process'
import { mkdir, readFile, writeFile, stat } from 'fs/promises'
import { join } from 'path'

import {
  ClaudeDepStatus,
  ClaudeLoadoutInstallation,
  ClaudeLoadoutManifest,
  ClaudeLoadoutResult,
  ClaudeLoadoutStatus,
  ClaudeLoadoutTier,
  ClaudeManifestTier,
} from './types'

export const DEFAULT_HOOKS_REPO =
  'https://github.com/MadnessEngineering/claude-hooks.git'

const MANIFEST_FILE = 'loadout-manifest.json'
const SIDECAR_FILE = '.madness-loadout.json'
const HOOKS_CONFIG_FILE = 'hooks_config.json'
const SETTINGS_FILE = 'settings.json'

/** A single command entry inside a settings.json hook group. */
interface SettingsHookCommand {
  type: 'command'
  command: string
  timeout?: number
}
interface SettingsHookGroup {
  matcher?: string
  hooks: SettingsHookCommand[]
}
interface ClaudeSettings {
  hooks?: Record<string, SettingsHookGroup[]>
  [key: string]: unknown
}

/** Resolve the layout of paths we touch, given the user's home dir. */
export function resolvePaths(homeDir: string, hooksDir?: string) {
  const claudeDir = join(homeDir, '.claude')
  return {
    claudeDir,
    settingsPath: join(claudeDir, SETTINGS_FILE),
    sidecarPath: join(claudeDir, SIDECAR_FILE),
    hooksConfigPath: join(claudeDir, HOOKS_CONFIG_FILE),
    hooksDir: hooksDir ?? join(claudeDir, 'hooks'),
  }
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await stat(p)
    return true
  } catch {
    return false
  }
}

/** Run a command, resolving with exit code + captured output (never rejects). */
function run(
  cmd: string,
  args: string[],
  cwd?: string
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise(resolve => {
    let child
    try {
      child = spawn(cmd, args, { cwd, env: process.env })
    } catch (e) {
      resolve({ code: 127, stdout: '', stderr: String(e) })
      return
    }
    const out: Buffer[] = []
    const err: Buffer[] = []
    child.stdout?.on('data', (c: Buffer) => out.push(c))
    child.stderr?.on('data', (c: Buffer) => err.push(c))
    child.on('error', e =>
      resolve({ code: 127, stdout: '', stderr: String(e) })
    )
    child.on('close', code =>
      resolve({
        code: code ?? 1,
        stdout: Buffer.concat(out).toString('utf8'),
        stderr: Buffer.concat(err).toString('utf8'),
      })
    )
  })
}

/**
 * Clone the hooks repo into hooksDir, or `git pull` if it's already a clone.
 * Returns the resolved hooksDir on success.
 */
export async function cloneOrUpdateHooks(
  hooksDir: string,
  repoUrl: string = DEFAULT_HOOKS_REPO
): Promise<void> {
  if (await pathExists(join(hooksDir, '.git'))) {
    const pull = await run('git', ['pull', '--ff-only'], hooksDir)
    if (pull.code !== 0) {
      throw new Error(`git pull failed: ${pull.stderr.trim() || pull.stdout}`)
    }
    return
  }
  // Fresh clone. Ensure parent exists; clone into the (possibly non-empty for
  // a symlinked ~/.claude/hooks) target via a temp-free direct clone.
  await mkdir(hooksDir, { recursive: true })
  const clone = await run('git', ['clone', repoUrl, hooksDir])
  if (clone.code !== 0) {
    throw new Error(`git clone failed: ${clone.stderr.trim() || clone.stdout}`)
  }
}

/** Read + parse the cloned loadout-manifest.json. */
export async function readManifest(
  hooksDir: string
): Promise<ClaudeLoadoutManifest> {
  const raw = await readFile(join(hooksDir, MANIFEST_FILE), 'utf8')
  return JSON.parse(raw) as ClaudeLoadoutManifest
}

/**
 * Expand a tier into resolved command strings keyed by event, walking the
 * `extends` chain (base first) and substituting the {{HOOKS_DIR}} token.
 */
export function expandTier(
  manifest: ClaudeLoadoutManifest,
  tier: ClaudeLoadoutTier,
  hooksDir: string
): Record<string, string[]> {
  const t: ClaudeManifestTier | undefined = manifest.tiers[tier]
  if (!t) {
    throw new Error(`Unknown tier: ${tier}`)
  }
  const events: Record<string, string[]> = t.extends
    ? expandTier(manifest, t.extends, hooksDir)
    : {}
  const token = manifest.pathToken ?? '{{HOOKS_DIR}}'
  for (const [event, cmds] of Object.entries(t.events)) {
    const list = events[event] ?? (events[event] = [])
    for (const cmd of cmds) {
      list.push(cmd.split(token).join(hooksDir))
    }
  }
  return events
}

/** Every command in a settings hooks block, flattened (for dedupe). */
function existingCommands(hooks: Record<string, SettingsHookGroup[]>): Set<string> {
  const seen = new Set<string>()
  for (const groups of Object.values(hooks)) {
    for (const g of groups) {
      for (const h of g.hooks ?? []) {
        seen.add(h.command)
      }
    }
  }
  return seen
}

/**
 * Merge a tier's commands into settings.json. Appends our entries, deduping by
 * exact command string; never touches existing groups. Returns the list of
 * commands actually added.
 */
export async function mergeSettings(
  settingsPath: string,
  expanded: Record<string, string[]>
): Promise<{ settings: ClaudeSettings; added: string[] }> {
  let settings: ClaudeSettings = {}
  if (await pathExists(settingsPath)) {
    try {
      settings = JSON.parse(await readFile(settingsPath, 'utf8'))
    } catch (e) {
      throw new Error(`~/.claude/settings.json is not valid JSON: ${e}`)
    }
  }
  const hooks = (settings.hooks ??= {})
  const seen = existingCommands(hooks)
  const added: string[] = []
  for (const [event, cmds] of Object.entries(expanded)) {
    const groups = (hooks[event] ??= [])
    for (const command of cmds) {
      if (seen.has(command)) {
        continue
      }
      groups.push({ hooks: [{ type: 'command', command }] })
      seen.add(command)
      added.push(command)
    }
  }
  return { settings, added }
}

async function readSidecar(
  sidecarPath: string
): Promise<ClaudeLoadoutInstallation | null> {
  if (!(await pathExists(sidecarPath))) {
    return null
  }
  try {
    return JSON.parse(await readFile(sidecarPath, 'utf8'))
  } catch {
    return null
  }
}

/** Write ~/.claude/hooks_config.json defaults only if absent. */
async function seedHooksConfig(hooksConfigPath: string): Promise<void> {
  if (await pathExists(hooksConfigPath)) {
    return
  }
  const defaults = {
    mongo_logging: false,
    mqtt_logging: false,
    name_agent: true,
    autocommit: true,
  }
  await writeFile(hooksConfigPath, JSON.stringify(defaults, null, 2) + '\n')
}

/** Probe deps for a tier (hard + optional), for the UI status panel. */
export async function checkDeps(
  manifest: ClaudeLoadoutManifest,
  tier: ClaudeLoadoutTier,
  hooksDir: string
): Promise<ClaudeDepStatus[]> {
  // Collect deps across the extends chain.
  const hard = new Set<string>()
  const soft = new Set<string>()
  let cur: ClaudeLoadoutTier | undefined = tier
  while (cur) {
    const t: ClaudeManifestTier = manifest.tiers[cur]
    t.deps.forEach(d => hard.add(d))
    t.optional?.forEach(d => soft.add(d))
    cur = t.extends
  }
  const probe = async (name: string): Promise<boolean> => {
    switch (name) {
      case 'python3':
        return (await run('python3', ['--version'])).code === 0
      case 'node':
        return (await run('node', ['--version'])).code === 0
      case 'uv':
        return (await run('uv', ['--version'])).code === 0
      case 'pymongo':
      case 'dvttestkit':
        return (await run('python3', ['-c', `import ${name}`])).code === 0
      case 'titancall':
        return (await run('sh', ['-c', 'command -v titancall'])).code === 0
      case 'mongo':
      case 'mqtt':
        // Runtime services, not local binaries — report present (hooks degrade
        // gracefully when the broker/db is unreachable).
        return true
      default:
        return (await run('sh', ['-c', `command -v ${name}`])).code === 0
    }
  }
  const results: ClaudeDepStatus[] = []
  for (const name of hard) {
    results.push({ name, present: await probe(name), optional: false })
  }
  for (const name of soft) {
    if (hard.has(name)) {
      continue
    }
    results.push({ name, present: await probe(name), optional: true })
  }
  return results
}

/** Full install / re-install of a tier. */
export async function install(
  homeDir: string,
  tier: ClaudeLoadoutTier,
  opts: { repoUrl?: string; hooksDir?: string; installedAt: string } = {
    installedAt: '',
  }
): Promise<ClaudeLoadoutResult> {
  const paths = resolvePaths(homeDir, opts.hooksDir)
  try {
    await mkdir(paths.claudeDir, { recursive: true })
    await cloneOrUpdateHooks(paths.hooksDir, opts.repoUrl)
    const manifest = await readManifest(paths.hooksDir)
    const expanded = expandTier(manifest, tier, paths.hooksDir)
    const { settings, added } = await mergeSettings(paths.settingsPath, expanded)
    await writeFile(
      paths.settingsPath,
      JSON.stringify(settings, null, 2) + '\n'
    )
    await seedHooksConfig(paths.hooksConfigPath)

    // Merge newly-added commands with anything a prior install of a different
    // tier left behind, so uninstall still removes everything we own.
    const prior = await readSidecar(paths.sidecarPath)
    const installedCommands = Array.from(
      new Set([...(prior?.installedCommands ?? []), ...added])
    )
    const installation: ClaudeLoadoutInstallation = {
      tier,
      installedCommands,
      hooksDir: paths.hooksDir,
      installedAt: opts.installedAt,
    }
    await writeFile(
      paths.sidecarPath,
      JSON.stringify(installation, null, 2) + '\n'
    )
    return {
      success: true,
      message: `Installed "${tier}" — ${added.length} hook command(s) added.`,
      installation,
    }
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : String(e) }
  }
}

/** Remove only the commands recorded in the sidecar. */
export async function uninstall(homeDir: string): Promise<ClaudeLoadoutResult> {
  const paths = resolvePaths(homeDir)
  try {
    const sidecar = await readSidecar(paths.sidecarPath)
    if (!sidecar) {
      return { success: true, message: 'Nothing installed.', installation: null }
    }
    const toRemove = new Set(sidecar.installedCommands)
    if (await pathExists(paths.settingsPath)) {
      const settings: ClaudeSettings = JSON.parse(
        await readFile(paths.settingsPath, 'utf8')
      )
      const hooks = settings.hooks ?? {}
      for (const [event, groups] of Object.entries(hooks)) {
        const kept = groups.filter(
          g => !(g.hooks ?? []).some(h => toRemove.has(h.command))
        )
        if (kept.length) {
          hooks[event] = kept
        } else {
          delete hooks[event]
        }
      }
      await writeFile(
        paths.settingsPath,
        JSON.stringify(settings, null, 2) + '\n'
      )
    }
    // Drop the sidecar by writing an empty marker file removal: rewrite as gone.
    await writeFile(paths.sidecarPath, JSON.stringify(null) + '\n')
    return {
      success: true,
      message: `Removed ${toRemove.size} hook command(s).`,
      installation: null,
    }
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : String(e) }
  }
}

/** Current install + available tiers, for rendering the preferences tab. */
export async function getStatus(homeDir: string): Promise<ClaudeLoadoutStatus> {
  const paths = resolvePaths(homeDir)
  const installation = await readSidecar(paths.sidecarPath)
  let tiers: ClaudeLoadoutStatus['tiers'] = null
  if (await pathExists(join(paths.hooksDir, MANIFEST_FILE))) {
    try {
      tiers = (await readManifest(paths.hooksDir)).tiers
    } catch {
      tiers = null
    }
  }
  return { installation, tiers }
}
