export interface IOmnispindleTodo {
  readonly id: string
  readonly title: string
  readonly status: string
  readonly project?: string
  readonly priority?: number
}

export type OmnispindleConnectionStatus = 'connected' | 'error' | 'unconfigured'
