import * as React from 'react'
import { DialogContent } from '../dialog'
import { TextBox } from '../lib/text-box'
import { Checkbox, CheckboxValue } from '../lib/checkbox'
import { IChatHistoryArchiveConfig } from '../../models/chat-history-archive'

interface IChatHistoryArchivePreferencesProps {
  readonly config: IChatHistoryArchiveConfig
  readonly onConfigChanged: (config: IChatHistoryArchiveConfig) => void
}

export class ChatHistoryArchivePreferences extends React.Component<IChatHistoryArchivePreferencesProps> {
  private onEnabledChanged = (e: React.FormEvent<HTMLInputElement>) => {
    this.props.onConfigChanged({
      ...this.props.config,
      enabled: (e.currentTarget as HTMLInputElement).checked,
    })
  }

  private onArchivePathChanged = (value: string) => {
    this.props.onConfigChanged({
      ...this.props.config,
      archivePath: value,
    })
  }

  private onWatchDirsChanged = (value: string) => {
    const watchDirs = value
      .split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0)
    this.props.onConfigChanged({
      ...this.props.config,
      watchDirs,
    })
  }

  private onAutoCommitChanged = (e: React.FormEvent<HTMLInputElement>) => {
    const autoCommit = (e.currentTarget as HTMLInputElement).checked
    this.props.onConfigChanged({
      ...this.props.config,
      autoCommit,
      autoPush: autoCommit ? this.props.config.autoPush : false,
    })
  }

  private onAutoPushChanged = (e: React.FormEvent<HTMLInputElement>) => {
    this.props.onConfigChanged({
      ...this.props.config,
      autoPush: (e.currentTarget as HTMLInputElement).checked,
    })
  }

  public render() {
    const { config } = this.props
    const disabled = !config.enabled

    return (
      <DialogContent>
        <div className="chat-history-archive-preferences-section">
          <h2>Chat History Archive</h2>
          <p className="git-settings-description">
            Automatically detect and centralize AI conversation history from
            tracked repositories.
          </p>

          <Checkbox
            label="Enable background chat history archiving"
            value={config.enabled ? CheckboxValue.On : CheckboxValue.Off}
            onChange={this.onEnabledChanged}
          />

          <TextBox
            label="Archive Path"
            value={config.archivePath}
            onValueChanged={this.onArchivePathChanged}
            placeholder="/path/to/archive/repo"
            disabled={disabled}
          />

          <TextBox
            label="Watch Directories"
            value={config.watchDirs.join(', ')}
            onValueChanged={this.onWatchDirsChanged}
            placeholder=".specstory/history, .claude"
            disabled={disabled}
          />

          <Checkbox
            label="Auto-commit after archiving"
            value={config.autoCommit ? CheckboxValue.On : CheckboxValue.Off}
            onChange={this.onAutoCommitChanged}
            disabled={disabled}
          />

          <Checkbox
            label="Auto-push after commit"
            value={config.autoPush ? CheckboxValue.On : CheckboxValue.Off}
            onChange={this.onAutoPushChanged}
            disabled={disabled || !config.autoCommit}
          />
        </div>
      </DialogContent>
    )
  }
}
