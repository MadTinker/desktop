import { HookLoadout } from './loadout-types'

/** Preset loadout definitions bundled with Madness Desktop. */
export const BUILTIN_LOADOUTS: ReadonlyArray<HookLoadout> = [
  {
    id: 'mad-standard',
    name: 'Mad Standard',
    description:
      'Core workshop hooks: MQTT context, todo prefixing, auto-pull on main, secret scanning',
    scriptIds: ['mqtt-context', 'todo-prefix', 'auto-pull', 'secret-scan'],
    builtin: true,
  },
  {
    id: 'deploy-enabled',
    name: 'Deploy Enabled',
    description:
      'Mad Standard plus auto-push for deployment-ready repos',
    scriptIds: [
      'mqtt-context',
      'todo-prefix',
      'auto-pull',
      'secret-scan',
      'auto-push',
    ],
    builtin: true,
  },
  {
    id: 'desktop-dev',
    name: 'Desktop Dev',
    description:
      'Full dev workflow: Mad Standard + auto-push + background dev build',
    scriptIds: [
      'mqtt-context',
      'todo-prefix',
      'auto-pull',
      'secret-scan',
      'auto-push',
      'build-dev',
    ],
    builtin: true,
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Just the essentials: secret scanning and auto-pull on main',
    scriptIds: ['secret-scan', 'auto-pull'],
    builtin: true,
  },
]

export function getBuiltinLoadout(id: string): HookLoadout | undefined {
  return BUILTIN_LOADOUTS.find(l => l.id === id)
}
