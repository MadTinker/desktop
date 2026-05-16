/**
 * Configuration for the background chat history archiver.
 *
 * When enabled, the watcher periodically scans tracked repositories for
 * AI conversation history directories (.specstory/history, .claude/, etc.)
 * and offers to centralize them via move + symlink into a single archive repo.
 */

export interface IChatHistoryArchiveConfig {
  readonly enabled: boolean
  /** Absolute path to the archive repository root. */
  readonly archivePath: string
  /** Directories to watch for inside each tracked repo. */
  readonly watchDirs: ReadonlyArray<string>
  /** Scan interval in milliseconds. */
  readonly intervalMs: number
  /** Auto-commit archived history to the archive repo. */
  readonly autoCommit: boolean
  /** Auto-push after commit. */
  readonly autoPush: boolean
}

export const ChatHistoryArchiveConfigKey = 'chat-history-archive-config'

export const DefaultChatHistoryArchiveConfig: IChatHistoryArchiveConfig = {
  enabled: false,
  archivePath: '/Users/d.edens/lab/madness_interactive/docs/cursor_chathistory',
  watchDirs: ['.specstory/history', '.claude'],
  intervalMs: 5 * 60 * 1000, // 5 minutes
  autoCommit: true,
  autoPush: true,
}
