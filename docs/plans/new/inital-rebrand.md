# Madness Desktop — Implementation Plan

## Context

Fork of GitHub Desktop (MIT, Electron + React 16 + TypeScript). Partial rebrand done (app/package.json, CLI → madhub). Goal: complete rebrand, add Omnispindle hook management UI, enrich subrepo tooling, implement stepped push/pull for subrepos. Branch: `madness/init-madness-desktop`.

---

## Phase 1: Complete Rebranding

### 1A: Critical Identifiers (manual, careful)

| File | Change |
|------|--------|
| `script/dist-info.ts:98` | `'GitHubDesktop'` → `'MadnessDesktop'` in `getWindowsIdentifierName()` |
| `app/src/main-process/main.ts:107,109` | Protocol handlers `x-github-desktop-auth` → `x-madness-desktop-auth` (and `-dev-auth`) |
| `app/src/main-process/main.ts:121` | App model ID → `'cc.madnessinteractive.MadnessDesktop'` |
| `script/build.ts:225-226` | Protocol schemes match main.ts |
| `script/build.ts:520` | License header text |
| `app/src/cli/main.ts:21` | Exe name `GitHubDesktop` → `MadnessDesktop` |
| `app/src/lib/http.ts:158` | User-Agent string |
| `app/src/lib/progress/lfs.ts:8` | Temp file prefix |
| `app/src/main-process/squirrel-updater.ts:162` | Windows shortcut name |
| `script/info.plist:21` | macOS app description |

### 1B: Menu Labels (manual)

| File | Lines |
|------|-------|
| `app/src/main-process/menu/build-default-menu.ts` | :67, :70, :584 — "GitHub Desktop" → "Madness Desktop" |

### 1C: User-Facing UI Strings (~50 files, ~98 occurrences — Gemini-delegable)

Batch replace `"GitHub Desktop"` → `"Madness Desktop"` across all `app/src/ui/` and `app/src/lib/` TSX/TS files. Rules:
- Preserve case pattern
- Don't touch `github.com` domain URLs (functional API endpoints)
- Don't touch code identifiers handled in 1A
- `github-desktop` kebab-case in localStorage keys/CSS → `madness-desktop`

### 1D: Documentation (~38 files — Gemini-delegable, low priority)

Same replacement across `/docs/`, changelog.json, README.md.

**Commit after each tier.**

---

## Phase 2: Omnispindle Hook Management UI

### 2A: Per-Repo Hook State Model

Create `app/src/lib/hooks/hook-state.ts`:
- `HookToggleState = Record<string, boolean>` 
- Persist per-repo via localStorage keyed by repo path
- `getRepoHookEnabled(repoPath, hookName): boolean`
- `setRepoHookEnabled(repoPath, hookName, enabled): void`

### 2B: Wire Into Hook Execution

Modify `app/src/lib/hooks/with-hooks-env.ts:38` — after `Array.fromAsync(getRepoHooks(...))`, filter out disabled hooks using state from 2A.

### 2C: Repository Settings — Hooks Tab

Per-repo hooks belong in Repository Settings (not global Preferences).

Files:
- `app/src/ui/repository-settings/repository-settings.tsx` — add "Hooks" tab
- Create `app/src/ui/repository-settings/hooks.tsx` — new component

Component behavior:
1. Call `getRepoHooks(repoPath, ['*'])` to discover hooks
2. Render each hook with toggle (existing `Checkbox` component)
3. Read/write state via hook-state.ts functions
4. Group hooks by lifecycle (commit, push, merge, other)
5. Show Omnispindle branding if Omnispindle hooks detected

### 2D: Omnispindle MCP Connection (stretch goal)

Surface Omnispindle todo status in sidebar via MCP API calls from main process. Defer until basic hooks UI works.

---

## Phase 3: Subrepo Tools

### 3A: Enrich SubmoduleEntry Model

`app/src/models/submodule.ts` — currently only `sha`, `path`, `describe`. Add:
```typescript
status: 'initialized' | 'uninitialized' | 'modified' | 'conflict'
```

