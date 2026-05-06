import * as React from 'react'
import { DialogContent } from '../dialog'
import { Button } from '../lib/button'
import { TextBox } from '../lib/text-box'
import { Checkbox, CheckboxValue } from '../lib/checkbox'
import {
  AutomationHook,
  HookTrigger,
  HOOK_TRIGGERS,
  getAutomationHooks,
  saveAutomationHook,
  deleteAutomationHook,
  toggleAutomationHook,
} from '../../lib/automation-hooks/store'

interface IAutomationHooksPreferencesProps {
  readonly omnispindleApiKey: string
}

type EditingHook = {
  id?: string
  name: string
  trigger: HookTrigger
  script: string
  enabled: boolean
}

interface IAutomationHooksPreferencesState {
  readonly hooks: ReadonlyArray<AutomationHook>
  readonly editing: EditingHook | null
  readonly nameError: string | null
  readonly scriptError: string | null
}

const DEFAULT_SCRIPT = `#!/bin/bash
# Enter your script here
echo "Hello World"`

export class AutomationHooksPreferences extends React.Component<
  IAutomationHooksPreferencesProps,
  IAutomationHooksPreferencesState
> {
  public constructor(props: IAutomationHooksPreferencesProps) {
    super(props)
    this.state = {
      hooks: getAutomationHooks(),
      editing: null,
      nameError: null,
      scriptError: null,
    }
  }

  private reload() {
    this.setState({ hooks: getAutomationHooks() })
  }

  private openNew = () => {
    this.setState({
      editing: {
        name: '',
        trigger: 'manual',
        script: DEFAULT_SCRIPT,
        enabled: true,
      },
      nameError: null,
      scriptError: null,
    })
  }

  private openEdit = (hook: AutomationHook) => {
    this.setState({
      editing: {
        id: hook.id,
        name: hook.name,
        trigger: hook.trigger,
        script: hook.script,
        enabled: hook.enabled,
      },
      nameError: null,
      scriptError: null,
    })
  }

  private closeEditor = () => {
    this.setState({ editing: null, nameError: null, scriptError: null })
  }

  private onNameChanged = (name: string) => {
    const editing = this.state.editing
    if (!editing) {
      return
    }
    this.setState({ editing: { ...editing, name }, nameError: null })
  }

  private onTriggerChanged = (
    event: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const editing = this.state.editing
    if (!editing) {
      return
    }
    this.setState({
      editing: { ...editing, trigger: event.currentTarget.value as HookTrigger },
    })
  }

  private onScriptChanged = (
    event: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    const editing = this.state.editing
    if (!editing) {
      return
    }
    this.setState({
      editing: { ...editing, script: event.currentTarget.value },
      scriptError: null,
    })
  }

  private onEnabledChanged = (
    event: React.FormEvent<HTMLInputElement>
  ) => {
    const editing = this.state.editing
    if (!editing) {
      return
    }
    this.setState({
      editing: {
        ...editing,
        enabled: (event.currentTarget as HTMLInputElement).checked,
      },
    })
  }

  private onSave = () => {
    const { editing } = this.state
    if (!editing) {
      return
    }

    let hasError = false
    if (!editing.name.trim()) {
      this.setState({ nameError: 'Name is required' })
      hasError = true
    }
    if (!editing.script.trim()) {
      this.setState({ scriptError: 'Script is required' })
      hasError = true
    }
    if (hasError) {
      return
    }

    saveAutomationHook({
      id: editing.id,
      name: editing.name.trim(),
      trigger: editing.trigger,
      script: editing.script,
      enabled: editing.enabled,
    })
    this.setState({ editing: null, nameError: null, scriptError: null })
    this.reload()
  }

  private onDelete = (id: string) => {
    deleteAutomationHook(id)
    this.reload()
  }

  private onToggle = (id: string, enabled: boolean) => {
    toggleAutomationHook(id, enabled)
    this.reload()
  }

  private renderHookList() {
    const { hooks } = this.state
    if (hooks.length === 0) {
      return (
        <div className="automation-hooks-empty">
          <p>No automation hooks configured.</p>
          <p className="git-settings-description">
            Hooks let you run shell scripts in response to events like commits
            and AI session start/close.
          </p>
        </div>
      )
    }

    return (
      <ul className="automation-hooks-list">
        {hooks.map(hook => (
          <li key={hook.id} className="automation-hook-item">
            <div className="automation-hook-info">
              <span className="automation-hook-name">{hook.name}</span>
              <span className="automation-hook-trigger">
                {HOOK_TRIGGERS.find(t => t.id === hook.trigger)?.label ??
                  hook.trigger}
              </span>
              {!hook.enabled && (
                <span className="automation-hook-disabled">Disabled</span>
              )}
            </div>
            <div className="automation-hook-actions">
              <button
                className="automation-hook-btn"
                onClick={() => this.openEdit(hook)}
                aria-label="Edit hook"
              >
                Edit
              </button>
              <button
                className="automation-hook-btn automation-hook-btn-toggle"
                onClick={() => this.onToggle(hook.id, !hook.enabled)}
                aria-label={hook.enabled ? 'Disable hook' : 'Enable hook'}
              >
                {hook.enabled ? 'Disable' : 'Enable'}
              </button>
              <button
                className="automation-hook-btn automation-hook-btn-danger"
                onClick={() => this.onDelete(hook.id)}
                aria-label="Delete hook"
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    )
  }

  private renderEditor() {
    const { editing, nameError, scriptError } = this.state
    if (!editing) {
      return null
    }

    return (
      <div className="automation-hook-editor">
        <h3>{editing.id ? 'Edit Hook' : 'New Hook'}</h3>

        <div className="automation-hook-editor-row">
          <TextBox
            label="Hook Name"
            value={editing.name}
            onValueChanged={this.onNameChanged}
            placeholder="e.g. Notify on commit"
          />
          {nameError && (
            <p className="automation-hook-error">{nameError}</p>
          )}
        </div>

        <div className="automation-hook-editor-row">
          <label className="automation-hook-label" htmlFor="hook-trigger">
            Trigger Event
          </label>
          <select
            id="hook-trigger"
            className="automation-hook-select"
            value={editing.trigger}
            onChange={this.onTriggerChanged}
          >
            {HOOK_TRIGGERS.map(t => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div className="automation-hook-editor-row">
          <label className="automation-hook-label" htmlFor="hook-script">
            Shell Script
          </label>
          <textarea
            id="hook-script"
            className="automation-hook-textarea"
            value={editing.script}
            onChange={this.onScriptChanged}
            rows={10}
            spellCheck={false}
          />
          {scriptError && (
            <p className="automation-hook-error">{scriptError}</p>
          )}
        </div>

        <div className="automation-hook-editor-row automation-hook-editor-footer">
          <Checkbox
            label="Enabled"
            value={editing.enabled ? CheckboxValue.On : CheckboxValue.Off}
            onChange={this.onEnabledChanged}
          />
          <div className="automation-hook-editor-buttons">
            <Button onClick={this.closeEditor}>Cancel</Button>
            <Button type="submit" onClick={this.onSave}>
              Save Hook
            </Button>
          </div>
        </div>
      </div>
    )
  }

  public render() {
    const { editing } = this.state
    const { omnispindleApiKey } = this.props

    return (
      <DialogContent>
        <div className="automation-hooks-section">
          <div className="automation-hooks-header">
            <h2>Automation Hooks</h2>
            {!editing && (
              <Button onClick={this.openNew}>+ New Hook</Button>
            )}
          </div>

          <p className="git-settings-description">
            Run shell scripts automatically on events like commits, AI session
            start/close, and todo creation.
            {!omnispindleApiKey && (
              <>
                {' '}
                Add your Omnispindle API key to sync hooks across devices.
              </>
            )}
          </p>

          {editing ? this.renderEditor() : this.renderHookList()}
        </div>
      </DialogContent>
    )
  }
}
