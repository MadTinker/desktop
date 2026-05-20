import * as React from 'react'
import { DialogContent } from '../dialog'
import { Checkbox, CheckboxValue } from '../lib/checkbox'
import { Button } from '../lib/button'
import { HookLoadout, HookScript, LoadoutInstallation } from '../../lib/hooks/loadout-types'
import { BUILTIN_SCRIPTS, getBuiltinScript } from '../../lib/hooks/loadout-scripts'
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
  readonly installedScripts: ReadonlyArray<{ scriptId: string; enabled: boolean }>
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
      this.setState({
        installing: false,
        error: `Install failed: ${e}`,
      })
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
      this.setState({
        installing: false,
        error: `Uninstall failed: ${e}`,
      })
    }
  }

  private onToggleScript = (script: HookScript) => async (
    event: React.FormEvent<HTMLInputElement>
  ) => {
    const enabled = (event.currentTarget as HTMLInputElement).checked
    try {
      await toggleScriptOnDisk(this.props.repoPath, script, enabled)
      toggleScriptInStore(this.props.repoPath, script.id, enabled)
      const installation = getInstallation(this.props.repoPath)
      const installedScripts = await detectInstalledScripts(this.props.repoPath)
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

  private renderLoadoutCard(loadout: HookLoadout) {
    const { installation, installing } = this.state
    const isInstalled = installation?.loadoutId === loadout.id

    const scripts = loadout.scriptIds
      .map(id => getBuiltinScript(id))
      .filter((s): s is HookScript => s !== undefined)

    // Group scripts by hook type for display
    const byType = new Map<string, HookScript[]>()
    for (const s of scripts) {
      const group = byType.get(s.hookType) ?? []
      group.push(s)
      byType.set(s.hookType, group)
    }

    return (
      <div
        key={loadout.id}
        className="loadout-card"
        style={{
          border: isInstalled
            ? '2px solid var(--focus-color)'
            : '1px solid var(--box-border-color)',
          borderRadius: 'var(--border-radius)',
          padding: 'var(--spacing)',
          marginBottom: 'var(--spacing)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 'var(--spacing-half)',
          }}
        >
          <strong>{loadout.name}</strong>
          {isInstalled ? (
            <Button
              onClick={this.onUninstall}
              disabled={installing}
              type="button"
            >
              Uninstall
            </Button>
          ) : (
            <Button
              onClick={() => this.onInstall(loadout)}
              disabled={installing || installation !== null}
              type="button"
            >
              Install
            </Button>
          )}
        </div>

        <p
          style={{
            fontSize: 'var(--font-size-sm)',
            color: 'var(--text-secondary-color)',
            margin: '0 0 var(--spacing-half) 0',
          }}
        >
          {loadout.description}
        </p>

        {isInstalled && (
          <div className="loadout-scripts">
            {Array.from(byType.entries()).map(([hookType, hookScripts]) => (
              <div key={hookType} style={{ marginTop: 'var(--spacing-half)' }}>
                <span
                  style={{
                    fontSize: 'var(--font-size-sm)',
                    color: 'var(--text-secondary-color)',
                    fontFamily: 'var(--font-family-monospace)',
                  }}
                >
                  {hookType}
                </span>
                {hookScripts.map(s => (
                  <Checkbox
                    key={s.id}
                    label={`${s.name} — ${s.description}`}
                    value={
                      this.isScriptEnabled(s.id)
                        ? CheckboxValue.On
                        : CheckboxValue.Off
                    }
                    onChange={this.onToggleScript(s)}
                  />
                ))}
              </div>
            ))}
          </div>
        )}

        {!isInstalled && (
          <div
            style={{
              fontSize: 'var(--font-size-sm)',
              color: 'var(--text-secondary-color)',
            }}
          >
            {scripts.map(s => s.name).join(', ')}
          </div>
        )}
      </div>
    )
  }

  public render() {
    const { installation, error, installing } = this.state

    return (
      <DialogContent>
        <p className="loadout-description">
          Hook loadouts install composable git hook scripts into this
          repository. Each hook type gets a dispatcher that runs individual
          scripts from a <code>.d/</code> directory, so scripts can be toggled
          independently.
        </p>

        {error && (
          <p style={{ color: 'var(--error-color)' }}>{error}</p>
        )}

        {installation && (
          <p
            style={{
              fontSize: 'var(--font-size-sm)',
              color: 'var(--text-secondary-color)',
              marginBottom: 'var(--spacing)',
            }}
          >
            Installed:{' '}
            <strong>
              {this.state.loadouts.find(l => l.id === installation.loadoutId)
                ?.name ?? installation.loadoutId}
            </strong>{' '}
            — {new Date(installation.installedAt).toLocaleDateString()}
          </p>
        )}

        {installing && <p>Working...</p>}

        {this.state.loadouts.map(l => this.renderLoadoutCard(l))}
      </DialogContent>
    )
  }
}
