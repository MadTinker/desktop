import * as React from 'react'

import { Repository } from '../../models/repository'
import { IRemote } from '../../models/remote'
import { getRemoteHost, getRemoteHostLabel } from '../../lib/remote-host'
import { Dispatcher } from '../dispatcher'
import { Button } from '../lib/button'
import { RefNameTextBox } from '../lib/ref-name-text-box'
import { TextBox } from '../lib/text-box'
import { TooltippedContent } from '../lib/tooltipped-content'

interface IRemotesListProps {
  readonly repository: Repository
  readonly dispatcher: Dispatcher
  readonly remotes: ReadonlyArray<IRemote>
}

interface IRemotesListState {
  /** The remote whose URL is being edited, if any. */
  readonly editing: string | null
  readonly editedUrl: string
  readonly addingRemote: boolean
  readonly newName: string
  readonly newUrl: string
}

/**
 * Every remote the repository is configured with, and the means to change
 * them.
 *
 * Until now the only remote surface in the app was a single text box for the
 * primary remote's URL, so a repository living on two hosts had no way to say
 * so from inside Madness Desktop.
 */
export class RemotesList extends React.Component<
  IRemotesListProps,
  IRemotesListState
> {
  public constructor(props: IRemotesListProps) {
    super(props)
    this.state = {
      editing: null,
      editedUrl: '',
      addingRemote: false,
      newName: '',
      newUrl: '',
    }
  }

  public render() {
    return (
      <>
        {this.props.remotes.length === 0 ? (
          <p className="remotes-empty">
            This repository has no remotes configured.
          </p>
        ) : (
          <ul className="remotes-list">
            {this.props.remotes.map(remote => this.renderRemote(remote))}
          </ul>
        )}
        {this.renderAddRemote()}
      </>
    )
  }

  private renderRemote(remote: IRemote) {
    const host = getRemoteHost(remote.url)
    const isEditing = this.state.editing === remote.name

    return (
      <li key={remote.name} className="remote-row">
        <div className="remote-row-header">
          <span className={`remote-badge ${host}`}>
            {getRemoteHostLabel(host)}
          </span>
          <TooltippedContent
            className="remote-name"
            tooltip={remote.name}
            onlyWhenOverflowed={true}
          >
            {remote.name}
          </TooltippedContent>
        </div>

        {isEditing ? (
          <div className="remote-edit">
            <TextBox
              value={this.state.editedUrl}
              onValueChanged={this.onEditedUrlChanged}
              placeholder="Remote URL"
              ariaLabel={`URL for ${remote.name}`}
            />
            <div className="remote-actions">
              <Button onClick={this.onSaveUrl(remote.name)}>Save</Button>
              <Button onClick={this.onCancelEdit}>Cancel</Button>
            </div>
          </div>
        ) : (
          <>
            <TooltippedContent
              className="remote-url"
              tooltip={remote.url}
              onlyWhenOverflowed={true}
            >
              {remote.url}
            </TooltippedContent>
            <div className="remote-actions">
              <Button onClick={this.onStartEdit(remote)}>Edit URL</Button>
              <Button onClick={this.onRemove(remote.name)}>Remove</Button>
            </div>
          </>
        )}
      </li>
    )
  }

  private renderAddRemote() {
    if (!this.state.addingRemote) {
      return (
        <div className="remotes-add">
          <Button onClick={this.onStartAdd}>Add remote…</Button>
        </div>
      )
    }

    const canAdd =
      this.state.newName.trim().length > 0 &&
      this.state.newUrl.trim().length > 0 &&
      !this.props.remotes.some(r => r.name === this.state.newName.trim())

    return (
      <div className="remotes-add">
        <RefNameTextBox
          label="Name"
          initialValue={this.state.newName}
          onValueChange={this.onNewNameChanged}
        />
        <TextBox
          label="URL"
          value={this.state.newUrl}
          onValueChanged={this.onNewUrlChanged}
          placeholder="https://…  or  git@…"
        />
        <div className="remote-actions">
          <Button disabled={!canAdd} onClick={this.onAdd}>
            Add
          </Button>
          <Button onClick={this.onCancelAdd}>Cancel</Button>
        </div>
      </div>
    )
  }

  private onStartEdit = (remote: IRemote) => () => {
    this.setState({ editing: remote.name, editedUrl: remote.url })
  }

  private onCancelEdit = () => {
    this.setState({ editing: null, editedUrl: '' })
  }

  private onEditedUrlChanged = (editedUrl: string) => {
    this.setState({ editedUrl })
  }

  private onSaveUrl = (name: string) => async () => {
    const url = this.state.editedUrl.trim()

    if (url.length === 0) {
      return
    }

    await this.props.dispatcher.setRemoteURL(this.props.repository, name, url)
    this.setState({ editing: null, editedUrl: '' })
  }

  private onRemove = (name: string) => async () => {
    await this.props.dispatcher.removeRemote(this.props.repository, name)
  }

  private onStartAdd = () => {
    this.setState({ addingRemote: true, newName: '', newUrl: '' })
  }

  private onCancelAdd = () => {
    this.setState({ addingRemote: false, newName: '', newUrl: '' })
  }

  private onNewNameChanged = (newName: string) => {
    this.setState({ newName })
  }

  private onNewUrlChanged = (newUrl: string) => {
    this.setState({ newUrl })
  }

  private onAdd = async () => {
    const name = this.state.newName.trim()
    const url = this.state.newUrl.trim()

    if (name.length === 0 || url.length === 0) {
      return
    }

    await this.props.dispatcher.addRemote(this.props.repository, name, url)
    this.setState({ addingRemote: false, newName: '', newUrl: '' })
  }
}
