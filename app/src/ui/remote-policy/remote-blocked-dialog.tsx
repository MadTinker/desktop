import * as React from 'react'

import { Repository } from '../../models/repository'
import {
  RemoteAllowList,
  describeRemoteAllowList,
} from '../../models/remote-policy'
import { Dispatcher } from '../dispatcher'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  OkCancelButtonGroup,
} from '../dialog'
import { Ref } from '../lib/ref'
import { Row } from '../lib/row'

interface IRemoteBlockedDialogProps {
  readonly repository: Repository
  readonly dispatcher: Dispatcher
  readonly branchName: string
  readonly remoteName: string
  readonly allowed: RemoteAllowList
  readonly onDismissed: () => void
}

/**
 * Explains a push that was refused by the branch's remote policy.
 *
 * Deliberately offers no way to push anyway — the whole point of the lock is
 * that it isn't one distracted click from being bypassed. Changing the policy
 * is a separate, explicit action.
 */
export class RemoteBlockedDialog extends React.Component<IRemoteBlockedDialogProps> {
  public render() {
    const { branchName, remoteName, allowed } = this.props

    return (
      <Dialog
        id="remote-blocked"
        type="error"
        title="Push blocked by branch policy"
        onDismissed={this.props.onDismissed}
        onSubmit={this.props.onDismissed}
      >
        <DialogContent>
          <Row>
            <p>
              <Ref>{branchName}</Ref> is not allowed to be pushed to{' '}
              <Ref>{remoteName}</Ref>.
            </p>
          </Row>
          <Row>
            <p>
              Current policy:{' '}
              <strong>{describeRemoteAllowList(allowed)}</strong>
            </p>
          </Row>
        </DialogContent>

        <DialogFooter>
          <OkCancelButtonGroup
            okButtonText="Change policy…"
            cancelButtonText="Close"
            onOkButtonClick={this.onChangePolicy}
            onCancelButtonClick={this.props.onDismissed}
          />
        </DialogFooter>
      </Dialog>
    )
  }

  private onChangePolicy = () => {
    this.props.onDismissed()
    this.props.dispatcher.showBranchRemotePolicy(
      this.props.repository,
      this.props.branchName
    )
  }
}
