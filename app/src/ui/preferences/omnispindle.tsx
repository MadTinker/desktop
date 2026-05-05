import * as React from 'react'
import { DialogContent } from '../dialog'
import { TextBox } from '../lib/text-box'

interface IOmnispindlePreferencesProps {
  readonly apiKey: string
  readonly onApiKeyChanged: (value: string) => void
  readonly pollInterval: number
  readonly onPollIntervalChanged: (value: number) => void
}

export class OmnispindlePreferences extends React.Component<IOmnispindlePreferencesProps> {
  public render() {
    const intervalSec = Math.round(this.props.pollInterval / 1000)

    return (
      <DialogContent>
        <div className="omnispindle-preferences-section">
          <h2>Omnispindle</h2>
          <p className="git-settings-description">
            Connect to your Omnispindle MCP server to display active todos in
            the Changes sidebar.
          </p>

          <TextBox
            label="API Key"
            value={this.props.apiKey}
            onValueChanged={this.onApiKeyChanged}
            placeholder="Bearer token for Omnispindle endpoint"
            type="password"
          />
          <p className="git-settings-description">
            The bearer token used to authenticate with the Omnispindle HTTP MCP
            endpoint.
          </p>

          <TextBox
            label="Poll interval (seconds)"
            value={String(intervalSec)}
            onValueChanged={this.onPollIntervalChanged}
            placeholder="60"
          />
          <p className="git-settings-description">
            How often to fetch active todos from the server. Default is 60
            seconds.
          </p>
        </div>
      </DialogContent>
    )
  }

  private onApiKeyChanged = (value: string) => {
    this.props.onApiKeyChanged(value)
  }

  private onPollIntervalChanged = (value: string) => {
    const parsed = parseInt(value, 10)
    if (!isNaN(parsed) && parsed > 0) {
      this.props.onPollIntervalChanged(parsed * 1000)
    }
  }
}
