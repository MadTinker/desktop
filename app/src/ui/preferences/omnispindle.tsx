import * as React from 'react'
import { DialogContent } from '../dialog'
import { TextBox } from '../lib/text-box'

interface IOmnispindlePreferencesProps {
  readonly apiKey: string
  readonly onApiKeyChanged: (value: string) => void
}

export class OmnispindlePreferences extends React.Component<IOmnispindlePreferencesProps> {
  public render() {
    return (
      <DialogContent>
        <div className="omnispindle-preferences-section">
          <h2>Omnispindle</h2>
          <p className="git-settings-description">
            Connect to your Omnispindle MCP server to display active todos in
            the Changes sidebar. Use the refresh button in the sidebar to fetch
            the latest todos.
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
        </div>
      </DialogContent>
    )
  }

  private onApiKeyChanged = (value: string) => {
    this.props.onApiKeyChanged(value)
  }
}
