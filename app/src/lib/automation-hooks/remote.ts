import { invokeProxy } from '../../ui/main-process-proxy'
import type {
  HooksFetchResult,
  HookPushResult,
  HookDeleteResult,
  HookValidateResult,
  HookExecuteResult,
  RemoteHook,
} from '../../main-process/automation-hooks-sync'

export type { HooksFetchResult, HookPushResult, HookDeleteResult, HookValidateResult, HookExecuteResult, RemoteHook }

const fetchHooksIpc = invokeProxy('automation-hooks-fetch', 1)
const pushHookIpc = invokeProxy('automation-hooks-push', 2)
const deleteHookIpc = invokeProxy('automation-hooks-delete', 2)
const validateScriptIpc = invokeProxy('automation-hooks-validate', 1)
const executeScriptIpc = invokeProxy('automation-hooks-execute', 2)

export function fetchRemoteHooks(apiKey: string): Promise<HooksFetchResult> {
  return fetchHooksIpc(apiKey)
}

export function pushRemoteHook(
  apiKey: string,
  hook: Omit<RemoteHook, 'createdAt'>
): Promise<HookPushResult> {
  return pushHookIpc(apiKey, hook)
}

export function deleteRemoteHook(
  apiKey: string,
  id: string
): Promise<HookDeleteResult> {
  return deleteHookIpc(apiKey, id)
}

export function validateScript(script: string): Promise<HookValidateResult> {
  return validateScriptIpc(script)
}

export function executeScript(
  script: string,
  env?: Record<string, string>
): Promise<HookExecuteResult> {
  return executeScriptIpc(script, env)
}
