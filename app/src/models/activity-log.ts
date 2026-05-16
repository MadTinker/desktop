/**
 * Application-level activity log for tracking AI operations, archive events,
 * and other automated actions. Rendered in the Reflog sidebar.
 */

export type ActivityLogAction =
  | 'ai-generate'
  | 'ai-generate-empty'
  | 'archive-chat'
  | 'archive-fail'
  | 'security-setting'
  | 'config-change'

export interface IActivityLogEntry {
  readonly timestamp: number
  readonly action: ActivityLogAction
  readonly summary: string
  /** Optional details (repo name, model used, etc.) */
  readonly detail?: string
}

export const ActivityLogKey = 'madness-activity-log'
export const MaxActivityLogEntries = 200
