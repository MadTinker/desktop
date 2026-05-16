import * as Path from 'path'
import * as Fs from 'fs'
import { exec as git } from 'dugite'
import {
  IChatHistoryArchiveConfig,
  IChatHistoryArchiveLogEntry,
  ChatHistoryArchiveLogKey,
  MaxArchiveLogEntries,
} from '../models/chat-history-archive'
import { Repository } from '../models/repository'

export interface IArchiveCandidate {
  readonly repository: Repository
  /** The relative watchDir that was found (e.g. '.specstory/history'). */
  readonly watchDir: string
  /** Full path to the source directory in the repo. */
  readonly sourcePath: string
}

export interface IArchiveResult {
  readonly candidate: IArchiveCandidate
  readonly destPath: string
  readonly success: boolean
  readonly error?: string
}

/**
 * Scans a list of repositories for un-archived AI chat history directories.
 * A directory is considered un-archived if it exists and is NOT already a symlink.
 */
export function findArchiveCandidates(
  repositories: ReadonlyArray<Repository>,
  config: IChatHistoryArchiveConfig
): ReadonlyArray<IArchiveCandidate> {
  const candidates: IArchiveCandidate[] = []

  for (const repo of repositories) {
    const repoPath = repo.path

    for (const watchDir of config.watchDirs) {
      const fullPath = Path.join(repoPath, watchDir)
      try {
        const stat = Fs.lstatSync(fullPath)
        // Skip if it's already a symlink (already archived)
        if (stat.isDirectory() && !stat.isSymbolicLink()) {
          candidates.push({
            repository: repo,
            watchDir,
            sourcePath: fullPath,
          })
        }
      } catch {
        // Directory doesn't exist — skip
      }
    }
  }

  return candidates
}

/**
 * Archives a single chat history directory:
 * 1. Moves it to archivePath/<project-name>/<watchDir-basename>
 * 2. Creates a symlink from original location to the archive
 */
export async function archiveCandidate(
  candidate: IArchiveCandidate,
  config: IChatHistoryArchiveConfig
): Promise<IArchiveResult> {
  const projectName = Path.basename(candidate.repository.path)
  const destPath = Path.join(config.archivePath, projectName)

  try {
    // Ensure destination parent exists
    Fs.mkdirSync(destPath, { recursive: true })

    const destFull = Path.join(destPath, Path.basename(candidate.watchDir))

    // If destination already exists (partial previous archive), remove it
    if (Fs.existsSync(destFull)) {
      // Merge: move contents into existing dest
      const entries = Fs.readdirSync(candidate.sourcePath)
      for (const entry of entries) {
        const src = Path.join(candidate.sourcePath, entry)
        const dst = Path.join(destFull, entry)
        if (!Fs.existsSync(dst)) {
          Fs.renameSync(src, dst)
        }
      }
      // Remove now-empty source dir
      Fs.rmdirSync(candidate.sourcePath, { recursive: true } as any)
    } else {
      // Simple move
      Fs.renameSync(candidate.sourcePath, destFull)
    }

    // Create symlink: source → archive destination
    Fs.symlinkSync(destFull, candidate.sourcePath, 'dir')

    return { candidate, destPath: destFull, success: true }
  } catch (e) {
    const error = e instanceof Error ? e.message : 'Unknown error'
    return { candidate, destPath, success: false, error }
  }
}

/**
 * Commits and optionally pushes the archive repo after new history is archived.
 */
export async function commitArchiveRepo(
  config: IChatHistoryArchiveConfig,
  archivedProjects: ReadonlyArray<string>
): Promise<{ success: boolean; error?: string }> {
  const archivePath = config.archivePath

  try {
    // Stage all new files
    const addResult = await git(['add', '.'], archivePath, {})
    if (addResult.exitCode !== 0) {
      return { success: false, error: `git add failed: ${addResult.stderr}` }
    }

    // Check if there's anything to commit
    const statusResult = await git(
      ['status', '--porcelain'],
      archivePath,
      {}
    )
    if (statusResult.stdout.trim() === '') {
      return { success: true } // nothing to commit
    }

    const message = `Archive chat history: ${archivedProjects.join(', ')}`
    const commitResult = await git(
      ['commit', '-m', message],
      archivePath,
      {}
    )
    if (commitResult.exitCode !== 0) {
      return {
        success: false,
        error: `git commit failed: ${commitResult.stderr}`,
      }
    }

    if (config.autoPush) {
      const pushResult = await git(['push'], archivePath, {})
      if (pushResult.exitCode !== 0) {
        // Non-fatal — committed locally, push can be retried
        log.warn(
          `[ChatHistoryArchive] Push failed: ${pushResult.stderr}`
        )
      }
    }

    return { success: true }
  } catch (e) {
    const error = e instanceof Error ? e.message : 'Unknown error'
    return { success: false, error }
  }
}

/** Read the archive log from localStorage. */
export function loadArchiveLog(): ReadonlyArray<IChatHistoryArchiveLogEntry> {
  try {
    const raw = localStorage.getItem(ChatHistoryArchiveLogKey)
    if (!raw) {
      return []
    }
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/** Append an entry to the archive log, capping at MaxArchiveLogEntries. */
export function appendArchiveLog(entry: IChatHistoryArchiveLogEntry): void {
  const existing = [...loadArchiveLog()]
  existing.push(entry)
  // Keep only the most recent entries
  const trimmed = existing.slice(-MaxArchiveLogEntries)
  localStorage.setItem(ChatHistoryArchiveLogKey, JSON.stringify(trimmed))
}

/** Clear the archive log. */
export function clearArchiveLog(): void {
  localStorage.removeItem(ChatHistoryArchiveLogKey)
}
