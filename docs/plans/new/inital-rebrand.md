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

## Phase 6: Stepped Push/Pull ✅ DONE

### 6A: Stepped Push ✅
`performPush()` in `app-store.ts` now calls `listSubmodules()` first, pushes each initialized submodule individually via `pushSubmodule()` (new helper in `lib/git/submodule.ts`), then pushes the parent. Weight budget distributes progress proportionally across submodule count + main push + fetch + refresh.

### 6B: Stepped Pull ✅
`performPull()` mirrors 6A: per-submodule pull via `pullSubmodule()` before the main `pullRepo()` call. Same proportional weight scheme.

### 6C: Progress UI ✅
`submodule?: string` added to `IPushProgress` and `IPullProgress` in `models/progress.ts`. Populated during stepped operations so the progress bar can name the submodule currently being processed.

---

## Bonus: Reflog Tab ✅ DONE

Feature-flagged third tab in the repository sidebar. Off by default; toggle at **Preferences → Advanced → "Show Reflog tab in repository sidebar"** (stored in `localStorage` key `show-reflog-tab`).

- `models/reflog-entry.ts` — `IReflogEntry` interface
- `lib/git/reflog.ts` — `getReflog(repo, limit=100)` via `git reflog --format=%H %h %gd %gI %gs`
- `lib/app-state.ts` — `RepositorySectionTab.Reflog`, `IAppState.showReflogTab`, `IRepositoryState.reflogEntries`
- `lib/stores/repository-state-cache.ts` — default `reflogEntries: []`
- `lib/stores/app-store.ts` — `_setShowReflogTab()`, `refreshReflogSection()`, `_changeRepositorySection` Reflog case
- `ui/reflog/reflog-sidebar.tsx` — list component with selector, description, short SHA, RelativeTime
- `ui/repository.tsx` — conditional `Tab.Reflog = 2`, `renderReflogSidebar()`, updated `onTabClicked()` and Ctrl+Tab cycling
- `ui/preferences/advanced.tsx` — "Repository view" section with checkbox
- Full prop chain: `app.tsx` → `preferences.tsx` → `advanced.tsx`

---

## Phase 7: Omnispindle MCP Connection (stretch)

Surface Omnispindle todo status in sidebar via MCP API calls from main process. Blocked on Phase 6 being stable.

> **Status:** Unblocked. Full task breakdown in [`roadmap-v2.md`](roadmap-v2.md) — Phase 7.

---

## Dependency Graph

```
Phase 1 (Rebrand) ✅
Phase 2 (Hooks UI) ✅
Phase 3 (Subrepo Tools) ✅
Phase 4 (MadnessThemes) ✅
Phase 5 (Auto-Switch Monitor) ✅
Phase 6 (Stepped Push/Pull) ✅
Bonus  (Reflog Tab) ✅
Phase 7 (Omnispindle MCP) ← next
```

---

## Next Steps

See [`roadmap-v2.md`](roadmap-v2.md) for the full tagged backlog (77 items across Phases 7–14 + testing).

---

## Verification

- **Phase 6**: ✅ Push repo with dirty submodules → progress shows per-submodule steps → all pushed in order
- **Reflog Tab**: ✅ Enable in Preferences → Advanced → click Reflog tab → entries load from `git reflog`
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
