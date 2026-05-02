import * as React from 'react'
import { exec } from 'dugite'
import { access, constants, readdir, readFile } from 'fs/promises'
import { basename, join, resolve } from 'path'
import { DialogContent } from '../dialog'
import { Checkbox, CheckboxValue } from '../lib/checkbox'
import { getRepoHookEnabled, setRepoHookEnabled } from '../../lib/hooks/hook-state'

interface IHooksProps {
  readonly repoPath: string
}

interface IHooksState {
  readonly hooks: ReadonlyArray<string>
  readonly loading: boolean
  readonly isOmnispindle: boolean
  // Map from hookName → enabled state (mirrors localStorage, tracked for re-render)
  readonly enabled: Record<string, boolean>
}

const hookGroups: Record<string, ReadonlyArray<string>> = {
  Commit: [
    'applypatch-msg',
    'pre-applypatch',
    'post-applypatch',
    'pre-commit',
    'pre-merge-commit',
    'prepare-commit-msg',
    'commit-msg',
    'post-commit',
  ],
  Push: [
    'pre-push',
    'pre-receive',
    'update',
    'proc-receive',
    'post-receive',
    'post-update',
    'push-to-checkout',
  ],
  Merge: ['pre-rebase', 'post-checkout', 'post-merge'],
}

async function resolveHooksDir(repoPath: string): Promise<string> {
  // Check for custom hooksPath first
  const configResult = await exec(
    ['config', '-z', '--get', 'core.hooksPath'],
    repoPath
  )
  if (configResult.exitCode === 0) {
    return resolve(repoPath, configResult.stdout.split('\0')[0])
  }

  // Use rev-parse --git-dir to handle submodules (where .git is a file, not a dir)
  const gitDirResult = await exec(['rev-parse', '--git-dir'], repoPath)
  const gitDir =
    gitDirResult.exitCode === 0
      ? resolve(repoPath, gitDirResult.stdout.trim())
      : join(repoPath, '.git')

  return join(gitDir, 'hooks')
}

async function discoverHooks(repoPath: string): Promise<ReadonlyArray<string>> {
  const hooksDir = await resolveHooksDir(repoPath)
  const entries = await readdir(hooksDir, { withFileTypes: true }).catch(
    () => []
  )

  const known = new Set([
    'applypatch-msg', 'pre-applypatch', 'post-applypatch',
    'pre-commit', 'pre-merge-commit', 'prepare-commit-msg',
    'commit-msg', 'post-commit', 'pre-rebase', 'post-checkout',
    'post-merge', 'pre-push', 'pre-receive', 'update', 'proc-receive',
    'post-receive', 'post-update', 'reference-transaction',
    'push-to-checkout', 'pre-auto-gc', 'post-rewrite',
    'sendemail-validate', 'fsmonitor-watchman', 'p4-changelist',
    'p4-prepare-changelist', 'p4-post-changelist', 'p4-pre-submit',
    'post-index-change',
  ])

  const isExecutable = (path: string) =>
    access(path, constants.X_OK)
      .then(() => true)
      .catch(() => false)

  const hooks: string[] = []
  for (const entry of entries) {
    if (!entry.isFile()) {
      continue
    }
    const hookName = basename(entry.name, '.exe')
    if (!known.has(hookName)) {
      continue
    }
    const filePath = join(hooksDir, entry.name)
    if (__WIN32__ || (await isExecutable(filePath))) {
      hooks.push(hookName)
    }
  }
  return hooks
}

async function detectOmnispindle(
  repoPath: string,
  hooks: ReadonlyArray<string>
): Promise<boolean> {
  if (hooks.length === 0) {
    return false
  }
  const hooksDir = await resolveHooksDir(repoPath)
  for (const hook of hooks) {
    try {
      const ext = __WIN32__ ? '.exe' : ''
      const content = await readFile(join(hooksDir, `${hook}${ext}`), {
        encoding: 'utf8',
      })
      if (content.toLowerCase().includes('omnispindle')) {
        return true
      }
    } catch {
      // unreadable hook — skip
    }
  }
  return false
}

export class HooksSettings extends React.Component<IHooksProps, IHooksState> {
  public constructor(props: IHooksProps) {
    super(props)
    this.state = {
      hooks: [],
      loading: true,
      isOmnispindle: false,
      enabled: {},
    }
  }

  public async componentWillMount() {
    const hooks = await discoverHooks(this.props.repoPath)

    const enabled: Record<string, boolean> = {}
    for (const hook of hooks) {
      enabled[hook] = getRepoHookEnabled(this.props.repoPath, hook)
    }

    const isOmnispindle = await detectOmnispindle(this.props.repoPath, hooks)

    this.setState({ hooks, enabled, isOmnispindle, loading: false })
  }

  private onToggle = (hookName: string) => (
    event: React.FormEvent<HTMLInputElement>
  ) => {
    const enabled = (event.currentTarget as HTMLInputElement).checked
    setRepoHookEnabled(this.props.repoPath, hookName, enabled)
    this.setState(prev => ({
      enabled: { ...prev.enabled, [hookName]: enabled },
    }))
  }

  private renderHook(hookName: string) {
    const enabled = this.state.enabled[hookName] !== false
    return (
      <Checkbox
        key={hookName}
        label={hookName}
        value={enabled ? CheckboxValue.On : CheckboxValue.Off}
        onChange={this.onToggle(hookName)}
      />
    )
  }

  private renderGroup(
    groupName: string,
    hooksInGroup: ReadonlyArray<string>
  ): JSX.Element | null {
    if (hooksInGroup.length === 0) {
      return null
    }
    return (
      <div key={groupName} className="hooks-group">
        <h3>{groupName}</h3>
        {hooksInGroup.map(h => this.renderHook(h))}
      </div>
    )
  }

  public render() {
    if (this.state.loading) {
      return (
        <DialogContent>
          <p>Loading hooks…</p>
        </DialogContent>
      )
    }

    const { hooks } = this.state

    if (hooks.length === 0) {
      return (
        <DialogContent>
          <p className="no-hooks">
            No executable git hooks found for this repository.
          </p>
        </DialogContent>
      )
    }

    const grouped: Record<string, string[]> = {
      Commit: [],
      Push: [],
      Merge: [],
      Other: [],
    }

    for (const hook of hooks) {
      let placed = false
      for (const [group, members] of Object.entries(hookGroups)) {
        if (members.includes(hook)) {
          grouped[group].push(hook)
          placed = true
          break
        }
      }
      if (!placed) {
        grouped['Other'].push(hook)
      }
    }

    return (
      <DialogContent>
        {this.state.isOmnispindle && (
          <p className="omnispindle-badge">
            Omnispindle hooks detected — toggles apply immediately
          </p>
        )}
        <p className="hooks-description">
          Enable or disable individual git hooks for this repository. Disabled
          hooks are skipped during git operations.
        </p>
        {Object.entries(grouped).map(([group, members]) =>
          this.renderGroup(group, members)
        )}
      </DialogContent>
    )
  }
}
