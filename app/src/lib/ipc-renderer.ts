import { RequestResponseChannels, RequestChannels } from './ipc-shared'

// IPC bridge exposed by preload.ts via Electron contextBridge.
// With contextIsolation:true the renderer cannot import from 'electron' directly;
// all IPC goes through window.electronBridge instead.
const bridge = window.electronBridge

// Maps each listener function to a stable UUID so the preload can match it on
// removeListener. Each unique function object gets one ID for its lifetime.
const listenerIds = new WeakMap<object, string>()

function getListenerId(fn: object): string {
  let id = listenerIds.get(fn)
  if (id === undefined) {
    id = crypto.randomUUID()
    listenerIds.set(fn, id)
  }
  return id
}

/**
 * Send a message to the main process via channel and expect a result
 * asynchronously. This is the equivalent of ipcRenderer.invoke except with
 * strong typing guarantees.
 */
export function invoke<T extends keyof RequestResponseChannels>(
  channel: T,
  ...args: Parameters<RequestResponseChannels[T]>
): ReturnType<RequestResponseChannels[T]> {
  return bridge.invoke(channel, ...args) as any
}

/**
 * Send a message to the main process via channel asynchronously. This is the
 * equivalent of ipcRenderer.send except with strong typing guarantees.
 */
export function send<T extends keyof RequestChannels>(
  channel: T,
  ...args: Parameters<RequestChannels[T]>
): void {
  bridge.send(channel, ...args)
}

/**
 * Send a message to the main process via channel synchronously. This is the
 * equivalent of ipcRenderer.sendSync except with strong typing guarantees.
 */
export function sendSync<T extends keyof RequestChannels>(
  channel: T,
  ...args: Parameters<RequestChannels[T]>
): void {
  // eslint-disable-next-line no-sync
  bridge.sendSync(channel, ...args)
}

/**
 * Subscribes to the specified IPC channel and provides strong typing of
 * the channel name and parameters. The IpcRendererEvent is stripped by the
 * preload bridge — listeners receive only the payload arguments.
 */
export function on<T extends keyof RequestChannels>(
  channel: T,
  listener: (...args: Parameters<RequestChannels[T]>) => void
) {
  bridge.on(channel, getListenerId(listener), listener as any)
}

/**
 * Subscribes to the specified IPC channel for a single event and provides
 * strong typing of the channel name and parameters.
 */
export function once<T extends keyof RequestChannels>(
  channel: T,
  listener: (...args: Parameters<RequestChannels[T]>) => void
) {
  bridge.once(channel, getListenerId(listener), listener as any)
}

/**
 * Unsubscribes from the specified IPC channel. The listener must be the same
 * function reference passed to on() or once().
 */
export function removeListener<T extends keyof RequestChannels>(
  channel: T,
  listener: (...args: Parameters<RequestChannels[T]>) => void
) {
  const id = listenerIds.get(listener)
  if (id !== undefined) {
    bridge.removeListener(channel, id)
  }
}
