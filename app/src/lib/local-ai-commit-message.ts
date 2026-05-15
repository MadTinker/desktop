import {
  buildCommitMessageSystemPrompt,
  buildCommitMessageUserPrompt,
  generateCommitMessagePromptTags,
} from './stores/copilot-store'
import { parseCopilotCommitMessage } from './copilot-commit-message'
import {
  ILocalAIConfig,
  LocalAIConfigKey,
  DefaultLocalAIConfig,
} from '../models/local-ai'

export type { ILocalAIConfig }

export function loadLocalAIConfig(): ILocalAIConfig {
  try {
    const raw = localStorage.getItem(LocalAIConfigKey)
    if (!raw) return DefaultLocalAIConfig
    return { ...DefaultLocalAIConfig, ...JSON.parse(raw) }
  } catch {
    return DefaultLocalAIConfig
  }
}

export function saveLocalAIConfig(config: ILocalAIConfig): void {
  localStorage.setItem(LocalAIConfigKey, JSON.stringify(config))
}

/**
 * Call a local OpenAI-compatible API (Ollama or LM Studio) to generate
 * a commit message from a git diff.
 *
 * Returns the parsed { title, description } or throws on error.
 */
export async function generateLocalAICommitMessage(
  diff: string,
  config: ILocalAIConfig
): Promise<{ title: string; description: string }> {
  const tags = generateCommitMessagePromptTags()
  const systemPrompt = buildCommitMessageSystemPrompt(false, tags)
  const userPrompt = buildCommitMessageUserPrompt(diff, tags)

  // Both Ollama (/v1/chat/completions) and LM Studio (/v1/chat/completions)
  // follow the OpenAI Chat Completions spec.
  const baseUrl = config.baseUrl.replace(/\/$/, '')
  const endpoint = `${baseUrl}/v1/chat/completions`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), config.timeoutMs)

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: config.modelId,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        stream: false,
      }),
    })

    if (!response.ok) {
      throw new Error(
        `Local AI returned HTTP ${response.status}: ${await response.text().catch(() => '')}`
      )
    }

    const json = await response.json()
    const content: string | undefined = json?.choices?.[0]?.message?.content
    if (!content) {
      throw new Error('Local AI returned an empty response')
    }

    return parseCopilotCommitMessage(content)
  } catch (e) {
    if (e instanceof Error) {
      if (e.name === 'AbortError') {
        throw new Error(
          `Local AI request timed out after ${config.timeoutMs / 1000}s`
        )
      }
      // connection refused / network error
      if (
        e.message.includes('Failed to fetch') ||
        e.message.includes('fetch') ||
        e.message.includes('ECONNREFUSED')
      ) {
        const providerLabel =
          config.provider === 'lmstudio'
            ? 'LM Studio'
            : config.provider === 'ollama'
              ? 'Ollama'
              : 'local AI'
        throw new Error(
          `Could not reach ${providerLabel} at ${config.baseUrl} — is it running?`
        )
      }
    }
    throw e
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Test the connection to a local AI provider by listing available models.
 * Returns a list of model IDs or throws on failure.
 */
export async function testLocalAIConnection(
  baseUrl: string
): Promise<ReadonlyArray<string>> {
  const url = `${baseUrl.replace(/\/$/, '')}/v1/models`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 5000)
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
    })
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    const json = await response.json()
    // OpenAI-compatible list: { data: [{ id: '...' }] }
    const models: string[] = (json?.data ?? []).map(
      (m: { id: string }) => m.id
    )
    return models
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error('Connection timed out (5s)')
    }
    throw e
  } finally {
    clearTimeout(timer)
  }
}
