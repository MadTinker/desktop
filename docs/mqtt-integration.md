# MQTT Integration

Madness Desktop can publish git context and events to an MQTT broker, enabling real-time cross-machine awareness in the madness_interactive workshop ecosystem.

## What it does

When enabled, every commit, push, and repository context change publishes a message to your MQTT broker. Other tools on the network (Omnispindle, Inventorium, custom scripts) can subscribe to these topics and react in real time.

```
[madnessDesktop commit] → MQTT broker → [any subscriber on the network]
                                      → Omnispindle todo tracking
                                      → Inventorium dashboard
                                      → Other workshop machines
```

## Configuration

Open **Settings → MQTT**.

### Connection

| Field | Default | Description |
|-------|---------|-------------|
| Enable MQTT | on | Master toggle. Disabling stops all MQTT publishing. |
| Broker Host | `localhost` | Hostname or IP of your MQTT broker |
| Port | `1883` | Standard MQTT port. TLS typically uses `8883`. |

Click **Test Connection** to verify — it spawns `mosquitto_pub` with a test payload and reports success or the error message. Requires `mosquitto-clients` installed on your machine.

### Device Identity

| Field | Default | Description |
|-------|---------|-------------|
| Device Name | system hostname | Unique ID for this machine on the broker. Use something memorable (`dan-mbp`, `workshop-linux`). |
| Topic Prefix | `status` | Root prefix for all topics. Change if you share a broker with other projects. |

The **Topic Paths** preview shows the full topic strings that will be used:

```
status/{device-name}/claude/git/context   ← repository state
status/{device-name}/claude/git/events    ← commit/push events
```

### Authentication

Leave blank if your broker has no auth. Otherwise provide Username and Password. These are stored in localStorage (not the system keychain).

---

## Multi-machine setup

Point all workshop machines at the same broker. Give each a unique **Device Name**.

```
Machine A (dan-mbp)    → status/dan-mbp/claude/git/context
Machine B (dan-linux)  → status/dan-linux/claude/git/context
```

Any subscriber with `status/+/claude/git/#` receives events from all machines simultaneously.

### Broker options

- **Local broker**: `brew install mosquitto && brew services start mosquitto`
- **Shared broker**: Set host to your server's IP or hostname (e.g. `madnessinteractive.cc`), port `4140` or your configured port
- **Auth**: Set username/password to match your broker's ACL

---

## Environment variables

When MQTT is enabled, madnessDesktop injects these variables into every git hook execution:

| Variable | Value |
|----------|-------|
| `DeNa` | Device name |
| `MADNESS_MQTT_HOST` | Broker host |
| `MADNESS_MQTT_PORT` | Broker port |
| `MADNESS_GIT_CONTEXT_TOPIC` | Full context topic path |
| `MADNESS_GIT_EVENT_TOPIC` | Full events topic path |

Hook scripts (see [Hook Loadouts](./hook-loadouts.md)) read these variables automatically — no manual shell profile edits needed.

---

## Troubleshooting

**Test Connection says `mosquitto_pub not found`**
→ Install mosquitto clients: `brew install mosquitto` (macOS) or `apt install mosquitto-clients` (Linux)

**Test Connection times out**
→ Broker is unreachable. Check host/port and firewall rules.

**Hooks run but nothing appears on broker**
→ Verify `Enable MQTT` is on and settings were saved. Check that the hook loadout includes `mqtt-context` (see Hook Loadouts).
