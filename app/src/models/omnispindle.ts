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

/** Result of an Auth0 login that mints and persists an Omnispindle API key. */
export type Auth0LoginResult =
  | { readonly ok: true; readonly apiKey: string; readonly keyPrefix: string }
  | { readonly ok: false; readonly error: string }
