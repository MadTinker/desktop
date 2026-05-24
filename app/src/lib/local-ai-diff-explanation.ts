import { ILocalAIConfig } from '../models/local-ai'
import { isLocalBaseUrl } from './copilot/byok'

const ExplainDiffSystemPrompt = `You are a code review assistant. Given a unified git diff, explain what changed and why it matters.

Rules:
- Start with a one-sentence summary of the overall change
- List key modifications as bullet points
- Note potential impacts or concerns if any
- Be concise — aim for 3-8 bullet points
- Use plain language a teammate would understand
- Do NOT wrap your response in markdown code fences
- Respond in plain text with bullet points (use - for bullets)`

/**
 * Call a local OpenAI-compatible API to generate a human-readable
 * explanation of a git diff.
 *
 * Reuses the same provider infrastructure as commit message generation.
 */
export async function generateLocalAIDiffExplanation(
  diffText: string,
  fileName: string,
  config: ILocalAIConfig
): Promise<string> {
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
  const userPrompt = `Explain the changes in this diff for the file "${fileName}":\n\n${diffText}`

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
          { role: 'system', content: ExplainDiffSystemPrompt },
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

    return content.trim()
  } catch (e) {
    if (e instanceof Error) {
      if (e.name === 'AbortError') {
        throw new Error(
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
