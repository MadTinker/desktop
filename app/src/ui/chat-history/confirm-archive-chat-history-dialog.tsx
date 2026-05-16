import * as React from 'react'
import { Dialog, DialogContent, DialogFooter } from '../dialog'
import { OkCancelButtonGroup } from '../dialog/ok-cancel-button-group'
import { Dispatcher } from '../dispatcher'

interface IConfirmArchiveChatHistoryDialogProps {
  readonly candidates: ReadonlyArray<{
    repositoryName: string
    watchDir: string
    sourcePath: string
  }>
  readonly dispatcher: Dispatcher
  readonly onDismissed: () => void
}

export class ConfirmArchiveChatHistoryDialog extends React.Component<IConfirmArchiveChatHistoryDialogProps> {
  private onArchive = async () => {
    await this.props.dispatcher.archiveChatHistory()
    this.props.onDismissed()
  }

  public render() {
    const { candidates } = this.props

    return (
      <Dialog
        id="confirm-archive-chat-history"
        title="Archive Chat History"
        onSubmit={this.onArchive}
        onDismissed={this.props.onDismissed}
        type="normal"
      >
        <DialogContent>
          <p>
            Found {candidates.length} unarchived AI chat history{' '}
            {candidates.length === 1 ? 'directory' : 'directories'}:
          </p>
          <ul className="chat-history-candidate-list">
            {candidates.map((c, i) => (
              <li key={i}>
                <strong>{c.repositoryName}</strong> — {c.watchDir}
              </li>
            ))}
          </ul>
          <p>
            This will move the history to your central archive and create a
            symlink so your editor still finds it in the original location.
          </p>
        </DialogContent>
        <DialogFooter>
          <OkCancelButtonGroup
            okButtonText="Archive"
            cancelButtonText="Not Now"
          />
        </DialogFooter>
      </Dialog>
    )
  }
}
