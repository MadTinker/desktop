import * as React from 'react'

import { Repository } from '../../models/repository'
import { SubmoduleEntry, SubmoduleEntryStatus } from '../../models/submodule'
import { listSubmodules } from '../../lib/git'
import { Dispatcher } from '../dispatcher'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  OkCancelButtonGroup,
} from '../dialog'
import { TabBar } from '../tab-bar'
import { TabBarType } from '../tab-bar-type'
import { Button } from '../lib/button'
import { Octicon } from '../octicons'
import * as octicons from '../octicons/octicons.generated'
import { syncClockwise } from '../octicons'

interface ISubmoduleManagementProps {
  readonly repository: Repository
  readonly dispatcher: Dispatcher
  readonly onDismissed: () => void
}

interface ISubmoduleManagementState {
  readonly submodules: ReadonlyArray<SubmoduleEntry>
  readonly loading: boolean
  readonly activeTab: number
  readonly foreachCommand: string
  readonly foreachRecursive: boolean
  readonly foreachOutput: string | null
  readonly foreachRunning: boolean
}

const TabIndex = {
  Submodules: 0,
  Foreach: 1,
}

export class SubmoduleManagementDialog extends React.Component<
  ISubmoduleManagementProps,
  ISubmoduleManagementState
> {
  public constructor(props: ISubmoduleManagementProps) {
    super(props)
    this.state = {
      submodules: [],
      loading: true,
      activeTab: TabIndex.Submodules,
      foreachCommand: '',
      foreachRecursive: true,
      foreachOutput: null,
      foreachRunning: false,
    }
  }

  public async componentDidMount() {
    await this.loadSubmodules()
  }

  private async loadSubmodules() {
    this.setState({ loading: true })
    const submodules = await listSubmodules(this.props.repository)
    this.setState({ submodules, loading: false })
  }

  private onTabChanged = (index: number) => {
    this.setState({ activeTab: index })
  }

  private onForeachCommandChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    this.setState({ foreachCommand: e.currentTarget.value })
  }

  private onForeachRecursiveChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    this.setState({ foreachRecursive: e.currentTarget.checked })
  }

  private onRunForeach = async () => {
    const { foreachCommand, foreachRecursive } = this.state
    if (!foreachCommand.trim()) return

    this.setState({ foreachRunning: true, foreachOutput: null })
    const output = await this.props.dispatcher.foreachSubmodule(
      this.props.repository,
      foreachCommand.trim(),
      foreachRecursive
    )
    this.setState({ foreachRunning: false, foreachOutput: output })
  }

  private onForeachKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      this.onRunForeach()
    }
  }

  private onInitSubmodule = async (submodulePath: string) => {
    await this.props.dispatcher.initSubmodule(
      this.props.repository,
      submodulePath
    )
    await this.loadSubmodules()
  }

  private onSyncSubmodule = async (submodulePath: string) => {
    await this.props.dispatcher.syncSubmodule(
      this.props.repository,
      submodulePath
    )
    await this.loadSubmodules()
  }

  private onPullSubmodule = async (submodulePath: string) => {
    await this.props.dispatcher.pullSubmodule(
      this.props.repository,
      submodulePath
    )
    await this.loadSubmodules()
  }

  private onPushSubmodule = async (submodulePath: string) => {
    await this.props.dispatcher.pushSubmodule(
      this.props.repository,
      submodulePath
    )
    await this.loadSubmodules()
  }

  private onRollbackSubmodule = async (submodulePath: string) => {
    await this.props.dispatcher.rollbackSubmodule(
      this.props.repository,
      submodulePath
    )
    await this.loadSubmodules()
  }

  private onInitAll = () => {
    this.props.dispatcher.initAllSubmodules(this.props.repository)
  }

  private onPullAll = () => {
    this.props.dispatcher.pullAllSubmodules(this.props.repository)
  }

  private onPushAll = () => {
    this.props.dispatcher.pushAllSubmodules(this.props.repository)
  }

  private renderStatusBadge(status: SubmoduleEntryStatus) {
    const labels: Record<SubmoduleEntryStatus, string> = {
      initialized: 'ok',
      uninitialized: 'uninit',
      modified: 'modified',
      conflict: 'conflict',
    }
    return (
      <span className={`submodule-badge ${status}`}>{labels[status]}</span>
    )
  }

  private renderSubmoduleRow(submodule: SubmoduleEntry) {
    const { path, status } = submodule
    const isUninitialized = status === 'uninitialized'
    const isModified = status === 'modified'

    return (
      <li key={path} className="submodule-row">
        {this.renderStatusBadge(status)}
        <span className="submodule-path" title={path}>
          {path}
        </span>
        <div className="submodule-actions">
          {isUninitialized && (
            <Button onClick={() => this.onInitSubmodule(path)}>Init</Button>
          )}
          {!isUninitialized && (
            <>
              <Button onClick={() => this.onSyncSubmodule(path)}>Sync</Button>
              <Button onClick={() => this.onPullSubmodule(path)}>Pull</Button>
              <Button onClick={() => this.onPushSubmodule(path)}>Push</Button>
            </>
          )}
          {isModified && (
            <Button onClick={() => this.onRollbackSubmodule(path)}>
              Rollback
            </Button>
          )}
        </div>
      </li>
    )
  }

  private renderSubmodulesTab() {
    const { submodules, loading } = this.state

    if (loading) {
      return (
        <DialogContent>
          <div className="submodule-loading">
            <Octicon symbol={syncClockwise} className="spin" />
            Loading submodules…
          </div>
        </DialogContent>
      )
    }

    if (submodules.length === 0) {
      return (
        <DialogContent>
          <p className="submodule-empty">
            No submodules found in this repository.
          </p>
        </DialogContent>
      )
    }

    const uninitCount = submodules.filter(
      s => s.status === 'uninitialized'
    ).length

    return (
      <>
        <DialogContent>
          <ul className="submodule-list">
            {submodules.map(s => this.renderSubmoduleRow(s))}
          </ul>
        </DialogContent>
        <DialogFooter>
          <div className="submodule-bulk-actions">
            {uninitCount > 0 && (
              <Button onClick={this.onInitAll}>
                Init {uninitCount} uninit
              </Button>
            )}
            <Button onClick={this.onPullAll}>Pull All</Button>
            <Button onClick={this.onPushAll}>Push All</Button>
          </div>
          <OkCancelButtonGroup
            okButtonText="Close"
            cancelButtonVisible={false}
            onOkButtonClick={this.props.onDismissed}
          />
        </DialogFooter>
      </>
    )
  }

  private renderForeachTab() {
    const { foreachCommand, foreachRecursive, foreachOutput, foreachRunning } =
      this.state

    return (
      <>
        <DialogContent>
          <p className="submodule-foreach-description">
            Run a shell command inside every submodule.
          </p>
          <div className="submodule-foreach-form">
            <input
              className="submodule-foreach-input"
              type="text"
              placeholder="git status --short"
              value={foreachCommand}
              onChange={this.onForeachCommandChange}
              onKeyDown={this.onForeachKeyDown}
              disabled={foreachRunning}
            />
            <label className="submodule-foreach-recursive">
              <input
                type="checkbox"
                checked={foreachRecursive}
                onChange={this.onForeachRecursiveChange}
                disabled={foreachRunning}
              />
              Recursive
            </label>
            <Button
              onClick={this.onRunForeach}
              disabled={foreachRunning || !foreachCommand.trim()}
            >
              {foreachRunning ? (
                <>
                  <Octicon symbol={syncClockwise} className="spin" /> Running…
                </>
              ) : (
                <>
                  <Octicon symbol={octicons.play} /> Run
                </>
              )}
            </Button>
          </div>
          {foreachOutput !== null && (
            <textarea
              className="submodule-foreach-output"
              readOnly={true}
              value={foreachOutput}
            />
          )}
        </DialogContent>
        <DialogFooter>
          <OkCancelButtonGroup
            okButtonText="Close"
            cancelButtonVisible={false}
            onOkButtonClick={this.props.onDismissed}
          />
        </DialogFooter>
      </>
    )
  }

  public render() {
    const { submodules, loading, activeTab } = this.state
    const submoduleCount = loading ? '' : ` (${submodules.length})`

    return (
      <Dialog
        id="submodule-management"
        title="Submodule Manager"
        onDismissed={this.props.onDismissed}
        onSubmit={this.props.onDismissed}
      >
        <TabBar
          selectedIndex={activeTab}
          onTabClicked={this.onTabChanged}
          type={TabBarType.Tabs}
        >
          <span>Submodules{submoduleCount}</span>
          <span>Foreach</span>
        </TabBar>

        {activeTab === TabIndex.Submodules
          ? this.renderSubmodulesTab()
          : this.renderForeachTab()}
      </Dialog>
    )
  }
}
