# Madness Desktop — Roadmap v2

## Context

All foundation phases complete as of `cc13b9f`. Next milestone is Phase 7 (Omnispindle MCP).
Source branch: `madness/init-madness-desktop`

---

## Tag Legend

| Tag | Area |
|-----|------|
| `#mcp` | Omnispindle MCP integration |
| `#hooks` | Hook management UI / execution |
| `#submodule` | Submodule / subrepo tooling |
| `#git` | Core git operations |
| `#ui` | UI components / layout |
| `#ux` | User experience flows |
| `#refactor` | Code quality / cleanup |
| `#bug` | Confirmed defect |
| `#security` | Security-sensitive |
| `#windows` | Windows-only |
| `#a11y` | Accessibility |
| `#dx` | Developer experience |
| `#theme` | MadnessThemes system |
| `#electron` | Electron platform concerns |
| `#testing` | Test coverage |
| `#upstream` | Upstream GitHub Desktop sync |

## Priority Scale

- **P1** — Blocking / critical / must ship next
- **P2** — High — target next release
- **P3** — Medium — planned
- **P4** — Low / nice-to-have / someday

---

## Completed

| Phase | Feature |
|-------|---------|
| Phase 1 | Complete Rebranding |
| Phase 2 | Omnispindle Hook Management UI |
| Phase 3 | Subrepo Tools |
| Phase 4 | MadnessThemes |
| Phase 5 | Auto-Switch Monitor |
| Phase 6 | Stepped Push/Pull |
| Bonus | Reflog Tab |

---

## Phase 7: Omnispindle MCP Connection `#mcp` `#hooks`

> Surface Omnispindle todo status in the sidebar via MCP API from main process.
> Unblocked now that Phase 6 is stable.

- [ ] **7A** MCP client bootstrapped in main process — IPC-safe, no renderer dependency `#mcp` `P2`
- [ ] **7B** IPC bridge: main → renderer channel for todo payload `#mcp` `#electron` `P2`
- [ ] **7C** Sidebar todo count badge (Changes tab, below hook log) `#mcp` `#ui` `P2`
- [ ] **7D** Sidebar todo widget: list view with title, status, source `#mcp` `#ui` `P2`
- [ ] **7E** Poll interval configurable in Preferences → Advanced `#mcp` `#ux` `P3`
- [ ] **7F** Error state when MCP unreachable (silent degradation — no red crash) `#mcp` `#ux` `P2`
- [ ] **7G** Click-through from todo item to Omnispindle (external URL or IPC) `#mcp` `#ux` `P3`
- [ ] **7H** Verification: sidebar shows live count after Omnispindle creates a todo `#mcp` `#testing` `P2`

---

## Phase 8: Bug Fixes & Technical Debt `#bug` `#refactor`

### Git Layer

- [ ] **8.git-1** Fix `commitish^` syntax for first commit (no parent) — `lib/git/diff.ts:506` `#git` `#bug` `P2`
- [ ] **8.git-2** Favour `origin` when multiple remotes present — `lib/stores/git-store.ts:1119` `#git` `P3`
- [ ] **8.git-3** FIXME: Windows OpenSSH binary can't be used on Windows — `lib/ssh/ssh.ts:19` `#windows` `#bug` `P2`
- [ ] **8.git-4** Use `expectedErrors` in `for-each-ref` to handle known git errors — `lib/git/for-each-ref.ts:29` `#refactor` `P4`
- [ ] **8.git-5** Parse additional info from unified diff header — `lib/diff-parser.ts:175` `#git` `P4`
- [ ] **8.git-6** Share logic between `formatPatch()` / `unformatPatch()` — `lib/patch-formatter.ts:243` `#refactor` `P3`

### Hooks

- [ ] **8.hooks-1** Escape `tmpHooksDir` for shell single-quote injection — `lib/hooks/with-hooks-env.ts:93` `#hooks` `#security` `P2`

### App Store / State

- [ ] **8.store-1** Move dialog initialization to dialog mount lifecycle — `lib/stores/app-store.ts:2324` `#refactor` `P3`
- [ ] **8.store-2** Determine default PR dialog width — `lib/stores/app-store.ts:2587` `#ui` `P4`
- [ ] **8.store-3** Clear GitHub repository associations on repo removal — `lib/stores/app-store.ts:4530` `#bug` `P3`

### Dispatcher

