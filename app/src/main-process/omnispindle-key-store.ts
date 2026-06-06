import { app, safeStorage } from 'electron'
import { promises as Fs } from 'fs'
import * as Path from 'path'

/**
 * Durable, on-disk store for the user's Omnispindle API key.
 *
 * The key is encrypted with Electron's `safeStorage` (OS keychain / DPAPI)
 * when available, falling back to a plaintext JSON file only when the platform
 * offers no encryption. This file is the boot-time source of truth for the
 * main process, independent of the renderer's `localStorage`.
 *
 * `getKeyForExport` is provided so a future feature can wire the Omnispindle
 * MCP server into agent CLIs (claude/codex/gemini/cursor) using the raw key.
 */

const ENCRYPTED_FILE = 'omnispindle-key.bin'
const PLAINTEXT_FILE = 'omnispindle-key.json'

function encryptedPath(): string {
  return Path.join(app.getPath('userData'), ENCRYPTED_FILE)
}

function plaintextPath(): string {
  return Path.join(app.getPath('userData'), PLAINTEXT_FILE)
}

function isNotFound(err: unknown): boolean {
  return (err as NodeJS.ErrnoException)?.code === 'ENOENT'
}

async function safeRemove(path: string): Promise<void> {
  try {
    await Fs.rm(path, { force: true })
  } catch {
    /* nothing to remove */
  }
}

/** Persist the API key, encrypted when the platform supports it. */
export async function saveKey(key: string): Promise<void> {
  try {
    if (safeStorage.isEncryptionAvailable()) {
      await Fs.writeFile(encryptedPath(), safeStorage.encryptString(key))
      // Drop any stale plaintext fallback from a prior unencrypted run.
      await safeRemove(plaintextPath())
    } else {
      log.warn(
        '[omnispindle-key-store] encryption unavailable, storing key as plaintext'
      )
      await Fs.writeFile(
        plaintextPath(),
        JSON.stringify({ apiKey: key }),
        'utf8'
      )
    }
  } catch (err) {
    log.error('[omnispindle-key-store] failed to save key', err)
  }
}

/** Load the persisted API key, or null if none is stored / decryptable. */
export async function loadKey(): Promise<string | null> {
  try {
    if (safeStorage.isEncryptionAvailable()) {
      try {
        return safeStorage.decryptString(await Fs.readFile(encryptedPath()))
      } catch (err) {
        if (!isNotFound(err)) {
          throw err
        }
      }
    }

    try {
      const json = JSON.parse(await Fs.readFile(plaintextPath(), 'utf8'))
      return typeof json?.apiKey === 'string' ? json.apiKey : null
    } catch (err) {
      if (!isNotFound(err)) {
        throw err
      }
    }
  } catch (err) {
    log.error('[omnispindle-key-store] failed to load key', err)
  }
  return null
}

/** Raw key for export (e.g. wiring the MCP server into agent CLIs). */
export function getKeyForExport(): Promise<string | null> {
  return loadKey()
}

/** Remove any persisted key (encrypted and plaintext forms). */
export async function clearKey(): Promise<void> {
  await safeRemove(encryptedPath())
  await safeRemove(plaintextPath())
}
