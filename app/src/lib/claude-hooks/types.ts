/**
 * Types for the Claude Code Loadout installer — distributes the claude-prime
 * hooks (github.com/MadnessEngineering/claude-hooks) into a fresh machine's
 * ~/.claude. Mirrors the per-repo git-hook loadout system, but targets the
 * machine-global Claude Code config instead of a single repository.
 */

/** The tiers declared in the hooks repo's loadout-manifest.json. */
export type ClaudeLoadoutTier = 'minimal' | 'standard' | 'full'

/** One tier entry as it appears in loadout-manifest.json. */
export interface ClaudeManifestTier {
  readonly label: string
  readonly summary: string
  /** Tier this one builds on; its events are merged in first. */
  readonly extends?: ClaudeLoadoutTier
  /** Hard requirements — install is pointless without these. */
  readonly deps: ReadonlyArray<string>
  /** Soft requirements — features degrade to no-op when absent. */
  readonly optional?: ReadonlyArray<string>
  /** event name -> raw command strings (may contain {{HOOKS_DIR}}). */
  readonly events: Record<string, ReadonlyArray<string>>
}

/** The loadout-manifest.json shipped alongside the hooks. */
export interface ClaudeLoadoutManifest {
  readonly version: number
  readonly description?: string
  readonly pathToken: string
  readonly tiers: Record<ClaudeLoadoutTier, ClaudeManifestTier>
}

/**
 * Sidecar written to ~/.claude/.madness-loadout.json. Records exactly what we
 * wrote so uninstall removes precisely those entries and nothing else.
 */
export interface ClaudeLoadoutInstallation {
  readonly tier: ClaudeLoadoutTier
  /** Fully-resolved command strings we appended to settings.json. */
  readonly installedCommands: ReadonlyArray<string>
  /** Managed clone directory (where {{HOOKS_DIR}} resolved to). */
  readonly hooksDir: string
  readonly installedAt: string
}

/** Per-dependency probe result for the UI status panel. */
export interface ClaudeDepStatus {
  readonly name: string
  readonly present: boolean
  /** True for `optional` deps (missing is a soft warning, not a blocker). */
  readonly optional: boolean
}

/** Result of any install/update/uninstall action. */
export interface ClaudeLoadoutResult {
  readonly success: boolean
  readonly message: string
  readonly installation?: ClaudeLoadoutInstallation | null
}

/** Combined state for rendering the preferences tab. */
export interface ClaudeLoadoutStatus {
  /** Current install from the sidecar, or null if nothing installed. */
  readonly installation: ClaudeLoadoutInstallation | null
  /** Tier labels/summaries from the cloned manifest, if available. */
  readonly tiers: Record<ClaudeLoadoutTier, ClaudeManifestTier> | null
}
