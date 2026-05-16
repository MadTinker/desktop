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
import { isLocalBaseUrl } from './copilot/byok'

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

export interface ILocalAICommitContext {
  /** Current branch name, e.g. "feat/my-feature" */
  readonly branchName?: string
  /** Last N commit subjects, most recent first */
  readonly recentCommits?: ReadonlyArray<string>
}

/** Strip newlines and truncate a git string (branch name or commit subject). */
function sanitizeGitString(s: string, maxLen = 200): string {
  return s.replace(/[\r\n]/g, ' ').slice(0, maxLen)
}

/**
 * Builds additional context to prepend to the user prompt when branch name
 * or recent commit history is available. Helps the model match team conventions.
 */
function buildContextPrefix(
  context: ILocalAICommitContext,
  sanitize: boolean
): string {
  const parts: string[] = []

  if (context.branchName) {
    const name = sanitize
      ? sanitizeGitString(context.branchName, 100)
      : context.branchName
    parts.push(`Current branch: ${name}`)
  }

  if (context.recentCommits && context.recentCommits.length > 0) {
    const subjects = sanitize
      ? context.recentCommits.map(s => sanitizeGitString(s))
      : context.recentCommits
    parts.push(
      `Recent commits (for style reference):\n${subjects
        .map(s => `  - ${s}`)
        .join('\n')}`
    )
  }

  return parts.length > 0 ? parts.join('\n') + '\n\n' : ''
}

/**
 * Call a local OpenAI-compatible API (Ollama or LM Studio) to generate
 * a commit message from a git diff.
 *
 * Returns the parsed { title, description } or throws on error.
 */
export async function generateLocalAICommitMessage(
  diff: string,
  config: ILocalAIConfig,
  context: ILocalAICommitContext = {}
): Promise<{ title: string; description: string }> {
  const tags = generateCommitMessagePromptTags()
  const systemPrompt = buildCommitMessageSystemPrompt(false, tags)
  const contextPrefix = buildContextPrefix(context, config.sanitizeGitContext)
  const userPrompt = contextPrefix + buildCommitMessageUserPrompt(diff, tags)

  // Both Ollama (/v1/chat/completions) and LM Studio (/v1/chat/completions)
  // follow the OpenAI Chat Completions spec.
  const baseUrl = config.baseUrl.replace(/\/$/, '')

  if (!config.allowNonLocalHttp) {
    let parsedUrl: URL
    try {
      parsedUrl = new URL(baseUrl)
    } catch {
      throw new Error(`Invalid local AI base URL: ${config.baseUrl}`)
    }
    if (parsedUrl.protocol === 'http:' && !isLocalBaseUrl(baseUrl)) {
      throw new Error(
        `Non-local HTTP endpoints are disabled. Use HTTPS or enable "Allow non-local HTTP" in Local AI preferences.`
      )
    }
  }

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
  baseUrl: string,
  allowNonLocalHttp = true
): Promise<ReadonlyArray<string>> {
  const cleanBase = baseUrl.replace(/\/$/, '')

  if (!allowNonLocalHttp) {
    let parsedUrl: URL
    try {
      parsedUrl = new URL(cleanBase)
    } catch {
      throw new Error(`Invalid local AI base URL: ${baseUrl}`)
    }
    if (parsedUrl.protocol === 'http:' && !isLocalBaseUrl(cleanBase)) {
      throw new Error(
        `Non-local HTTP endpoints are disabled. Use HTTPS or enable "Allow non-local HTTP" in Local AI preferences.`
      )
    }
  }

  const url = `${cleanBase}/v1/models`
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
