import * as React from 'react'
import { DialogContent } from '../dialog'
import { TextBox } from '../lib/text-box'
import { Button } from '../lib/button'
import {
  ILocalAIConfig,
  LocalAIProvider,
  DefaultLocalAIConfigs,
} from '../../models/local-ai'
import { testLocalAIConnection } from '../../lib/local-ai-commit-message'
import { Checkbox, CheckboxValue } from '../lib/checkbox'

interface ILocalAIPreferencesProps {
  readonly config: ILocalAIConfig
  readonly onConfigChanged: (config: ILocalAIConfig) => void
}

type TestStatus =
  | { kind: 'idle' }
  | { kind: 'testing' }
  | { kind: 'success'; models: ReadonlyArray<string> }
  | { kind: 'error'; message: string }

interface ILocalAIPreferencesState {
  readonly testStatus: TestStatus
}

export class LocalAIPreferences extends React.Component<
  ILocalAIPreferencesProps,
  ILocalAIPreferencesState
> {
  public constructor(props: ILocalAIPreferencesProps) {
    super(props)
    this.state = { testStatus: { kind: 'idle' } }
  }

  private onEnabledChanged = (e: React.FormEvent<HTMLInputElement>) => {
    this.props.onConfigChanged({
      ...this.props.config,
      enabled: (e.currentTarget as HTMLInputElement).checked,
    })
  }

  private onProviderChanged = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const provider = e.currentTarget.value as LocalAIProvider
    const defaults = DefaultLocalAIConfigs[provider]
    this.props.onConfigChanged({
      ...this.props.config,
      provider,
      baseUrl: defaults.baseUrl ?? this.props.config.baseUrl,
      modelId: defaults.modelId ?? this.props.config.modelId,
    })
    this.setState({ testStatus: { kind: 'idle' } })
  }

  private onBaseUrlChanged = (value: string) => {
    this.props.onConfigChanged({ ...this.props.config, baseUrl: value })
    this.setState({ testStatus: { kind: 'idle' } })
  }

  private onModelIdChanged = (value: string) => {
    this.props.onConfigChanged({ ...this.props.config, modelId: value })
  }

  private onTestConnection = async () => {
    this.setState({ testStatus: { kind: 'testing' } })
    try {
      const models = await testLocalAIConnection(this.props.config.baseUrl)
      this.setState({
        testStatus: { kind: 'success', models },
      })
    } catch (e) {
      this.setState({
        testStatus: {
          kind: 'error',
          message: e instanceof Error ? e.message : 'Connection failed',
        },
      })
    }
  }

  private renderTestStatus() {
    const { testStatus } = this.state
    if (testStatus.kind === 'idle') {
      return null
    }
    if (testStatus.kind === 'testing') {
      return (
        <p className="local-ai-test-status local-ai-test-working">
          Testing connection…
        </p>
      )
    }
    if (testStatus.kind === 'success') {
      const modelList =
        testStatus.models.length > 0
          ? testStatus.models.join(', ')
          : 'none loaded'
      return (
        <p className="local-ai-test-status local-ai-test-ok">
          ✓ Connected — models: {modelList}
        </p>
      )
    }
    return (
      <p className="local-ai-test-status local-ai-test-error">
        ✗ {testStatus.message}
      </p>
    )
  }

  public render() {
    const { config } = this.props
    const { testStatus } = this.state
    const testing = testStatus.kind === 'testing'

    return (
      <DialogContent>
        <div className="local-ai-preferences-section">
          <h2>Local AI</h2>
          <p className="git-settings-description">
            Generate commit messages using a locally running model via Ollama or
            LM Studio. The model needs to be running before you can use this
            feature.
          </p>

          <Checkbox
            label="Enable local AI commit message generation"
            value={config.enabled ? CheckboxValue.On : CheckboxValue.Off}
            onChange={this.onEnabledChanged}
          />


          <div className="local-ai-field-row">
            <label htmlFor="local-ai-provider">Provider</label>
            <select
              id="local-ai-provider"
              value={config.provider}
              onChange={this.onProviderChanged}
              disabled={!config.enabled}
            >
              <option value="lmstudio">LM Studio</option>
              <option value="ollama">Ollama</option>
              <option value="custom">Custom</option>
            </select>
          </div>

          <TextBox
            label="Base URL"
            value={config.baseUrl}
            onValueChanged={this.onBaseUrlChanged}
            placeholder="http://localhost:1234"
            disabled={!config.enabled}
          />

          <TextBox
            label="Model ID"
            value={config.modelId}
            onValueChanged={this.onModelIdChanged}
            placeholder="local-model"
            disabled={!config.enabled}
          />

          <div className="local-ai-test-row">
            <Button
              onClick={this.onTestConnection}
              disabled={testing || !config.enabled || !config.baseUrl.trim()}
            >
              {testing ? 'Testing…' : 'Test Connection'}
            </Button>
            {this.renderTestStatus()}
          </div>

          <p className="git-settings-description">
            Uses the OpenAI-compatible <code>/v1/chat/completions</code>{' '}
            endpoint. Works with LM Studio (port 1234) and Ollama (port 11434).
          </p>
        </div>
      </DialogContent>
    )
  }
}
