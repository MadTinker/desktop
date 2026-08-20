import * as React from 'react'

import { Repository } from '../../models/repository'
import { IRemote } from '../../models/remote'
import {
  RemoteAllowList,
  isReservedRemoteName,
} from '../../models/remote-policy'
import { Dispatcher } from '../dispatcher'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  OkCancelButtonGroup,
} from '../dialog'
import { Checkbox, CheckboxValue } from '../lib/checkbox'
import { Ref } from '../lib/ref'
import { Row } from '../lib/row'

interface IBranchRemotePolicyDialogProps {
  readonly repository: Repository
  readonly dispatcher: Dispatcher
  readonly branchName: string
  readonly remotes: ReadonlyArray<IRemote>
  readonly currentPolicy: RemoteAllowList
  /**
   * Set when the dialog is standing between the user and a push. Called with
   * the chosen policy, or null if they backed out.
   */
  readonly resolve?: (allowed: RemoteAllowList | null) => void
  readonly onDismissed: () => void
}

interface IBranchRemotePolicyDialogState {
  /** Names of the remotes currently ticked. */
  readonly selected: ReadonlySet<string>
  /** Whether "local only" is chosen, which overrides the tick boxes. */
  readonly localOnly: boolean
}

function initialSelection(
  allowed: RemoteAllowList,
  remotes: ReadonlyArray<IRemote>
): IBranchRemotePolicyDialogState {
  switch (allowed.kind) {
    case 'none':
      return { selected: new Set(), localOnly: true }
    case 'all':
      return { selected: new Set(remotes.map(r => r.name)), localOnly: false }
    case 'only':
      return { selected: new Set(allowed.remotes), localOnly: false }
    case 'unset':
      // Nothing ticked, so the user has to make an actual choice rather than
      // accepting a default that happens to be permissive.
      return { selected: new Set(), localOnly: false }
  }
}

/**
 * Asks which remotes a branch may be pushed to.
 *
 * Raised on the first push of a branch with no recorded policy, and reachable
 * afterwards from the branch context menu.
 */
export class BranchRemotePolicyDialog extends React.Component<
  IBranchRemotePolicyDialogProps,
  IBranchRemotePolicyDialogState
> {
  /**
   * Whether the caller has already been told what happened. Dismissing the
   * dialog must resolve a blocked push one way or the other, and it must not
   * resolve twice.
   */
  private resolved = false

  public constructor(props: IBranchRemotePolicyDialogProps) {
    super(props)
    this.state = initialSelection(props.currentPolicy, props.remotes)
  }

  public render() {
    const { branchName, remotes } = this.props
    const blockingAPush = this.props.resolve !== undefined

    return (
      <Dialog
        id="branch-remote-policy"
        title="Where can this branch be pushed?"
        onDismissed={this.onDismissed}
        onSubmit={this.onSave}
      >
        <DialogContent>
          <Row>
            <p>
              Choose which remotes <Ref>{branchName}</Ref> may be pushed to.
              {blockingAPush
                ? ' This is asked once, on the first push of a branch.'
                : null}
            </p>
          </Row>

          <Row>
            <Checkbox
              label="Local only — never push this branch anywhere"
              value={
                this.state.localOnly ? CheckboxValue.On : CheckboxValue.Off
              }
              onChange={this.onLocalOnlyChanged}
            />
          </Row>

          {remotes.length === 0 ? (
            <Row>
              <p className="branch-remote-policy-empty">
                This repository has no remotes configured.
              </p>
            </Row>
          ) : (
            remotes.map(remote => this.renderRemote(remote))
          )}

          <Row>
            <p className="branch-remote-policy-note">
              The policy is stored in this repository's own configuration, so it
              applies to pushes made from the command line too.
            </p>
          </Row>
        </DialogContent>

        <DialogFooter>
          <OkCancelButtonGroup
            okButtonText={blockingAPush ? 'Save and push' : 'Save'}
            okButtonDisabled={!this.canSave()}
            onCancelButtonClick={this.onDismissed}
          />
        </DialogFooter>
      </Dialog>
    )
  }

  private renderRemote(remote: IRemote) {
    // A remote named "all" or "none" can't be stored unambiguously alongside
    // the reserved words, so it can't take part in a policy.
    const reserved = isReservedRemoteName(remote.name)
    const disabled = this.state.localOnly || reserved

    return (
      <Row key={remote.name}>
        <Checkbox
          label={
            <span className="branch-remote-policy-remote">
              <Ref>{remote.name}</Ref>
              <span className="branch-remote-policy-url">{remote.url}</span>
              {reserved ? (
                <span className="branch-remote-policy-warning">
                  Cannot be locked to — the name collides with a reserved value.
                </span>
              ) : null}
            </span>
          }
          value={
            this.state.selected.has(remote.name) && !disabled
              ? CheckboxValue.On
              : CheckboxValue.Off
          }
          disabled={disabled}
          onChange={this.onRemoteChanged(remote.name)}
        />
      </Row>
    )
  }

  /**
   * "Nothing ticked and not local-only" is not a decision, so saving it is
   * disallowed — otherwise the branch would silently end up blocked.
   */
  private canSave(): boolean {
    return this.state.localOnly || this.state.selected.size > 0
  }

  private onLocalOnlyChanged = (event: React.FormEvent<HTMLInputElement>) => {
    this.setState({ localOnly: event.currentTarget.checked })
  }

  private onRemoteChanged =
    (remoteName: string) => (event: React.FormEvent<HTMLInputElement>) => {
      const selected = new Set(this.state.selected)

      if (event.currentTarget.checked) {
        selected.add(remoteName)
      } else {
        selected.delete(remoteName)
      }

      this.setState({ selected })
    }

  private buildPolicy(): RemoteAllowList {
    if (this.state.localOnly) {
      return { kind: 'none' }
    }

    const selected = this.props.remotes
      .map(r => r.name)
      .filter(name => this.state.selected.has(name))

    // Every remote ticked means "all", which keeps working when a remote is
    // added later rather than freezing today's list.
    return selected.length === this.props.remotes.length &&
      this.props.remotes.length > 0
      ? { kind: 'all' }
      : { kind: 'only', remotes: selected }
  }

  private onSave = async () => {
    if (!this.canSave()) {
      return
    }

    const allowed = this.buildPolicy()

    if (this.props.resolve === undefined) {
      await this.props.dispatcher.setBranchRemotePolicy(
        this.props.repository,
        this.props.branchName,
        allowed
      )
    } else {
      // The push is waiting on this; it persists the policy itself so it can
      // act on the answer immediately.
      this.resolved = true
      this.props.resolve(allowed)
    }

    this.props.onDismissed()
  }

  private onDismissed = () => {
    if (this.props.resolve !== undefined && !this.resolved) {
      this.resolved = true
      this.props.resolve(null)
    }

    this.props.onDismissed()
  }
}
