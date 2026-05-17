import * as React from 'react'
import { DialogContent } from '../dialog'
import {
  HotkeyStore,
  DefaultActionDefinitions,
  acceleratorToDisplayString,
  ActionDefinitionMap,
} from '../../lib/hotkeys'
import {
  ActionCategory,
  ActionDefinition,
  Keybinding,
} from '../../lib/hotkeys/hotkey-types'
import { KeybindingEditor } from './keybinding-editor'

interface IKeybindingsProps {
  readonly hotkeyStore: HotkeyStore
}

interface IKeybindingsState {
  readonly filter: string
  readonly editingActionId: string | null
  readonly conflictLabel: string | null
  readonly expandedCategories: Set<ActionCategory>
}

const CategoryLabels: Record<ActionCategory, string> = {
  file: 'File',
  edit: 'Edit',
  view: 'View',
  repository: 'Repository',
  branch: 'Branch',
  commit: 'Commit',
  navigation: 'Navigation',
  misc: 'Misc',
}

const CategoryOrder: ReadonlyArray<ActionCategory> = [
  'file',
  'edit',
  'view',
  'repository',
  'branch',
  'commit',
  'navigation',
  'misc',
]

export class Keybindings extends React.Component<
  IKeybindingsProps,
  IKeybindingsState
> {
  private disposeListener: (() => void) | null = null

  public constructor(props: IKeybindingsProps) {
    super(props)
    this.state = {
      filter: '',
      editingActionId: null,
      conflictLabel: null,
      expandedCategories: new Set(CategoryOrder),
    }
  }

  public componentDidMount() {
    this.disposeListener = this.props.hotkeyStore.onDidChange(() => {
      this.forceUpdate()
    })
  }

  public componentWillUnmount() {
    if (this.disposeListener) {
      this.disposeListener()
    }
  }

  public render() {
    return (
      <DialogContent>
        <div className="keybindings-preferences">
          <h2>Keyboard Shortcuts</h2>

          <div className="keybindings-toolbar">
            <input
              type="text"
              className="keybindings-filter"
              placeholder="Search actions…"
              value={this.state.filter}
              onChange={this.onFilterChanged}
            />
            <button
              className="button-component reset-all-button"
              onClick={this.onResetAll}
            >
              Reset All
            </button>
          </div>

          <div className="keybindings-list">
            {CategoryOrder.map(cat => this.renderCategory(cat))}
          </div>
        </div>
      </DialogContent>
    )
  }

  private renderCategory(category: ActionCategory) {
    const actions = this.getFilteredActions(category)
    if (actions.length === 0) {
      return null
    }

    const isExpanded = this.state.expandedCategories.has(category)

    return (
      <div key={category} className="keybinding-category">
        <div
          className="keybinding-category-header"
          onClick={() => this.toggleCategory(category)}
        >
          <span className="category-chevron">
            {isExpanded ? '▾' : '▸'}
          </span>
          <span className="category-label">{CategoryLabels[category]}</span>
          <span className="category-count">{actions.length}</span>
        </div>

        {isExpanded && (
          <div className="keybinding-category-items">
            {actions.map(def => this.renderAction(def))}
          </div>
        )}
      </div>
    )
  }

  private renderAction(def: ActionDefinition) {
    const { hotkeyStore } = this.props
    const binding = hotkeyStore.getEffectiveBinding(def.id)
    const hasOverride = hotkeyStore.hasOverride(def.id)
    const isEditing = this.state.editingActionId === def.id

    if (isEditing) {
      return (
        <div key={def.id} className="keybinding-row editing">
          <div className="keybinding-action-label">{def.label}</div>
          <KeybindingEditor
            currentBinding={binding}
            onBindingCaptured={b => this.onBindingCaptured(def.id, b)}
            onCancel={this.onCancelEdit}
            conflictLabel={this.state.conflictLabel ?? undefined}
          />
        </div>
      )
    }

    const displayBinding = binding
      ? acceleratorToDisplayString(binding, __DARWIN__)
      : 'None'

    return (
      <div key={def.id} className="keybinding-row">
        <div className="keybinding-action-label">{def.label}</div>
        <div className="keybinding-context-badge">{def.context}</div>
        <div
          className={`keybinding-value ${hasOverride ? 'modified' : ''}`}
          onClick={() => this.startEditing(def.id)}
        >
          {displayBinding}
        </div>
        {hasOverride && (
          <button
            className="keybinding-reset-button"
            onClick={() => this.onResetBinding(def.id)}
            title="Reset to default"
          >
            ↺
          </button>
        )}
      </div>
    )
  }

  private getFilteredActions(category: ActionCategory): ActionDefinition[] {
    const filter = this.state.filter.toLowerCase()
    return DefaultActionDefinitions.filter(def => {
      if (def.category !== category) {
        return false
      }
      if (!filter) {
        return true
      }
      const binding = this.props.hotkeyStore.getEffectiveBinding(def.id)
      return (
        def.label.toLowerCase().includes(filter) ||
        def.id.toLowerCase().includes(filter) ||
        (binding && binding.toLowerCase().includes(filter))
      )
    })
  }

  private toggleCategory(category: ActionCategory) {
    const expanded = new Set(this.state.expandedCategories)
    if (expanded.has(category)) {
      expanded.delete(category)
    } else {
      expanded.add(category)
    }
    this.setState({ expandedCategories: expanded })
  }

  private startEditing(actionId: string) {
    this.setState({ editingActionId: actionId, conflictLabel: null })
  }

  private onCancelEdit = () => {
    this.setState({ editingActionId: null, conflictLabel: null })
  }

  private onBindingCaptured(actionId: string, binding: Keybinding | null) {
    const conflicts = this.props.hotkeyStore.setBinding(actionId, binding)
    if (conflicts.length > 0) {
      // Find the other conflicting action's label
      const otherActions = conflicts[0].actions.filter(id => id !== actionId)
      const otherDef = otherActions.length > 0
        ? ActionDefinitionMap.get(otherActions[0])
        : null
      if (otherDef) {
        this.setState({
          conflictLabel: otherDef.label,
          editingActionId: null,
        })
        return
      }
    }
    this.setState({ editingActionId: null, conflictLabel: null })
  }

  private onResetBinding(actionId: string) {
    this.props.hotkeyStore.resetBinding(actionId)
  }

  private onResetAll = () => {
    this.props.hotkeyStore.resetAll()
  }

  private onFilterChanged = (event: React.ChangeEvent<HTMLInputElement>) => {
    this.setState({ filter: event.target.value })
  }
}
