import { Repository } from '../../../models/repository'
import {
  IChatHistoryArchiveConfig,
} from '../../../models/chat-history-archive'
import {
  findArchiveCandidates,
  archiveCandidate,
  commitArchiveRepo,
  appendArchiveLog,
  IArchiveCandidate,
} from '../../chat-history-archive'

/**
 * Periodically scans tracked repositories for AI chat history directories
 * that haven't been archived yet. When candidates are found, notifies via
 * callback so the app can prompt the user or auto-archive.
 */
export class ChatHistoryWatcher {
  private running = false
  private timeoutId: number | null = null

  public constructor(
    private readonly getRepositories: () => ReadonlyArray<Repository>,
    private readonly getConfig: () => IChatHistoryArchiveConfig,
    private readonly onCandidatesFound: (
      candidates: ReadonlyArray<IArchiveCandidate>
    ) => void
  ) {}

  public start() {
    if (this.running) {
      return
    }

    log.info('[ChatHistoryWatcher] Starting')
    this.running = true
    this.scheduleScan()
  }

  public stop() {
    if (!this.running) {
      return
    }

    log.info('[ChatHistoryWatcher] Stopping')
    this.running = false

    if (this.timeoutId !== null) {
      window.clearTimeout(this.timeoutId)
      this.timeoutId = null
    }
  }

  private scheduleScan() {
    if (!this.running || this.timeoutId !== null) {
      return
    }

    const config = this.getConfig()
    this.timeoutId = window.setTimeout(
      () => this.scan(),
      config.intervalMs
    )
  }

  private async scan() {
    this.timeoutId = null

    if (!this.running) {
      return
    }

    const config = this.getConfig()
    if (!config.enabled) {
      this.scheduleScan()
      return
    }

    const repositories = this.getRepositories()
    const candidates = findArchiveCandidates(repositories, config)

    if (candidates.length > 0) {
      log.info(
        `[ChatHistoryWatcher] Found ${candidates.length} archive candidate(s)`
      )
      this.onCandidatesFound(candidates)
    }

    this.scheduleScan()
  }

  /**
   * Manually trigger a scan + archive cycle. Used when the user confirms
   * archiving from a notification or popup.
   */
  public async archiveAll(): Promise<{
    archived: number
    failed: number
  }> {
    const config = this.getConfig()
    const repositories = this.getRepositories()
    const candidates = findArchiveCandidates(repositories, config)

    let archived = 0
    let failed = 0
    const projectNames: string[] = []

    for (const candidate of candidates) {
      const result = await archiveCandidate(candidate, config)
      if (result.success) {
        archived++
        projectNames.push(
          candidate.repository.name ??
            candidate.repository.path.split('/').pop() ??
            'unknown'
        )
      } else {
        failed++
        log.error(
          `[ChatHistoryWatcher] Failed to archive ${candidate.sourcePath}: ${result.error}`
        )
      }
    }

    if (archived > 0 && config.autoCommit) {
      const commitResult = await commitArchiveRepo(config, projectNames)
      if (!commitResult.success) {
        log.error(
          `[ChatHistoryWatcher] Commit failed: ${commitResult.error}`
        )
      }
    }

    // Log the operation
    if (archived > 0 || failed > 0) {
      appendArchiveLog({
        timestamp: Date.now(),
        repos: projectNames,
        archived,
        failed,
      })
    }

    return { archived, failed }
  }
}
