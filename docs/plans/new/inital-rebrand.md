# Madness Desktop — Implementation Plan

## Context

Fork of GitHub Desktop (MIT, Electron + React 16 + TypeScript). Partial rebrand done (app/package.json, CLI → madhub). Goal: complete rebrand, add Omnispindle hook management UI, enrich subrepo tooling, implement stepped push/pull for subrepos. Branch: `madness/init-madness-desktop`.

---

## Phase 1: Complete Rebranding ✅ DONE

### 1A: Critical Identifiers ✅
### 1B: Menu Labels ✅
### 1C: User-Facing UI Strings ✅
### 1D: Documentation ✅

---

## Phase 2: Omnispindle Hook Management UI ✅ DONE

### 2A: Per-Repo Hook State Model ✅
### 2B: Wire Into Hook Execution ✅
### 2C: Repository Settings — Hooks Tab ✅
### 2E: Hook Run Log in Changes Sidebar ✅ (added — persistent log of hook executions)

### 2D: Omnispindle MCP Connection (stretch goal)

Surface Omnispindle todo status in sidebar via MCP API calls from main process. Defer until basic hooks UI works.

---

## Phase 3: Subrepo Tools ✅ DONE

### 3A: Enrich SubmoduleEntry Model ✅
### 3B: Submodule Commit History in Diffs ✅
### 3C: Quick Action Buttons ✅

---

## Phase 4: MadnessThemes ✅ DONE

### 4A: Theme Palette Submodule ✅
Added `app/madness-themes` submodule. 8 custom SCSS themes generated via `scripts/generate-madness-themes.js`.

### 4B: Theme Picker in Preferences ✅
Color palette selector in Preferences → Appearance. Theme strings context (`theme-strings-context.tsx`) and `madness-theme.ts` wired into `app-theme.tsx`.

---

## Phase 5: Auto-Switch Monitor ✅ DONE

`app/src/lib/stores/helpers/auto-switch-monitor.ts` — watches for repos with new changes and auto-switches focus. Wired into `app-store.ts` and `dispatcher.ts`.

---

## Phase 6: Stepped Push/Pull

### 6A: Stepped Push

Modify `app/src/lib/stores/app-store.ts` `performPush()`:
1. Feature flag `enableSteppedSubmodulePush()` in `app/src/lib/feature-flag.ts`
2. Before parent push: `listSubmodules()` → check each for unpushed commits → push individually with progress
3. Then push parent
4. Progress bar weighted: each subrepo + parent

### 6B: Stepped Pull (simple approach first)

Keep `--recurse-submodules` on pull. Before pulling:
1. Iterate submodules, fetch each individually with per-submodule progress
2. Let pull's `--recurse-submodules` handle checkout
3. Enriched progress descriptions: `"Pulling submodule: ui-components (2/5)"`

### 6C: Progress UI

Add optional `submodule?: string` field to `IPushProgress`/`IPullProgress` in `app/src/models/progress.ts`. Existing progress bar shows submodule name during stepped operations.

---

## Phase 7: Omnispindle MCP Connection (stretch)

Surface Omnispindle todo status in sidebar via MCP API calls from main process. Blocked on Phase 6 being stable.

---

## Dependency Graph

```
Phase 1 (Rebrand) ✅
Phase 2 (Hooks UI) ✅
Phase 3 (Subrepo Tools) ✅
Phase 4 (MadnessThemes) ✅
Phase 5 (Auto-Switch Monitor) ✅
Phase 6 (Stepped Push/Pull) ← next
Phase 7 (Omnispindle MCP) ← after Phase 6
```

---

## Verification

- **Phase 6**: Push repo with dirty submodules → progress shows per-submodule steps → all pushed in order
- **Phase 7**: Sidebar shows live Omnispindle todo count/status via MCP
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
