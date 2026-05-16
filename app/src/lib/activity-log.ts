import {
  IActivityLogEntry,
  ActivityLogAction,
  ActivityLogKey,
  MaxActivityLogEntries,
} from '../models/activity-log'

/** Read the activity log from localStorage. */
export function loadActivityLog(): ReadonlyArray<IActivityLogEntry> {
  try {
    const raw = localStorage.getItem(ActivityLogKey)
    if (!raw) {
      return []
    }
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/** Append an entry, capping at MaxActivityLogEntries. */
export function logActivity(
  action: ActivityLogAction,
  summary: string,
  detail?: string
): void {
  const entries = [...loadActivityLog()]
  entries.push({ timestamp: Date.now(), action, summary, detail })
  const trimmed = entries.slice(-MaxActivityLogEntries)
  localStorage.setItem(ActivityLogKey, JSON.stringify(trimmed))
}

/** Clear the activity log. */
export function clearActivityLog(): void {
  localStorage.removeItem(ActivityLogKey)
}
