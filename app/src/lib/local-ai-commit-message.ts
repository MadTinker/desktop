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

export type { ILocalAIConfig, LocalAIPromptMode } from '../models/local-ai'

const ConventionalCommitsSystemPrompt = `
You're an AI assistant that generates commit messages in Conventional Commits format.

Format: <type>[optional scope]: <description>

Types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert

The subject line must be no longer than 50 characters.
The optional body should explain WHY the change was made, not what changed.

Your response must be a JSON object with the attributes "title" and "description"
where "title" is the subject line and "description" is the optional body.
`

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
 * Build the system prompt and user prompt for commit message generation.
 * Shared by both streaming and non-streaming paths.
 */
function buildCommitPrompts(
  diff: string,
  config: ILocalAIConfig,
  context: ILocalAICommitContext
): { systemPrompt: string; userPrompt: string } {
  const tags = generateCommitMessagePromptTags()
  let systemPrompt: string
  switch (config.promptMode) {
    case 'conventional':
      systemPrompt = ConventionalCommitsSystemPrompt
      break
    case 'custom':
      systemPrompt =
        config.customSystemPrompt || buildCommitMessageSystemPrompt(false, tags)
      break
    default:
      systemPrompt = buildCommitMessageSystemPrompt(false, tags)
      break
  }
  const contextPrefix = buildContextPrefix(context, config.sanitizeGitContext)
  const userPrompt = contextPrefix + buildCommitMessageUserPrompt(diff, tags)
  return { systemPrompt, userPrompt }
}

/** Validate and resolve the endpoint URL. Throws on invalid or disallowed URLs. */
function resolveEndpoint(config: ILocalAIConfig): string {
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

  return `${baseUrl}/v1/chat/completions`
}

/** Format a connection error with a user-friendly provider label. */
function formatConnectionError(config: ILocalAIConfig, e: Error): Error {
  if (e.name === 'AbortError') {
    return new Error(
      `Local AI request timed out after ${config.timeoutMs / 1000}s`
    )
  }
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
    return new Error(
      `Could not reach ${providerLabel} at ${config.baseUrl} — is it running?`
    )
  }
  return e
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
  const { systemPrompt, userPrompt } = buildCommitPrompts(diff, config, context)
  const endpoint = resolveEndpoint(config)

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
      throw formatConnectionError(config, e)
    }
    throw e
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Try to extract title and description from a partial JSON string that is
 * still being streamed. Handles escaped quotes within JSON string values.
 */
export function tryExtractPartialCommitMessage(
  accumulated: string
): { title: string | null; description: string | null } {
  // Strip markdown code fences if present
  const stripped =
    accumulated.replace(/^```(?:json)?\s*/m, '').replace(/```\s*$/, '')

  // Extract title — look for "title": "..." with escaped quote support
  const titleMatch = stripped.match(
    /"title"\s*:\s*"((?:[^"\\]|\\.)*)(?:"|$)/
  )
  // Extract description — same pattern
  const descMatch = stripped.match(
    /"description"\s*:\s*"((?:[^"\\]|\\.)*)(?:"|$)/
  )

  return {
    title: titleMatch ? unescape(titleMatch[1]) : null,
    description: descMatch ? unescape(descMatch[1]) : null,
  }
}

/** Unescape JSON string escape sequences. */
function unescape(s: string): string {
  return s
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\')
}

/**
 * Streaming callback. Called with progressive partial results as tokens arrive.
 * `done` is true on the final call with the complete parsed message.
 */
export interface IStreamProgress {
  title: string
  description: string
  done: boolean
}

/**
 * Streaming variant of generateLocalAICommitMessage. Calls onProgress as
 * tokens arrive so the UI can show the message assembling in real time.
 *
 * Falls back to non-streaming if the response body is not streamable.
 */
export async function streamLocalAICommitMessage(
  diff: string,
  config: ILocalAIConfig,
  context: ILocalAICommitContext,
  onProgress: (progress: IStreamProgress) => void
): Promise<{ title: string; description: string }> {
  const { systemPrompt, userPrompt } = buildCommitPrompts(diff, config, context)
  const endpoint = resolveEndpoint(config)

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
        stream: true,
      }),
    })

    if (!response.ok) {
      throw new Error(
        `Local AI returned HTTP ${response.status}: ${await response.text().catch(() => '')}`
      )
    }

    // Fallback: if body isn't streamable, parse as non-streaming response
    if (!response.body) {
      const json = await response.json()
      const content: string | undefined = json?.choices?.[0]?.message?.content
      if (!content) {
        throw new Error('Local AI returned an empty response')
      }
      const result = parseCopilotCommitMessage(content)
      onProgress({ title: result.title, description: result.description, done: true })
      return result
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let accumulated = ''
    let buffer = ''

    for (;;) {
      const { done, value } = await reader.read()
      if (done) {
        break
      }

      buffer += decoder.decode(value, { stream: true })

      // Process complete SSE lines
      const lines = buffer.split('\n')
      // Keep the last potentially incomplete line in the buffer
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith(':')) {
          continue
        }

        if (trimmed === 'data: [DONE]') {
          continue
        }

        if (trimmed.startsWith('data: ')) {
          const jsonStr = trimmed.slice(6)
          try {
            const chunk = JSON.parse(jsonStr)
            const token: string | undefined =
              chunk?.choices?.[0]?.delta?.content
            if (token) {
              accumulated += token
              const partial = tryExtractPartialCommitMessage(accumulated)
              onProgress({
                title: partial.title ?? '',
                description: partial.description ?? '',
                done: false,
              })
            }
          } catch {
            // Skip malformed SSE chunks
          }
        }
      }
    }

    if (!accumulated) {
      throw new Error('Local AI returned an empty response')
    }

    // Final parse for correctness
    const result = parseCopilotCommitMessage(accumulated)
    onProgress({
      title: result.title,
      description: result.description,
      done: true,
    })
    return result
  } catch (e) {
    if (e instanceof Error) {
      throw formatConnectionError(config, e)
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
