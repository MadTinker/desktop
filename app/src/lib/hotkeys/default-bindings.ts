import { ActionDefinition } from './hotkey-types'

/**
 * All bindable actions with their default keybindings.
 * Menu actions have their accelerators extracted from build-default-menu.ts.
 * Non-menu actions are available for user binding but unbound by default.
 */
export const DefaultActionDefinitions: ReadonlyArray<ActionDefinition> = [
  // ─── File Menu ───────────────────────────────────────────────────────────────

  {
    id: 'create-repository',
    label: 'New Repository',
    category: 'file',
    context: 'global',
    defaultBinding: 'CmdOrCtrl+N',
    isMenuAction: true,
  },
  {
    id: 'add-local-repository',
    label: 'Add Local Repository',
    category: 'file',
    context: 'global',
    defaultBinding: 'CmdOrCtrl+O',
    isMenuAction: true,
  },
  {
    id: 'clone-repository',
    label: 'Clone Repository',
    category: 'file',
    context: 'global',
    defaultBinding: 'CmdOrCtrl+Shift+O',
    isMenuAction: true,
  },
  {
    id: 'show-preferences',
    label: 'Settings',
    category: 'file',
    context: 'global',
    defaultBinding: 'CmdOrCtrl+,',
    isMenuAction: true,
  },

  // ─── Edit Menu ───────────────────────────────────────────────────────────────

  {
    id: 'select-all',
    label: 'Select All',
    category: 'edit',
    context: 'global',
    defaultBinding: 'CmdOrCtrl+A',
    isMenuAction: true,
  },
  {
    id: 'find-text',
    label: 'Find',
    category: 'edit',
    context: 'global',
    defaultBinding: 'CmdOrCtrl+F',
    isMenuAction: true,
  },

  // ─── View Menu ───────────────────────────────────────────────────────────────

  {
    id: 'show-changes',
    label: 'Show Changes',
    category: 'view',
    context: 'repository',
    defaultBinding: 'CmdOrCtrl+1',
    isMenuAction: true,
  },
  {
    id: 'show-history',
    label: 'Show History',
    category: 'view',
    context: 'repository',
    defaultBinding: 'CmdOrCtrl+2',
    isMenuAction: true,
  },
  {
    id: 'choose-repository',
    label: 'Show Repository List',
    category: 'view',
    context: 'global',
    defaultBinding: 'CmdOrCtrl+T',
    isMenuAction: true,
  },
  {
    id: 'show-branches',
    label: 'Show Branches List',
    category: 'view',
    context: 'repository',
    defaultBinding: 'CmdOrCtrl+B',
    isMenuAction: true,
  },
  {
    id: 'go-to-commit-message',
    label: 'Go to Summary',
    category: 'view',
    context: 'changes-tab',
    defaultBinding: 'CmdOrCtrl+G',
    isMenuAction: true,
  },
  {
    id: 'show-stashed-changes',
    label: 'Show Stashed Changes',
    category: 'view',
    context: 'repository',
    defaultBinding: 'Ctrl+H',
    isMenuAction: true,
  },
  {
    id: 'hide-stashed-changes',
    label: 'Hide Stashed Changes',
    category: 'view',
    context: 'repository',
    defaultBinding: 'Ctrl+H',
    isMenuAction: true,
  },
  {
    id: 'toggle-changes-filter',
    label: 'Toggle Changes Filter',
    category: 'view',
    context: 'changes-tab',
    defaultBinding: 'CmdOrCtrl+L',
    isMenuAction: true,
  },
  {
    id: 'increase-active-resizable-width',
    label: 'Expand Active Resizable',
    category: 'view',
    context: 'global',
    defaultBinding: 'CmdOrCtrl+9',
    isMenuAction: true,
  },
  {
    id: 'decrease-active-resizable-width',
    label: 'Contract Active Resizable',
    category: 'view',
    context: 'global',
    defaultBinding: 'CmdOrCtrl+8',
    isMenuAction: true,
  },

  // ─── Repository Menu ─────────────────────────────────────────────────────────

  {
    id: 'push',
    label: 'Push',
    category: 'repository',
    context: 'repository',
    defaultBinding: 'CmdOrCtrl+P',
    isMenuAction: true,
  },
  {
    id: 'force-push',
    label: 'Force Push',
    category: 'repository',
    context: 'repository',
    defaultBinding: null,
    isMenuAction: true,
  },
  {
    id: 'pull',
    label: 'Pull',
    category: 'repository',
    context: 'repository',
    defaultBinding: 'CmdOrCtrl+Shift+P',
    isMenuAction: true,
  },
  {
    id: 'fetch',
    label: 'Fetch',
    category: 'repository',
    context: 'repository',
    defaultBinding: 'CmdOrCtrl+Shift+T',
    isMenuAction: true,
  },
  {
    id: 'remove-repository',
    label: 'Remove Repository',
    category: 'repository',
    context: 'repository',
    defaultBinding: 'CmdOrCtrl+Backspace',
    isMenuAction: true,
  },
  {
    id: 'view-repository-on-github',
    label: 'View on GitHub',
    category: 'repository',
    context: 'repository',
    defaultBinding: 'CmdOrCtrl+Shift+G',
    isMenuAction: true,
  },
  {
    id: 'open-in-shell',
    label: 'Open in Shell',
    category: 'repository',
    context: 'repository',
    defaultBinding: 'Ctrl+`',
    isMenuAction: true,
  },
  {
    id: 'open-working-directory',
    label: 'Show in File Manager',
    category: 'repository',
    context: 'repository',
    defaultBinding: 'CmdOrCtrl+Shift+F',
    isMenuAction: true,
  },
  {
    id: 'open-external-editor',
    label: 'Open in External Editor',
    category: 'repository',
    context: 'repository',
    defaultBinding: 'CmdOrCtrl+Shift+A',
    isMenuAction: true,
  },
  {
    id: 'open-with-external-editor',
    label: 'Open With External Editor',
    category: 'repository',
    context: 'repository',
    defaultBinding: 'CmdOrCtrl+Shift+Alt+A',
    isMenuAction: true,
  },
  {
    id: 'create-issue-in-repository-on-github',
    label: 'Create Issue on GitHub',
    category: 'repository',
    context: 'repository',
    defaultBinding: 'CmdOrCtrl+I',
    isMenuAction: true,
  },
  {
    id: 'show-repository-settings',
    label: 'Repository Settings',
    category: 'repository',
    context: 'repository',
    defaultBinding: null,
    isMenuAction: true,
  },

  // ─── Branch Menu ─────────────────────────────────────────────────────────────

  {
    id: 'create-branch',
    label: 'New Branch',
    category: 'branch',
    context: 'repository',
    defaultBinding: 'CmdOrCtrl+Shift+N',
    isMenuAction: true,
  },
  {
    id: 'rename-branch',
    label: 'Rename Branch',
    category: 'branch',
    context: 'repository',
    defaultBinding: 'CmdOrCtrl+Shift+R',
    isMenuAction: true,
  },
  {
    id: 'delete-branch',
    label: 'Delete Branch',
    category: 'branch',
    context: 'repository',
    defaultBinding: 'CmdOrCtrl+Shift+D',
    isMenuAction: true,
  },
  {
    id: 'discard-all-changes',
    label: 'Discard All Changes',
    category: 'branch',
    context: 'changes-tab',
    defaultBinding: 'CmdOrCtrl+Shift+Backspace',
    isMenuAction: true,
  },
  {
    id: 'stash-all-changes',
    label: 'Stash All Changes',
    category: 'branch',
    context: 'changes-tab',
    defaultBinding: 'CmdOrCtrl+Shift+S',
    isMenuAction: true,
  },
  {
    id: 'update-branch-with-contribution-target-branch',
    label: 'Update from Default Branch',
    category: 'branch',
    context: 'repository',
    defaultBinding: 'CmdOrCtrl+Shift+U',
    isMenuAction: true,
  },
  {
    id: 'compare-to-branch',
    label: 'Compare to Branch',
    category: 'branch',
    context: 'repository',
    defaultBinding: 'CmdOrCtrl+Shift+B',
    isMenuAction: true,
  },
  {
    id: 'merge-branch',
    label: 'Merge into Current Branch',
    category: 'branch',
    context: 'repository',
    defaultBinding: 'CmdOrCtrl+Shift+M',
    isMenuAction: true,
  },
  {
    id: 'squash-and-merge-branch',
    label: 'Squash and Merge',
    category: 'branch',
    context: 'repository',
    defaultBinding: 'CmdOrCtrl+Shift+H',
    isMenuAction: true,
  },
  {
    id: 'rebase-branch',
    label: 'Rebase Current Branch',
    category: 'branch',
    context: 'repository',
    defaultBinding: 'CmdOrCtrl+Shift+E',
    isMenuAction: true,
  },
  {
    id: 'compare-on-github',
    label: 'Compare on GitHub',
    category: 'branch',
    context: 'repository',
    defaultBinding: 'CmdOrCtrl+Shift+C',
    isMenuAction: true,
  },
  {
    id: 'branch-on-github',
    label: 'View Branch on GitHub',
    category: 'branch',
    context: 'repository',
    defaultBinding: 'CmdOrCtrl+Alt+B',
    isMenuAction: true,
  },
  {
    id: 'preview-pull-request',
    label: 'Preview Pull Request',
    category: 'branch',
    context: 'repository',
    defaultBinding: 'CmdOrCtrl+Alt+P',
    isMenuAction: true,
  },
  {
    id: 'open-pull-request',
    label: 'Create / View Pull Request',
    category: 'branch',
    context: 'repository',
    defaultBinding: 'CmdOrCtrl+R',
    isMenuAction: true,
  },

  // ─── Non-Menu Dispatcher Actions (unbound by default) ────────────────────────

  // Commit
  {
    id: 'commit',
    label: 'Commit Changes',
    category: 'commit',
    context: 'changes-tab',
    defaultBinding: null,
    isMenuAction: false,
  },
  {
    id: 'undo-commit',
    label: 'Undo Last Commit',
    category: 'commit',
    context: 'changes-tab',
    defaultBinding: null,
    isMenuAction: false,
  },
  {
    id: 'amend-last-commit',
    label: 'Amend Last Commit',
    category: 'commit',
    context: 'changes-tab',
    defaultBinding: null,
    isMenuAction: false,
  },

  // Navigation
  {
    id: 'toggle-sidebar',
    label: 'Toggle Sidebar',
    category: 'navigation',
    context: 'global',
    defaultBinding: null,
    isMenuAction: false,
  },
  {
    id: 'focus-commit-message',
    label: 'Focus Commit Message',
    category: 'navigation',
    context: 'changes-tab',
    defaultBinding: null,
    isMenuAction: false,
  },

  // Misc
  {
    id: 'show-about',
    label: 'About',
    category: 'misc',
    context: 'global',
    defaultBinding: null,
    isMenuAction: true,
  },
  {
    id: 'install-darwin-cli',
    label: 'Install CLI Tool',
    category: 'misc',
    context: 'global',
    defaultBinding: null,
    isMenuAction: true,
  },
]

/**
 * Index of action definitions by ID for fast lookup.
 */
export const ActionDefinitionMap: ReadonlyMap<string, ActionDefinition> =
  new Map(DefaultActionDefinitions.map(def => [def.id, def]))
