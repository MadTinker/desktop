import * as React from 'react'
import { DialogContent } from '../dialog'
import { Button } from '../lib/button'
import {
  getClaudeLoadoutStatus,
  installClaudeLoadout,
  uninstallClaudeLoadout,
  checkClaudeLoadoutDeps,
} from '../../lib/claude-hooks/remote'
import type {
  ClaudeDepStatus,
  ClaudeLoadoutStatus,
  ClaudeLoadoutTier,
} from '../../lib/claude-hooks/types'

/** Order tiers render in; also the fallback labels before a clone exists. */
const TIER_ORDER: ReadonlyArray<{
  tier: ClaudeLoadoutTier
  label: string
  summary: string
}> = [
  {
    tier: 'minimal',
    label: 'Minimal',
    summary: 'Infra-free essentials — runs anywhere python3 exists.',
  },
  {
    tier: 'standard',
    label: 'Standard',
    summary: 'Minimal + telemetry/logging. Mongo/MQTT used when present.',
  },
  {
    tier: 'full',
    label: 'Full',
    summary: 'Standard + machine-specific externals (titancall, dvttestkit).',
  },
]

type ActionState =
  | { kind: 'idle' }
  | { kind: 'busy'; what: string }
  | { kind: 'error'; message: string }
  | { kind: 'success'; message: string }

interface IClaudeCodePreferencesState {
  readonly status: ClaudeLoadoutStatus | null
  readonly selectedTier: ClaudeLoadoutTier
  readonly deps: ReadonlyArray<ClaudeDepStatus> | null
  readonly action: ActionState
}

/**
 * Preferences tab for the Claude Code Loadout — clones the claude-hooks repo
 * into ~/.claude/hooks and merges a chosen tier's hooks into settings.json.
 */
export class ClaudeCodePreferences extends React.Component<
  Record<string, never>,
  IClaudeCodePreferencesState
> {
  public constructor(props: Record<string, never>) {
    super(props)
    this.state = {
      status: null,
      selectedTier: 'minimal',
      deps: null,
      action: { kind: 'idle' },
    }
  }

  public async componentDidMount() {
    await this.refreshStatus()
  }

  private refreshStatus = async () => {
    const status = await getClaudeLoadoutStatus()
    const selectedTier = status.installation?.tier ?? this.state.selectedTier
    this.setState({ status, selectedTier })
    await this.refreshDeps(selectedTier)
  }

  private refreshDeps = async (tier: ClaudeLoadoutTier) => {
    try {
      const deps = await checkClaudeLoadoutDeps(tier)
      this.setState({ deps })
    } catch {
      // Manifest not cloned yet — deps unknown until first install.
      this.setState({ deps: null })
    }
  }

  private onSelectTier = (selectedTier: ClaudeLoadoutTier) => {
    this.setState({ selectedTier })
    void this.refreshDeps(selectedTier)
  }

  private onInstall = async () => {
    const { selectedTier } = this.state
    const installed = this.state.status?.installation != null
    this.setState({
      action: {
        kind: 'busy',
        what: installed ? 'Updating' : 'Installing',
      },
    })
    const result = await installClaudeLoadout(selectedTier)
    this.setState({
      action: result.success
        ? { kind: 'success', message: result.message }
        : { kind: 'error', message: result.message },
    })
    await this.refreshStatus()
  }

  private onUninstall = async () => {
    this.setState({ action: { kind: 'busy', what: 'Uninstalling' } })
    const result = await uninstallClaudeLoadout()
    this.setState({
      action: result.success
        ? { kind: 'success', message: result.message }
        : { kind: 'error', message: result.message },
    })
    await this.refreshStatus()
  }

  private renderTierCards() {
    const { status, selectedTier } = this.state
    const installedTier = status?.installation?.tier ?? null
    return (
      <div className="claude-loadout-tiers">
        {TIER_ORDER.map(({ tier, label, summary }) => {
          const manifestTier = status?.tiers?.[tier]
          const isSelected = tier === selectedTier
          const isInstalled = tier === installedTier
          return (
            <button
              key={tier}
              type="button"
              className={
                'claude-loadout-tier' + (isSelected ? ' selected' : '')
              }
              onClick={() => this.onSelectTier(tier)}
            >
              <div className="tier-header">
                <span className="tier-label">
                  {manifestTier?.label ?? label}
                </span>
                {isInstalled && <span className="tier-badge">Installed</span>}
              </div>
              <p className="tier-summary">{manifestTier?.summary ?? summary}</p>
            </button>
          )
        })}
      </div>
    )
  }

  private renderDeps() {
    const { deps } = this.state
    if (deps == null) {
      return (
        <p className="claude-loadout-deps-empty">
          Dependency status appears after the hooks repo is cloned (first
          install).
        </p>
      )
    }
    return (
      <ul className="claude-loadout-deps">
        {deps.map(d => (
          <li
            key={d.name}
            className={
              d.present ? 'present' : d.optional ? 'optional' : 'missing'
            }
          >
            <span className="dep-mark">{d.present ? '✓' : '✗'}</span>
            <span className="dep-name">{d.name}</span>
            {d.optional && <span className="dep-tag">optional</span>}
          </li>
        ))}
      </ul>
    )
  }

  private renderAction() {
    const { action } = this.state
    switch (action.kind) {
      case 'busy':
        return <p className="claude-loadout-status busy">{action.what}…</p>
      case 'error':
        return <p className="claude-loadout-status error">{action.message}</p>
      case 'success':
        return <p className="claude-loadout-status success">{action.message}</p>
      case 'idle':
        return null
    }
  }

  public render() {
    const { status, action } = this.state
    const busy = action.kind === 'busy'
    const installed = status?.installation != null
    const installation = status?.installation
    return (
      <DialogContent>
        <div className="claude-loadout-preferences">
          <p className="claude-loadout-intro">
            Distribute the workshop's Claude Code hooks (session naming,
            telemetry, autocommit, notifications) to this machine. Picks a tier,
            clones <code>claude-hooks</code> into <code>~/.claude/hooks</code>,
            and merges its hooks into <code>settings.json</code> — touching only
            entries it owns.
          </p>

          {this.renderTierCards()}

          <div className="claude-loadout-buttons">
            <Button onClick={this.onInstall} disabled={busy}>
              {installed ? 'Update / Reinstall' : 'Install'}
            </Button>
            <Button onClick={this.onUninstall} disabled={busy || !installed}>
              Uninstall
            </Button>
          </div>

          {this.renderAction()}

          {installation && (
            <p className="claude-loadout-current">
              Current: <strong>{installation.tier}</strong> —{' '}
              {installation.installedCommands.length} hook command(s) in{' '}
              <code>{installation.hooksDir}</code>
            </p>
          )}

          <h3>Dependencies</h3>
          {this.renderDeps()}
        </div>
      </DialogContent>
    )
  }
}
