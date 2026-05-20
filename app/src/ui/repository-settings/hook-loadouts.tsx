import * as React from 'react'
import { DialogContent } from '../dialog'
import { Checkbox, CheckboxValue } from '../lib/checkbox'
import {
  HookLoadout,
  HookScript,
  LoadoutInstallation,
} from '../../lib/hooks/loadout-types'
import {
  BUILTIN_SCRIPTS,
  getBuiltinScript,
} from '../../lib/hooks/loadout-scripts'
import { BUILTIN_LOADOUTS } from '../../lib/hooks/loadout-presets'
import {
  getInstallation,
  saveInstallation,
  removeInstallation,
  toggleScript as toggleScriptInStore,
  getCustomLoadouts,
} from '../../lib/hooks/loadout-store'
import {
  installLoadout,
  uninstallLoadout,
  toggleScriptOnDisk,
  detectInstalledScripts,
} from '../../lib/hooks/loadout-manager'

interface IHookLoadoutsProps {
  readonly repoPath: string
}

interface IHookLoadoutsState {
  readonly loadouts: ReadonlyArray<HookLoadout>
  readonly installation: LoadoutInstallation | null
  readonly installedScripts: ReadonlyArray<{
    scriptId: string
    enabled: boolean
  }>
  readonly installing: boolean
  readonly error: string | null
}

export class HookLoadoutsSettings extends React.Component<
  IHookLoadoutsProps,
  IHookLoadoutsState
