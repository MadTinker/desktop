/**
 * Configuration for local AI model providers (Ollama, LM Studio).
 * Persisted to localStorage under LocalAIConfigKey.
 */

export type LocalAIProvider = 'ollama' | 'lmstudio' | 'custom'

export interface ILocalAIConfig {
  readonly enabled: boolean
  readonly provider: LocalAIProvider
  readonly baseUrl: string
  readonly modelId: string
  readonly timeoutMs: number
}

export const LocalAIConfigKey = 'local-ai-config'

export const DefaultLocalAIConfigs: Record<
  LocalAIProvider,
  Partial<ILocalAIConfig>
> = {
  ollama: { baseUrl: 'http://localhost:11434', modelId: 'llama3' },
  lmstudio: { baseUrl: 'http://localhost:1234', modelId: 'local-model' },
  custom: { baseUrl: 'http://localhost:8080', modelId: '' },
}

export const DefaultLocalAIConfig: ILocalAIConfig = {
  enabled: false,
  provider: 'lmstudio',
  baseUrl: 'http://localhost:1234',
  modelId: 'local-model',
  timeoutMs: 60000,
}
