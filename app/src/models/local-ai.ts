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
  /**
   * When false, only localhost/loopback HTTP endpoints are allowed; HTTPS is
   * always permitted. Defaults to true to preserve existing behaviour.
   */
  readonly allowNonLocalHttp: boolean
  /**
   * Strip newlines and truncate branch names / commit subjects before injecting
   * them into the AI prompt. Defaults to true (lossless — git forbids newlines
   * in these fields anyway).
   */
  readonly sanitizeGitContext: boolean
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
  allowNonLocalHttp: true,
  sanitizeGitContext: true,
}