`app/src/lib/git/submodule.ts:175` — regex `^.([^ ]+)` discards first char status. Capture it:
- ` ` → initialized, `-` → uninitialized, `+` → modified, `U` → conflict

### 3B: Submodule Commit History in Diffs

New function in `app/src/lib/git/submodule.ts`:
```typescript
getSubmoduleCommitsBetween(submodulePath: string, oldSHA: string, newSHA: string): Promise<CommitOneLine[]>
```
Runs `git log --oneline oldSHA..newSHA` inside submodule dir.

Modify `app/src/ui/diff/submodule-diff.tsx`:
- Add state for commits list
- Fetch in `componentDidMount` when both SHAs present
- Render commit list below SHA change display

### 3C: Quick Action Buttons

Add to `SubmoduleDiff` component:

| Button | When shown | Action |
|--------|-----------|--------|
| **Initialize** | Status = uninitialized | `git submodule update --init <path>` |
| **Sync** | Has URL | `git submodule sync <path> && git submodule update --recursive <path>` |
| **Rollback** | readOnly=false, modified | `resetSubmodulePaths(repo, [path])` with confirmation dialog |

Wire through:
- `app/src/ui/dispatcher/dispatcher.ts` — add methods
- `app/src/lib/stores/app-store.ts` — add store methods
- `app/src/lib/git/submodule.ts` — add `initSubmodule()`, `syncSubmodule()`

---

## Phase 4: Stepped Push/Pull

### 4A: Stepped Push

Modify `app/src/lib/stores/app-store.ts` `performPush()`:
1. Feature flag `enableSteppedSubmodulePush()` in `app/src/lib/feature-flag.ts`
2. Before parent push: `listSubmodules()` → check each for unpushed commits → push individually with progress
3. Then push parent
4. Progress bar weighted: each subrepo + parent

### 4B: Stepped Pull (simple approach first)

Keep `--recurse-submodules` on pull. Before pulling:
1. Iterate submodules, fetch each individually with per-submodule progress
2. Let pull's `--recurse-submodules` handle checkout
3. Enriched progress descriptions: `"Pulling submodule: ui-components (2/5)"`

### 4C: Progress UI

Add optional `submodule?: string` field to `IPushProgress`/`IPullProgress` in `app/src/models/progress.ts`. Existing progress bar shows submodule name during stepped operations.

---

## Dependency Graph

```
Phase 1 (Rebrand) ──→ Phase 2 (Hooks UI)
                  ──→ Phase 3 (Subrepo Tools) ──→ Phase 4 (Stepped Push/Pull)
```

Phases 2 and 3 are independent of each other, can parallel after Phase 1.

---

## Gemini Delegation

- **Phase 1C**: ~50 files, text replacement `"GitHub Desktop"` → `"Madness Desktop"`
- **Phase 1D**: ~38 doc files, same replacement
- Theme file expansion if needed

---

## Verification

- **Phase 1**: `grep -r "GitHub Desktop" app/src/` should return zero hits (excluding vendor/docs)
- **Phase 2**: Open Repository Settings → Hooks tab → toggles reflect actual hooks in `.git/hooks/`; disabling a hook skips it during commit
- **Phase 3**: Modify a submodule pointer → diff view shows commit history + init/sync/rollback buttons
- **Phase 4**: Push repo with dirty submodules → progress shows per-submodule steps → all pushed in order
- **Build**: `yarn build:dev` succeeds, app launches with "Madness Desktop" branding

## Critical Files

- `app/src/main-process/main.ts` — protocols, app ID
- `app/src/lib/hooks/with-hooks-env.ts` — hook execution filtering
- `app/src/ui/diff/submodule-diff.tsx` — subrepo diff UI
- `app/src/lib/git/submodule.ts` — submodule operations
- `app/src/lib/stores/app-store.ts` — push/pull orchestration
- `app/src/models/submodule.ts` — SubmoduleEntry model
- `app/src/ui/repository-settings/repository-settings.tsx` — hooks tab
- `app/src/lib/feature-flag.ts` — feature flags
- `script/dist-info.ts` — build identifiers
