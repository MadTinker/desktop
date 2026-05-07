export interface IOmnispindleTodo {
  readonly id: string
  readonly title: string
  readonly status: string
  readonly project?: string
  readonly priority?: string
  readonly notes?: string
  readonly createdAt?: number
}

export type OmnispindleConnectionStatus = 'connected' | 'error' | 'unconfigured'

export interface OmnispindleTestResult {
  readonly status: OmnispindleConnectionStatus
  readonly message?: string
}
