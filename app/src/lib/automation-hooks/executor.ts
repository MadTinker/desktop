import { getAutomationHooks, type HookTrigger } from './store'
import { executeScript, type HookExecuteResult } from './remote'

export interface HookExecutionEvent {
  readonly hookId: string
  readonly hookName: string
  readonly trigger: HookTrigger
  readonly result: HookExecuteResult
}

type ExecutionListener = (event: HookExecutionEvent) => void

const listeners: ExecutionListener[] = []

export function onHookExecution(listener: ExecutionListener): () => void {
  listeners.push(listener)
  return () => {
    const idx = listeners.indexOf(listener)
    if (idx >= 0) {
      listeners.splice(idx, 1)
    }
  }
}

/**
 * Fire all enabled automation hooks matching the given trigger.
 * Returns results for each hook that ran. Hooks run sequentially
 * to avoid race conditions on shared resources.
 */
export async function fireAutomationHooks(
  trigger: HookTrigger,
  env?: Record<string, string>
): Promise<ReadonlyArray<HookExecutionEvent>> {
  const hooks = getAutomationHooks().filter(
    h => h.enabled && h.trigger === trigger
  )

  if (hooks.length === 0) {
    return []
  }

  const events: HookExecutionEvent[] = []

  for (const hook of hooks) {
    const result = await executeScript(hook.script, env)
    const event: HookExecutionEvent = {
      hookId: hook.id,
      hookName: hook.name,
      trigger,
      result,
    }
    events.push(event)
    for (const listener of listeners) {
      try {
        listener(event)
      } catch {
        // listener errors don't break execution chain
      }
    }
  }

  return events
}

/**
 * Execute a single hook by ID (for manual "Run" button).
 */
export async function executeHookById(
  hookId: string,
  env?: Record<string, string>
): Promise<HookExecutionEvent | null> {
  const hook = getAutomationHooks().find(h => h.id === hookId)
  if (!hook) {
    return null
  }

  const result = await executeScript(hook.script, env)
  const event: HookExecutionEvent = {
    hookId: hook.id,
    hookName: hook.name,
    trigger: hook.trigger,
    result,
  }

  for (const listener of listeners) {
    try {
      listener(event)
    } catch {
      // listener errors don't break execution
    }
  }

  return event
}
