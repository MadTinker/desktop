import { Repository, ILocalRepositoryState } from '../../../models/repository'

/** Poll interval for checking repos for new changes. */
const PollInterval = 15 * 1000

/** Minimum time between auto-switches to prevent thrashing. */
const CooldownMs = 15 * 1000

/**
 * Monitors all non-selected repositories for new working directory changes
 * and auto-switches to the first repo that gains new changes.
 *
 * Follows the same start/stop/pause/resume pattern as RepositoryIndicatorUpdater.
 */
export class AutoSwitchMonitor {
  private running = false
  private paused = false
  private pausePromise: Promise<void> = Promise.resolve()
  private resolvePausePromise: (() => void) | null = null
  private timeoutId: number | null = null
  private lastSwitchTime = 0
  private snapshot = new Map<number, number>()

  public constructor(
    private readonly getRepositories: () => ReadonlyArray<Repository>,
    private readonly refreshIndicator: (
      repository: Repository
    ) => Promise<void>,
    private readonly getIndicatorState: (
      id: number
    ) => ILocalRepositoryState | undefined,
    private readonly selectRepository: (repository: Repository) => void,
    private readonly hasCurrentRepoChanges: () => boolean
  ) {}

  public start() {
    if (!this.running) {
      log.debug('[AutoSwitchMonitor] Starting')
      this.running = true
      this.schedulePoll()
    }
  }

  public stop() {
    if (this.running) {
      log.debug('[AutoSwitchMonitor] Stopping')
      this.running = false
      this.clearTimeout()
    }
  }

  public pause() {
    if (!this.paused) {
      this.pausePromise = new Promise<void>(resolve => {
        this.resolvePausePromise = resolve
      })
      this.paused = true
    }
  }

  public resume() {
    if (this.paused) {
      if (this.resolvePausePromise !== null) {
        this.resolvePausePromise()
        this.resolvePausePromise = null
      }
      this.paused = false
    }
  }

  private clearTimeout() {
    if (this.timeoutId !== null) {
      window.clearTimeout(this.timeoutId)
      this.timeoutId = null
    }
  }

  private schedulePoll() {
    if (this.running && this.timeoutId === null) {
      this.timeoutId = window.setTimeout(() => this.poll(), PollInterval)
    }
  }

  private async poll() {
    this.timeoutId = null

    if (this.paused) {
      await this.pausePromise
      if (!this.running) {
        return
      }
    }

    const repos = this.getRepositories()
    let switched = false

    for (const repo of repos) {
      if (!this.running) {
        return
      }

      await this.refreshIndicator(repo)

      const state = this.getIndicatorState(repo.id)
      const newCount = state?.changedFilesCount ?? 0
      const prevCount = this.snapshot.get(repo.id) ?? 0

      this.snapshot.set(repo.id, newCount)

      if (
        newCount > prevCount &&
        !switched &&
        this.cooldownElapsed() &&
        !this.hasCurrentRepoChanges()
      ) {
        log.info(
          `[AutoSwitchMonitor] Switching to ${repo.name} (${prevCount} → ${newCount} changes)`
        )
        this.lastSwitchTime = Date.now()
        this.selectRepository(repo)
        switched = true
      }

      if (this.paused) {
        await this.pausePromise
        if (!this.running) {
          return
        }
      }
    }

    this.schedulePoll()
  }

  private cooldownElapsed(): boolean {
    return Date.now() - this.lastSwitchTime >= CooldownMs
  }
}
