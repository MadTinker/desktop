import { spawn } from 'child_process'

const API_BASE = 'https://madnessinteractive.cc/api'

export interface RemoteHook {
  readonly id: string
  readonly name: string
  readonly trigger: string
  readonly script: string
  readonly enabled: boolean
  readonly createdAt?: string
}

export interface HooksFetchResult {
  readonly success: boolean
  readonly hooks: ReadonlyArray<RemoteHook>
  readonly error?: string
}

export interface HookPushResult {
  readonly success: boolean
  readonly id?: string
  readonly error?: string
}

export interface HookDeleteResult {
  readonly success: boolean
  readonly error?: string
}

export interface HookValidateResult {
  readonly isValid: boolean
  readonly error?: string
}

function authHeaders(apiKey: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  }
}

export async function fetchRemoteHooks(
  apiKey: string
): Promise<HooksFetchResult> {
  try {
    const res = await fetch(`${API_BASE}/automation/hooks`, {
      headers: authHeaders(apiKey),
    })
    if (!res.ok) {
      return { success: false, hooks: [], error: `HTTP ${res.status}` }
    }
    const json = await res.json()
    return {
      success: json.success ?? true,
      hooks: Array.isArray(json.hooks) ? json.hooks : [],
      error: json.message,
    }
  } catch (err) {
    return {
      success: false,
      hooks: [],
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

export async function pushRemoteHook(
  apiKey: string,
  hook: Omit<RemoteHook, 'createdAt'>
): Promise<HookPushResult> {
  try {
    const res = await fetch(`${API_BASE}/automation/hooks`, {
      method: 'POST',
      headers: authHeaders(apiKey),
      body: JSON.stringify(hook),
    })
    if (!res.ok) {
      return { success: false, error: `HTTP ${res.status}` }
    }
    const json = await res.json()
    return { success: json.success ?? true, id: json.id, error: json.message }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

export async function deleteRemoteHook(
  apiKey: string,
  id: string
): Promise<HookDeleteResult> {
  try {
    const res = await fetch(`${API_BASE}/automation/hooks/${id}`, {
      method: 'DELETE',
      headers: authHeaders(apiKey),
    })
    if (!res.ok) {
      return { success: false, error: `HTTP ${res.status}` }
    }
    const json = await res.json()
    return { success: json.success ?? true, error: json.message }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

export function validateHookScript(script: string): Promise<HookValidateResult> {
  return new Promise(resolve => {
    try {
      const child = spawn('bash', ['-n'], { stdio: ['pipe', 'ignore', 'pipe'] })
      const stderrChunks: Buffer[] = []

      child.stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk))

      child.on('close', (code: number | null) => {
        if (code === 0) {
          resolve({ isValid: true })
        } else {
          resolve({
            isValid: false,
            error: Buffer.concat(stderrChunks).toString('utf8').trim(),
          })
        }
      })

      child.on('error', (err: Error) => {
        resolve({ isValid: false, error: err.message })
      })

      child.stdin.write(script)
      child.stdin.end()
    } catch (err) {
      resolve({
        isValid: false,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  })
}
