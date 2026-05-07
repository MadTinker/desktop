export interface IOmnispindleTodo {
  readonly id: string
  readonly title: string
  readonly status: string
  readonly project?: string
  readonly priority?: string
}

export type OmnispindleConnectionStatus = 'connected' | 'error' | 'unconfigured'

export interface OmnispindleTestResult {
  readonly status: OmnispindleConnectionStatus
  readonly message?: string
}
