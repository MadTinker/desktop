import * as React from 'react'

import { Repository } from '../../models/repository'
import { IRemote } from '../../models/remote'
import { RemoteAllowList } from '../../models/remote-policy'
import { IBranchesState } from '../../lib/app-state'
import { AheadBehindStore } from '../../lib/stores/ahead-behind-store'
import { Dispatcher } from '../dispatcher'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  OkCancelButtonGroup,
} from '../dialog'
import { RemotesPanel } from './remotes-panel'

interface IRemotesManagementProps {
  readonly repository: Repository
  readonly dispatcher: Dispatcher
  readonly remotes: ReadonlyArray<IRemote>
  readonly remotePolicies: ReadonlyMap<string, RemoteAllowList>
  readonly branchesState: IBranchesState
  readonly aheadBehindStore: AheadBehindStore
  readonly onDismissed: () => void
}

/**
 * The remotes manager as a modal dialog.
 *
 * All of the behaviour lives in `RemotesPanel`, which the repository view also
 * mounts inline as a side panel; this is just the dialog chrome around it, and
 * the room the sync matrix wants when a repository has several remotes.
 */
export class RemotesManagementDialog extends React.Component<IRemotesManagementProps> {
  public render() {
    return (
      <Dialog
        id="remotes-management"
        title="Remotes"
        onDismissed={this.props.onDismissed}
        onSubmit={this.props.onDismissed}
      >
        <DialogContent>
          <RemotesPanel
            repository={this.props.repository}
            dispatcher={this.props.dispatcher}
            remotes={this.props.remotes}
            remotePolicies={this.props.remotePolicies}
            branchesState={this.props.branchesState}
            aheadBehindStore={this.props.aheadBehindStore}
          />
        </DialogContent>
        <DialogFooter>
          <OkCancelButtonGroup
            okButtonText="Close"
            cancelButtonVisible={false}
            onOkButtonClick={this.props.onDismissed}
          />
        </DialogFooter>
      </Dialog>
    )
  }
}