- [ ] **8.disp-1** Fix exit condition logic — `ui/dispatcher/dispatcher.ts:827` `#bug` `P3`
- [ ] **8.disp-2** Add missing rebase-related actions — `ui/dispatcher/dispatcher.ts:2565` `#git` `P3`
- [ ] **8.disp-3** History search back to last retained commit — `ui/dispatcher/dispatcher.ts:3590` `#git` `P3`
- [ ] **8.disp-4** Clear dispatcher state after sequence completes — `ui/dispatcher/dispatcher.ts:3615` `#bug` `P2`
- [ ] **8.disp-5** Expand type handling to cover all action types — `ui/dispatcher/dispatcher.ts:3833` `#refactor` `P4`

### UI Components

- [ ] **8.ui-1** Complete incomplete TODO in filter-changes-list — `ui/changes/filter-changes-list.tsx:883` `#ui` `#bug` `P2`
- [ ] **8.ui-2** Remake triangle octicon at 12px — `ui/toolbar/dropdown.tsx:273` `#ui` `P4`
- [ ] **8.ui-3** Clean up "this is bad" pattern in branch-dropdown — `ui/toolbar/branch-dropdown.tsx:151` `#refactor` `P3`
- [ ] **8.ui-4** Decide grid focus target in section-list — `ui/lib/list/section-list.tsx:1778` `#a11y` `P3`
- [ ] **8.ui-5** Document or remove mysterious checkbox initialization — `ui/lib/checkbox.tsx:62` `#refactor` `P4`
- [ ] **8.ui-6** Hook into React prop warning API in text-box — `ui/lib/text-box.tsx:233` `#dx` `P4`
- [ ] **8.ui-7** Add fallback UI when no external editor detected — `ui/preferences/integrations.tsx:193` `#ux` `P3`

### Main Process

- [ ] **8.main-1** Scope dialog initialization to the correct window — `main-process/app-window.ts:190` `#bug` `#electron` `P3`
- [ ] **8.main-2** Investigate Electron platform TODO in index.tsx — `ui/index.tsx:110` `#electron` `P3`

### Code Quality

- [ ] **8.code-1** Share monospace font constant between TypeScript and SCSS — `ui/get-monospace-font-family.ts:2` `#refactor` `P4`
- [ ] **8.code-2** Move tutorial panel filename to a shared constant — `ui/tutorial/tutorial-panel.tsx:60` `#refactor` `P4`

---

## Phase 9: Hook Management Extensions `#hooks`

- [ ] **9.hooks-1** Per-hook configurable timeout (default 30s, env-overridable) `#hooks` `#ux` `P3`
- [ ] **9.hooks-2** Hook severity levels: warn (log only) vs block (abort commit) `#hooks` `#ux` `P3`
- [ ] **9.hooks-3** Per-branch-pattern hook enable/disable (e.g. skip on `wip/*`) `#hooks` `P3`
- [ ] **9.hooks-4** Export / import hook config as JSON for sharing across machines `#hooks` `#ux` `P4`
- [ ] **9.hooks-5** Hook log: persist last N entries across restarts (localStorage) `#hooks` `#ui` `P3`
- [ ] **9.hooks-6** Hook log: filter by hook name or exit code `#hooks` `#ui` `P4`
- [ ] **9.hooks-7** Hook log: copy-to-clipboard button on individual entries `#hooks` `#ux` `P4`

---

## Phase 10: Submodule UX Enhancements `#submodule`

- [ ] **10.sub-1** Submodule dependency graph view in Changes tab `#submodule` `#ui` `P3`
- [ ] **10.sub-2** Bulk submodule operations: reset all / update all / init all `#submodule` `#ux` `P3`
- [ ] **10.sub-3** Submodule parent-pointer drift indicator (how far behind HEAD) `#submodule` `#ui` `P3`
- [ ] **10.sub-4** Confirm dialog when stepped push would fail on a submodule `#submodule` `#ux` `P2`
- [ ] **10.sub-5** Stepped push/pull: retry individual failed submodule without restarting `#submodule` `P3`
- [ ] **10.sub-6** Submodule URL shown in tooltip on quick-action buttons `#submodule` `#ui` `P4`

---

## Phase 11: Reflog Enhancements `#git` `#ui`

