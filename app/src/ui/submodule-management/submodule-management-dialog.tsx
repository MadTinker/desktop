import * as React from 'react'

import { Repository } from '../../models/repository'
import { Dispatcher } from '../dispatcher'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  OkCancelButtonGroup,
} from '../dialog'
import { SubmodulePanel } from './submodule-panel'

interface ISubmoduleManagementProps {
  readonly repository: Repository
  readonly dispatcher: Dispatcher
  readonly onDismissed: () => void
}

/**
 * The submodule manager as a modal dialog.
 *
 * All of the behaviour lives in `SubmodulePanel`, which the repository view
 * also mounts inline as a side panel; this is just the dialog chrome around it.
 */
export class SubmoduleManagementDialog extends React.Component<ISubmoduleManagementProps> {
  public render() {
    return (
      <Dialog
        id="submodule-management"
        title="Submodule Manager"
        onDismissed={this.props.onDismissed}
        onSubmit={this.props.onDismissed}
      >
        <DialogContent>
          <SubmodulePanel
            repository={this.props.repository}
            dispatcher={this.props.dispatcher}
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
