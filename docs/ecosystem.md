# The Madness Ecosystem

Madness Desktop is one node in a larger workshop coordination system. This document explains how the pieces fit together.

## Overview

```
┌─────────────────────────────────────────────────────────┐
│                   Workshop Machines                      │
│                                                         │
│  ┌──────────────────┐    ┌──────────────────┐           │
│  │  Madness Desktop │    │  Madness Desktop │  ...      │
│  │  (machine A)     │    │  (machine B)     │           │
│  └────────┬─────────┘    └────────┬─────────┘           │
│           │ git hooks              │ git hooks           │
│           │ MQTT publish           │ MQTT publish        │
└───────────┼────────────────────────┼─────────────────────┘
            │                        │
            ▼                        ▼
     ┌──────────────────────────────────┐
     │         MQTT Broker              │
     │   (mosquitto / shared server)    │
     └──────────┬───────────────────────┘
                │ subscribe
       ┌────────┴────────┐
       │                 │
       ▼                 ▼
┌─────────────┐   ┌──────────────┐
│ Omnispindle │   │  Inventorium │
│ (MCP server)│   │  (dashboard) │
└─────────────┘   └──────────────┘
```

## Components

### Madness Desktop
**Role:** Git client + hook manager + event publisher

The workshop git client. Beyond standard GitHub Desktop features, it:
- Installs and manages [Hook Loadouts](./hook-loadouts.md) on any repository
- Publishes commit context and events to MQTT after each commit
- Displays live Omnispindle todos in the sidebar
- Injects Omnispindle todo IDs into commit messages via `todo-prefix` hook

**Repo:** `MadnessEngineering/madnessDesktop`

---

### MQTT Broker
**Role:** Message bus between all machines and tools

A standard Mosquitto broker. Every machine publishes to its own topic namespace; any tool can subscribe to any or all machines.

Topic structure:
```
{prefix}/{device-name}/claude/git/context   ← current repo state
{prefix}/{device-name}/claude/git/events    ← commit/push events
```

With `prefix=status` and two machines `dan-mbp` and `dan-linux`:
```
status/dan-mbp/claude/git/context
status/dan-mbp/claude/git/events
status/dan-linux/claude/git/context
status/dan-linux/claude/git/events
```

A subscriber on `status/+/claude/git/#` receives all events from all machines.

**Setup:** Configure broker host and device name in madnessDesktop Settings → MQTT. See [MQTT Integration](./mqtt-integration.md).

---

### Omnispindle
**Role:** MCP server — the communication backbone

The central MCP (Model Context Protocol) server that connects AI tools, todos, lessons, and context across the workshop. It:
- Manages todos and project tracking
- Serves as the tool bridge for AI clients (Claude, Cursor, etc.)
- Receives git events from MQTT and links them to active todos
- Exposes context bundles that give AI clients full workspace awareness

Madness Desktop connects to Omnispindle via API key (Settings → AI Services → Omnispindle API Key). This enables the sidebar todo list and the `todo-prefix` commit hook.

**Repo:** `MadnessEngineering/Omnispindle`

---

### Inventorium
**Role:** Dashboard and control interface

A React-based web dashboard that provides a visual overview of the entire workshop:
- Displays real-time commit activity across all machines (via MQTT)
- Shows active todos, projects, and lessons from Omnispindle
- Swarmdesk — a game-like interface for managing tasks and watching systems
- Auth0-secured for multi-user access

Inventorium subscribes to MQTT and the Omnispindle API. It's read-mostly — it watches, displays, and links things together but doesn't drive git operations.

**Repo:** `MadnessEngineering/Inventorium`

---

## Data flows

### Commit on any machine

```
1. Developer commits in Madness Desktop
2. post-commit hook fires (via Hook Loadout)
3. mqtt-context script publishes to MQTT broker:
   topic: status/{device}/claude/git/events
   payload: { branch, commit, author, message, timestamp }
4. Inventorium receives event → updates live feed
5. Omnispindle receives event → links to active todo if present
```

### AI agent working in any repo

```
1. AI client (Claude, Cursor) queries Omnispindle via MCP
2. Omnispindle returns context bundle: active todos, recent commits, lessons
3. AI makes changes, asks Madness Desktop to commit
4. Commit message auto-prefixed with active todo ID
5. Event published to MQTT → all tools updated
```

### New machine joining the workshop

```
1. Install Madness Desktop
2. Settings → MQTT → set broker host + unique device name
3. Settings → AI Services → paste Omnispindle API key
4. Repository Settings → Hook Loadouts → install mad-standard
5. Machine now publishes to shared broker and receives Omnispindle todos
```

---

## Auth

- **Madness Desktop ↔ GitHub:** PAT or external credential helper (see [Authentication](./authentication.md))
- **Madness Desktop ↔ Omnispindle:** API key in Settings → AI Services
- **MQTT broker:** optional username/password in Settings → MQTT
- **Inventorium:** Auth0 (user login via browser)
- **Omnispindle ↔ everything:** runs locally or on `eaws` server, accessible via API

---

## Running the stack locally

Minimum viable workshop setup on a single machine:

```bash
# 1. MQTT broker
brew install mosquitto && brew services start mosquitto

# 2. Omnispindle (follow its README)
cd $SEAT_OF_MADNESS/Omnispindle && npm start

# 3. Madness Desktop — configure in Settings:
#    MQTT → host: localhost, port: 1883
#    AI Services → Omnispindle API key
#    Repository Settings → Hook Loadouts → mad-standard
```

Multi-machine: replace `localhost` with the shared server IP or hostname (`madnessinteractive.cc`) and point all machines at the same broker.