- [ ] **11.ref-1** Filter reflog entries by type (checkout / commit / merge / rebase / reset) `#git` `#ui` `P3`
- [ ] **11.ref-2** Checkout repo at reflog entry (detached HEAD flow) `#git` `#ux` `P3`
- [ ] **11.ref-3** Create branch from reflog entry `#git` `#ux` `P3`
- [ ] **11.ref-4** Reflog entry count preference (default 100, configurable) `#git` `#ux` `P4`
- [ ] **11.ref-5** Persist reflog scroll position within a session `#ui` `P4`

---

## Phase 12: Theme System Enhancements `#theme`

- [ ] **12.theme-1** Per-repository theme override (stored in repo metadata) `#theme` `#ux` `P3`
- [ ] **12.theme-2** Theme hot-reload in dev mode (watch `app/madness-themes/`) `#theme` `#dx` `P4`
- [ ] **12.theme-3** Light/dark auto-switching variant for all 8 themes (system pref) `#theme` `P4`
- [ ] **12.theme-4** Theme preview in Preferences before applying `#theme` `#ux` `P3`

---

## Phase 13: Auto-Switch Monitor Improvements `#ux`

- [ ] **13.mon-1** Notification badge on the affected repo in the sidebar `#ux` `#ui` `P3`
- [ ] **13.mon-2** Configurable poll interval in Preferences → Advanced `#ux` `P3`
- [ ] **13.mon-3** Opt-out per repository (right-click menu in repo list) `#ux` `P4`
- [ ] **13.mon-4** Audit: confirm monitor does not run during push/pull to avoid race `#bug` `P2`

---

## Phase 14: Upstream Sync `#upstream`

- [ ] **14.up-1** Audit rebrand string replacements after each upstream merge `#upstream` `P2`
- [ ] **14.up-2** Track GitHub Desktop releases; cherry-pick relevant security fixes `#upstream` `#security` `P2`
- [ ] **14.up-3** Verify MadnessThemes still build after upstream CSS/SCSS changes `#upstream` `#theme` `P3`
- [ ] **14.up-4** Re-evaluate Electron version pin after each GitHub Desktop bump `#upstream` `#electron` `P3`
- [ ] **14.up-5** Keep `script/dist-info.ts` identifiers diverged from upstream `#upstream` `#refactor` `P3`

---

## Testing Coverage for Madness Features `#testing`

Areas not covered by the upstream `docs/process/testing.md` checklist:

- [ ] **T-1** Hook enable/disable state persists across app restart `#testing` `#hooks` `P2`
- [ ] **T-2** Hook log entries appear in Changes sidebar after each commit `#testing` `#hooks` `P2`
- [ ] **T-3** Stepped push shows per-submodule label in correct sequence `#testing` `#submodule` `P2`
- [ ] **T-4** Stepped pull mirrors stepped push ordering `#testing` `#submodule` `P2`
- [ ] **T-5** Submodule push failure surfaces actionable error, does not hang `#testing` `#submodule` `P2`
- [ ] **T-6** Auto-switch monitor fires within one polling interval of a new commit `#testing` `P3`
- [ ] **T-7** Reflog tab loads entries; show-reflog-tab preference persists on restart `#testing` `P3`
- [ ] **T-8** MadnessTheme applies correctly on cold start (no flash of default theme) `#testing` `#theme` `P3`
- [ ] **T-9** madhub CLI resolves to the correct repository root `#testing` `P3`
- [ ] **T-10** Invalid date in reflog shows 'unknown' without crash (regression: cc13b9f) `#testing` `#bug` `P2`
- [ ] **T-11** MCP sidebar badge shows 0 gracefully when Omnispindle is unreachable `#testing` `#mcp` `P2`
- [ ] **T-12** Windows: OpenSSH path resolution does not crash startup `#testing` `#windows` `P3`

---

## Item Counts

| Phase | Items | Tags |
|-------|-------|------|
| 7 — Omnispindle MCP | 8 | `#mcp` `#hooks` |
| 8 — Bug Fixes & Debt | 26 | `#bug` `#refactor` `#git` `#security` |
| 9 — Hook Extensions | 7 | `#hooks` `#ux` |
| 10 — Submodule UX | 6 | `#submodule` |
| 11 — Reflog | 5 | `#git` `#ui` |
| 12 — Themes | 4 | `#theme` |
| 13 — Auto-Switch | 4 | `#ux` |
| 14 — Upstream Sync | 5 | `#upstream` |
| Testing | 12 | `#testing` |
| **Total** | **77** | |