> {
  public constructor(props: IHookLoadoutsProps) {
    super(props)
    this.state = {
      loadouts: [],
      installation: null,
      installedScripts: [],
      installing: false,
      error: null,
    }
  }

  public async componentWillMount() {
    const loadouts = [...BUILTIN_LOADOUTS, ...getCustomLoadouts()]
    const installation = getInstallation(this.props.repoPath)
    const installedScripts = await detectInstalledScripts(this.props.repoPath)
    this.setState({ loadouts, installation, installedScripts })
  }

  private onInstall = async (loadout: HookLoadout) => {
    this.setState({ installing: true, error: null })
    try {
      await installLoadout(this.props.repoPath, loadout, BUILTIN_SCRIPTS)
      const installation: LoadoutInstallation = {
        repoPath: this.props.repoPath,
        loadoutId: loadout.id,
        installedAt: new Date().toISOString(),
        disabledScripts: [],
      }
      saveInstallation(installation)
      const installedScripts = await detectInstalledScripts(this.props.repoPath)
      this.setState({ installation, installedScripts, installing: false })
    } catch (e) {
      this.setState({ installing: false, error: `Install failed: ${e}` })
    }
  }

  private onUninstall = async () => {
    this.setState({ installing: true, error: null })
    try {
      await uninstallLoadout(this.props.repoPath)
      removeInstallation(this.props.repoPath)
      this.setState({
        installation: null,
        installedScripts: [],
        installing: false,
      })
    } catch (e) {
      this.setState({ installing: false, error: `Uninstall failed: ${e}` })
    }
  }

  private onToggleScript =
    (script: HookScript) =>
    async (event: React.FormEvent<HTMLInputElement>) => {
      const enabled = (event.currentTarget as HTMLInputElement).checked
      try {
        await toggleScriptOnDisk(this.props.repoPath, script, enabled)
        toggleScriptInStore(this.props.repoPath, script.id, enabled)
        const installation = getInstallation(this.props.repoPath)
        const installedScripts = await detectInstalledScripts(
          this.props.repoPath
        )
        this.setState({ installation, installedScripts })
      } catch (e) {
        this.setState({ error: `Toggle failed: ${e}` })
      }
    }

  private isScriptEnabled(scriptId: string): boolean {
    const found = this.state.installedScripts.find(
      s => s.scriptId === scriptId
    )
    return found ? found.enabled : true
  }

  private renderScriptsExpanded(loadout: HookLoadout) {
    const scripts = loadout.scriptIds
      .map(id => getBuiltinScript(id))
      .filter((s): s is HookScript => s !== undefined)

    const byType = new Map<string, HookScript[]>()
    for (const s of scripts) {
      const group = byType.get(s.hookType) ?? []
      group.push(s)
      byType.set(s.hookType, group)
    }

    return (
      <div className="loadout-scripts-expanded">
        {Array.from(byType.entries()).map(([hookType, hookScripts]) => (
          <div key={hookType} className="loadout-hook-group">
            <div className="loadout-hook-type">{hookType}</div>
            {hookScripts.map(s => (
              <div key={s.id} className="loadout-script-row">
                <Checkbox
                  label={s.name}
                  value={
                    this.isScriptEnabled(s.id)
                      ? CheckboxValue.On
                      : CheckboxValue.Off
                  }
                  onChange={this.onToggleScript(s)}
                />
                <span className="loadout-script-desc">{s.description}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    )
  }

  private renderScriptChips(loadout: HookLoadout) {
    const scripts = loadout.scriptIds
      .map(id => getBuiltinScript(id))
      .filter((s): s is HookScript => s !== undefined)

    return (
      <div className="loadout-script-summary">
        {scripts.map(s => (
          <span key={s.id} className="loadout-script-chip">
            {s.name}
          </span>
        ))}
      </div>
    )
  }

  private renderLoadoutCard(loadout: HookLoadout) {
    const { installation, installing } = this.state
    const isInstalled = installation?.loadoutId === loadout.id
    const hasOtherInstalled = installation !== null && !isInstalled

    const cardClass = [
      'loadout-card',
      isInstalled ? 'installed' : '',
      hasOtherInstalled ? 'disabled' : '',
    ]
      .filter(Boolean)
      .join(' ')

    return (
      <div key={loadout.id} className={cardClass}>
        <div className="loadout-card-header">
          <span className="loadout-card-title">{loadout.name}</span>
          <span
            className={`loadout-badge ${isInstalled ? 'badge-installed' : 'badge-available'}`}
          >
            {isInstalled ? 'Installed' : 'Available'}
          </span>
          {loadout.builtin && (
            <span className="loadout-badge badge-builtin">Builtin</span>
          )}
        </div>

        <div className="loadout-card-body">
          <p className="loadout-card-description">{loadout.description}</p>
          {!isInstalled && this.renderScriptChips(loadout)}
        </div>

        {isInstalled && this.renderScriptsExpanded(loadout)}

        <div className="loadout-card-actions">
          {isInstalled ? (
            <button
              className="loadout-btn loadout-btn-uninstall"
              onClick={this.onUninstall}
              disabled={installing}
              type="button"
            >
              Uninstall
            </button>
          ) : (
            <button
              className="loadout-btn loadout-btn-install"
              onClick={() => this.onInstall(loadout)}
              disabled={installing || hasOtherInstalled}
              type="button"
            >
              Install
            </button>
          )}
        </div>
      </div>
    )
  }

  public render() {
    const { installation, error, installing } = this.state

    return (
      <DialogContent>
        <div className="hook-loadouts">
          <p className="loadout-description">
            Hook loadouts install composable git hook scripts into this
            repository. Each hook type gets a dispatcher that runs individual
            scripts from a <code>.d/</code> directory, so scripts can be
            toggled independently.
          </p>

          {error && <div className="loadout-error">{error}</div>}

          {installation && (
            <div className="loadout-status-bar">
              <span className="loadout-status-label">Active:</span>
              <span className="loadout-status-name">
                {this.state.loadouts.find(
                  l => l.id === installation.loadoutId
                )?.name ?? installation.loadoutId}
              </span>
              <span className="loadout-status-date">
                {new Date(installation.installedAt).toLocaleDateString()}
              </span>
            </div>
          )}

          {installing && <p className="loadout-working">Working...</p>}

          {this.state.loadouts.map(l => this.renderLoadoutCard(l))}
        </div>
      </DialogContent>
    )
  }
}
