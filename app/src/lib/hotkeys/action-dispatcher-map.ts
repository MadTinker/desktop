import { Dispatcher } from '../../ui/dispatcher'
import { Repository } from '../../models/repository'
import { ActionID } from './hotkey-types'
import { FoldoutType } from '../../lib/app-state'
import { PopupType } from '../../models/popup'

/**
 * Maps non-menu action IDs to their dispatcher invocations.
 * Returns true if the action was handled, false otherwise.
 *
 * Actions that require complex parameters (specific commits, branches, etc.)
 * open the relevant dialog instead of executing directly.
 */
export function dispatchHotkeyAction(
  actionId: ActionID,
  dispatcher: Dispatcher,
  getRepository: () => Repository | null
): boolean {
  const repo = getRepository()

  switch (actionId) {
    // ─── Commit & Changes ──────────────────────────────────────────────────────
    case 'commit-included-changes':
      // Focus commit message to prompt user to submit
      dispatcher.setCommitMessageFocus(true)
      return true
    case 'start-amending-repository':
      // Amend requires the last commit — complex, skip direct invoke
      return false
    case 'stop-amending-repository':
      if (repo) dispatcher.stopAmendingRepository(repo)
      return true
    case 'discard-changes':
      // Discard all — delegates to menu event which shows confirmation
      return false
    case 'change-include-all-files':
      if (repo) dispatcher.changeIncludeAllFiles(repo, true)
      return true
    case 'generate-commit-message':
      if (repo) dispatcher.generateCommitMessage(repo, [])
      return true
    case 'generate-local-ai-commit-message':
      if (repo) dispatcher.generateLocalAICommitMessage(repo, [])
      return true
    case 'create-stash-for-current-branch':
      if (repo) dispatcher.createStashForCurrentBranch(repo)
      return true
    case 'pop-stash':
      // Needs stash entry — can't invoke directly without selection
      return false
    case 'drop-stash':
      return false

    // ─── Branch Operations ─────────────────────────────────────────────────────
    case 'checkout-branch':
      dispatcher.showFoldout({ type: FoldoutType.Branch })
      return true
    case 'delete-local-branch':
      // Needs current branch — show branches foldout
      dispatcher.showFoldout({ type: FoldoutType.Branch })
      return true
    case 'delete-remote-branch':
      dispatcher.showFoldout({ type: FoldoutType.Branch })
      return true
    case 'start-rebase':
    case 'show-rebase-dialog':
      if (repo) dispatcher.showRebaseDialog(repo)
      return true
    case 'abort-rebase':
      if (repo) dispatcher.abortRebase(repo)
      return true
    case 'continue-rebase':
      // Needs conflict state — can't invoke directly
      return false
    case 'cherry-pick':
      return false // needs commit selection
    case 'abort-cherry-pick':
      if (repo) dispatcher.abortCherryPick(repo, null)
      return true
    case 'continue-cherry-pick':
      return false // needs conflict state
    case 'squash':
    case 'reorder-commits':
    case 'reset-to-commit':
    case 'revert-commit':
      // All need commit selection — can't invoke without context
      return false

    // ─── Repository Operations ─────────────────────────────────────────────────
    case 'publish-repository':
      // Opens publish dialog
      if (repo) dispatcher.showPopup({ type: PopupType.PublishRepository, repository: repo })
      return true
    case 'refresh-repository':
      if (repo) dispatcher.refreshRepository(repo)
      return true
    case 'create-tag':
    case 'show-create-tag-dialog':
      // Needs target commit SHA — open with HEAD
      if (repo) dispatcher.showPopup({ type: PopupType.CreateTag, repository: repo, targetCommitSha: '', localTags: null } as any)
      return true
    case 'delete-tag':
    case 'show-delete-tag-dialog':
      // Needs tag name — can't invoke directly
      return false
    case 'toggle-favorite-repository':
      if (repo) dispatcher.toggleFavoriteRepository(repo.id)
      return true
    case 'relocate-repository':
      if (repo) dispatcher.relocateRepository(repo)
      return true
    case 'open-shell-here':
      if (repo) dispatcher.openShell(repo.path)
      return true
    case 'open-in-external-editor':
      if (repo) dispatcher.openInExternalEditor(repo.path)
      return true

    // ─── Pull Requests ─────────────────────────────────────────────────────────
    case 'create-pull-request':
      if (repo) dispatcher.createPullRequest(repo)
      return true
    case 'show-pull-request':
      if (repo) dispatcher.showPullRequest(repo)
      return true
    case 'checkout-pull-request':
      return false // needs PR selection
    case 'start-pull-request':
      if (repo) dispatcher.startPullRequest(repo)
      return true
    case 'refresh-pull-requests':
      if (repo) dispatcher.refreshPullRequests(repo)
      return true

    // ─── Submodules ────────────────────────────────────────────────────────────
    case 'init-all-submodules':
      if (repo) dispatcher.initAllSubmodules(repo)
      return true
    case 'sync-submodule':
      return false // needs specific submodule
    case 'pull-all-submodules':
      if (repo) dispatcher.pullAllSubmodules(repo)
      return true
    case 'push-all-submodules':
      if (repo) dispatcher.pushAllSubmodules(repo)
      return true
    case 'show-submodule-management':
      if (repo) dispatcher.showSubmoduleManagement(repo)
      return true

    // ─── Navigation ────────────────────────────────────────────────────────────
    case 'close-popup':
      dispatcher.closePopup()
      return true
    case 'close-foldout':
      dispatcher.closeCurrentFoldout()
      return true
    case 'load-next-commit-batch':
      if (repo) dispatcher.loadNextCommitBatch(repo)
      return true
    case 'focus-commit-message':
      dispatcher.setCommitMessageFocus(true)
      return true
    case 'toggle-sidebar':
      return false // no direct dispatcher method

    // ─── Misc ──────────────────────────────────────────────────────────────────
    case 'edit-global-git-config':
      dispatcher.editGlobalGitConfig()
      return true

    default:
      return false
  }
}
