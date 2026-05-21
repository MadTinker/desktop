# Hook Loadouts

Hook Loadouts let you install, manage, and toggle collections of git hook scripts on any repository — directly from the madnessDesktop UI.

## Overview

Git hooks are shell scripts that run at defined points in the git workflow (pre-commit, post-commit, prepare-commit-msg, etc.). Hook Loadouts solve the problem of managing multiple hook scripts across multiple machines and repos without copy-pasting or maintaining dotfiles.

### The `.d/` dispatcher pattern

Instead of replacing your `post-commit` hook, madnessDesktop installs a thin **dispatcher** script that runs every `*.sh` file found in a `post-commit.d/` directory:

```
.git/hooks/
  post-commit          ← thin dispatcher (installed by madnessDesktop)
  post-commit.d/
    mqtt-context.sh    ← publishes git context to MQTT
    auto-pull.sh       ← pulls latest from remote
```

This means multiple scripts co-exist cleanly. Disabling a script renames it to `mqtt-context.sh.disabled` — the dispatcher skips it, re-enabling renames it back.

---

## Managing loadouts

Open **Repository Settings → Hook Loadouts** (per-repository setting).

### Installing a loadout

1. Select a preset from the loadout cards
2. Click **Install**

The dispatcher scripts are written to `.git/hooks/` and `git config core.hooksPath` is set. Individual scripts land in the `.d/` subdirectories.

### Uninstalling

Click **Uninstall**. madnessDesktop only removes files it wrote (identified by a marker comment). Custom scripts in `.d/` directories are left untouched.

### Per-script toggles

Each installed script has an enable/disable toggle in the UI. Disabling renames the file to `.sh.disabled` on disk instantly — no reinstall needed.

---

## Built-in presets

### `mad-standard` (recommended)
The default workshop loadout. Enables full multi-machine coordination.

| Script | Hook | What it does |
|--------|------|--------------|
| `mqtt-context` | post-commit | Publishes repository context to MQTT broker |
| `todo-prefix` | prepare-commit-msg | Prefixes commit messages with active Omnispindle todo ID |
| `auto-pull` | post-checkout | Pulls latest from remote after branch switch |
| `secret-scan` | pre-commit | Blocks commits containing common secret patterns |

### `deploy-enabled`
`mad-standard` + deployment hooks.

Adds `auto-push` (post-commit) — automatically pushes after every commit.

### `desktop-dev`
For development machines working on madnessDesktop itself.

Adds `auto-push` + `build-dev` (post-commit) — triggers `yarn build:dev` after commits.

### `minimal`
Low-noise setup for repos where automation isn't wanted.

| Script | Hook | What it does |
|--------|------|--------------|
| `secret-scan` | pre-commit | Blocks commits with secrets |
| `auto-pull` | post-checkout | Pulls on branch switch |

---

## Custom loadouts

You can save your own loadout from any current script selection:

1. Adjust the script toggles to your desired combination
2. Click **Save as Custom Loadout**
3. Give it a name

Custom loadouts are stored in localStorage and available across all repos on this machine.

---

## Script reference

### `mqtt-context`
**Hook:** `post-commit`  
Publishes current repository state (branch, commit hash, author, message) to `$MADNESS_GIT_CONTEXT_TOPIC` via `mosquitto_pub`. Requires MQTT configured in Settings → MQTT.

### `todo-prefix`
**Hook:** `prepare-commit-msg`  
If an Omnispindle todo is active (`$OMNISPINDLE_TODO_ID`), prepends `[todo-id]` to the commit message draft.

### `auto-pull`
**Hook:** `post-checkout`  
Runs `git pull --rebase` after checkout. Skips if on a detached HEAD or if the branch has no upstream.

### `secret-scan`
**Hook:** `pre-commit`  
Scans staged files for patterns matching common secrets (AWS keys, private key headers, `.env` content). Blocks the commit if found.

### `auto-push`
**Hook:** `post-commit`  
Runs `git push` after every commit. Use with caution on shared branches.

### `build-dev`
**Hook:** `post-commit`  
Runs `yarn build:dev` in the repository root. Useful for keeping dev builds current during active development on madnessDesktop.

---

## Requirements

- `mosquitto-clients` for MQTT scripts (`mqtt-context`)
- MQTT configured in Settings → MQTT (see [MQTT Integration](./mqtt-integration.md))
- Omnispindle running for `todo-prefix` to prefix messages
