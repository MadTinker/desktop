import * as React from 'react'

import { Repository } from '../../models/repository'
import { IRemote } from '../../models/remote'
import { RemoteAllowList } from '../../models/remote-policy'
import { IBranchesState } from '../../lib/app-state'
import { AheadBehindStore } from '../../lib/stores/ahead-behind-store'
import { Dispatcher } from '../dispatcher'
import { TabBar } from '../tab-bar'
import { TabBarType } from '../tab-bar-type'
import { RemotesList } from './remotes-list'
import { RemoteSyncMatrix } from './remote-sync-matrix'

interface IRemotesPanelProps {
  readonly repository: Repository
  readonly dispatcher: Dispatcher
  readonly remotes: ReadonlyArray<IRemote>
  readonly remotePolicies: ReadonlyMap<string, RemoteAllowList>
  readonly branchesState: IBranchesState
  readonly aheadBehindStore: AheadBehindStore
}

interface IRemotesPanelState {
  readonly activeTab: number
}

const TabIndex = {
  Remotes: 0,
  Sync: 1,
}

/**
 * The remotes list and the branch × remote sync matrix, with no surrounding
 * chrome of its own.
 *
 * Rendered both by `RemotesManagementDialog` and by the repository view's
 * slide-in side panel, so it owns no title bar, close button, or width —
 * whoever mounts it supplies those.
 */
export class RemotesPanel extends React.Component<
  IRemotesPanelProps,
  IRemotesPanelState
> {
  public constructor(props: IRemotesPanelProps) {
    super(props)
    this.state = { activeTab: TabIndex.Remotes }
  }

  public render() {
    const { remotes } = this.props
    const remoteCount = remotes.length > 0 ? ` (${remotes.length})` : ''

    return (
      <div className="remotes-panel">
        <TabBar
          selectedIndex={this.state.activeTab}
          onTabClicked={this.onTabChanged}
          type={TabBarType.Tabs}
        >
          <span>Remotes{remoteCount}</span>
          <span>Sync</span>
        </TabBar>

        <div className="remotes-panel-body">
          {this.state.activeTab === TabIndex.Remotes
            ? this.renderRemotesTab()
            : this.renderSyncTab()}
        </div>
      </div>
    )
  }

  private renderRemotesTab() {
    return (
      <RemotesList
        repository={this.props.repository}
        dispatcher={this.props.dispatcher}
        remotes={this.props.remotes}
      />
    )
  }

  private renderSyncTab() {
    return (
      <RemoteSyncMatrix
        repository={this.props.repository}
        dispatcher={this.props.dispatcher}
        remotes={this.props.remotes}
        remotePolicies={this.props.remotePolicies}
        branchesState={this.props.branchesState}
        aheadBehindStore={this.props.aheadBehindStore}
      />
    )
  }

  private onTabChanged = (index: number) => {
    this.setState({ activeTab: index })
  }
}
