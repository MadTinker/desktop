import { hostname } from 'os'

export interface IMqttConfig {
  readonly enabled: boolean
  readonly host: string
  readonly port: number
  readonly deviceName: string
  readonly topicPrefix: string
  readonly username: string
  readonly password: string
}

const storageKey = 'madness-mqtt-config'

export const DefaultMqttConfig: IMqttConfig = {
  enabled: true,
  host: 'localhost',
  port: 1883,
  deviceName: hostname(),
  topicPrefix: 'status',
  username: '',
  password: '',
}

export function getMqttConfig(): IMqttConfig {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) {
      return DefaultMqttConfig
    }
    return { ...DefaultMqttConfig, ...JSON.parse(raw) }
  } catch {
    return DefaultMqttConfig
  }
}

export function saveMqttConfig(config: IMqttConfig): void {
  try {
    localStorage.setItem(storageKey, JSON.stringify(config))
  } catch {
    // localStorage unavailable
  }
}

/**
 * Convert MQTT config to environment variables that hook scripts expect.
 * These match the env vars used by the bundled hook scripts
 * (mqtt-context post-commit, todo-prefix prepare-commit-msg).
 */
export function mqttConfigToEnv(
  config: IMqttConfig
): Record<string, string> {
  if (!config.enabled) {
    return {}
  }

  const env: Record<string, string> = {
    DeNa: config.deviceName,
    MADNESS_MQTT_HOST: config.host,
    MADNESS_MQTT_PORT: String(config.port),
    MADNESS_GIT_CONTEXT_TOPIC: `${config.topicPrefix}/${config.deviceName}/claude/git/context`,
    MADNESS_GIT_EVENT_TOPIC: `${config.topicPrefix}/${config.deviceName}/claude/git/events`,
  }

  if (config.username) {
    env.MADNESS_MQTT_USERNAME = config.username
  }
  if (config.password) {
    env.MADNESS_MQTT_PASSWORD = config.password
  }

  return env
}

/**
 * Compute the full topic paths for display in the UI.
 */
export function getTopicPaths(config: IMqttConfig): {
  context: string
  events: string
} {
  return {
    context: `${config.topicPrefix}/${config.deviceName}/claude/git/context`,
    events: `${config.topicPrefix}/${config.deviceName}/claude/git/events`,
  }
}
