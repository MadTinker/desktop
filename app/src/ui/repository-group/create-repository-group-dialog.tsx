import * as React from 'react'

import { Dispatcher } from '../dispatcher'
import { Repository } from '../../models/repository'
import { Dialog, DialogContent, DialogFooter } from '../dialog'
import { OkCancelButtonGroup } from '../dialog/ok-cancel-button-group'
import { TextBox } from '../lib/text-box'

interface ICreateRepositoryGroupProps {
  readonly dispatcher: Dispatcher
  readonly onDismissed: () => void
  readonly repository?: Repository
}

interface ICreateRepositoryGroupState {
  readonly groupName: string
}

export class CreateRepositoryGroupDialog extends React.Component<
  ICreateRepositoryGroupProps,
  ICreateRepositoryGroupState
> {
  public constructor(props: ICreateRepositoryGroupProps) {
    super(props)
    this.state = { groupName: '' }
  }

  public render() {
    return (
      <Dialog
        id="create-repository-group"
        title={__DARWIN__ ? 'New Repository Group' : 'New repository group'}
        ariaDescribedBy="create-repository-group-description"
        onDismissed={this.props.onDismissed}
        onSubmit={this.onSubmit}
      >
        <DialogContent>
          <p id="create-repository-group-description">
            Enter a name for the new group.
          </p>
          <TextBox
            ariaLabel="Group name"
            value={this.state.groupName}
            onValueChanged={this.onNameChanged}
            placeholder="Group name"
            autoFocus={true}
          />
        </DialogContent>

        <DialogFooter>
          <OkCancelButtonGroup
            okButtonText={__DARWIN__ ? 'Create Group' : 'Create group'}
            okButtonDisabled={this.state.groupName.trim().length === 0}
          />
        </DialogFooter>
      </Dialog>
    )
  }

  private onNameChanged = (groupName: string) => {
    this.setState({ groupName })
  }

  private onSubmit = () => {
    const name = this.state.groupName.trim()
    if (name.length === 0) {
      return
    }

    const groupId = this.props.dispatcher.createCustomGroup(name)

    if (this.props.repository !== undefined) {
      this.props.dispatcher.addRepositoryToGroup(
        this.props.repository.id,
        groupId
      )
    }

    this.props.onDismissed()
  }
}
