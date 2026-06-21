/**
 * Renderer-side proxies for the Claude Code Loadout installer. The actual work
 * (git clone, settings.json merge, dep probing) runs in the main process — see
 * ./installer.ts and the `claude-loadout-*` handlers in main.ts.
 */

import { invokeProxy } from '../../ui/main-process-proxy'
import type {
  ClaudeDepStatus,
  ClaudeLoadoutResult,
  ClaudeLoadoutStatus,
  ClaudeLoadoutTier,
} from './types'

const statusIpc = invokeProxy('claude-loadout-status', 0)
const installIpc = invokeProxy('claude-loadout-install', 1)
const uninstallIpc = invokeProxy('claude-loadout-uninstall', 0)
const checkDepsIpc = invokeProxy('claude-loadout-check-deps', 1)

export function getClaudeLoadoutStatus(): Promise<ClaudeLoadoutStatus> {
  return statusIpc()
}

export function installClaudeLoadout(
  tier: ClaudeLoadoutTier
): Promise<ClaudeLoadoutResult> {
  return installIpc(tier)
}

export function uninstallClaudeLoadout(): Promise<ClaudeLoadoutResult> {
  return uninstallIpc()
}

export function checkClaudeLoadoutDeps(
  tier: ClaudeLoadoutTier
): Promise<ReadonlyArray<ClaudeDepStatus>> {
  return checkDepsIpc(tier)
}
