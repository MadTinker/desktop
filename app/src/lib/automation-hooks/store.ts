const STORAGE_KEY = 'madness-automation-hooks'

export type HookTrigger =
  | 'pre-commit'
  | 'post-commit'
  | 'session-start'
  | 'session-close'
  | 'todo-created'
  | 'manual'

export interface AutomationHook {
  readonly id: string
  readonly name: string
  readonly trigger: HookTrigger
  readonly script: string
  readonly enabled: boolean
  readonly createdAt: string
}

export const HOOK_TRIGGERS: ReadonlyArray<{ id: HookTrigger; label: string }> =
  [
    { id: 'pre-commit', label: 'Pre-Commit' },
    { id: 'post-commit', label: 'Post-Commit' },
    { id: 'session-start', label: 'AI Session Start' },
    { id: 'session-close', label: 'AI Session Close' },
    { id: 'todo-created', label: 'Todo Created' },
    { id: 'manual', label: 'Manual Execution' },
  ]

export function getAutomationHooks(): ReadonlyArray<AutomationHook> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return []
    }
    return JSON.parse(raw) as AutomationHook[]
  } catch {
    return []
  }
}

export function saveAutomationHook(
  hook: Omit<AutomationHook, 'id' | 'createdAt'> & { id?: string }
): AutomationHook {
  const hooks = [...getAutomationHooks()]
  const now = new Date().toISOString()

  if (hook.id) {
    const index = hooks.findIndex(h => h.id === hook.id)
    const updated: AutomationHook = {
      ...(hooks[index] ?? {}),
      ...hook,
      id: hook.id,
      createdAt: hooks[index]?.createdAt ?? now,
    }
    if (index >= 0) {
      hooks[index] = updated
    } else {
      hooks.push(updated)
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(hooks))
    return updated
  } else {
    const newHook: AutomationHook = {
      ...hook,
      id: crypto.randomUUID(),
      createdAt: now,
    }
    hooks.push(newHook)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(hooks))
    return newHook
  }
}

export function deleteAutomationHook(id: string): void {
  const hooks = getAutomationHooks().filter(h => h.id !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(hooks))
}

export function toggleAutomationHook(id: string, enabled: boolean): void {
  const hooks = getAutomationHooks().map(h =>
    h.id === id ? { ...h, enabled } : h
  )
  localStorage.setItem(STORAGE_KEY, JSON.stringify(hooks))
}
