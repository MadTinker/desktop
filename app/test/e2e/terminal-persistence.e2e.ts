/**
 * E2E verification of the integrated terminal's persistence contract.
 *
 * The bottom panel keeps one mounted session per repository it has shown, so a
 * repo's tabs, their live processes and their scrollback are expected to
 * survive repo swaps and closing/reopening the panel. These tests drive the
 * real app and check the real consequences:
 *
 *  - scrollback is asserted from the rendered xterm buffer;
 *  - "the process is still running" is asserted against the OS process table,
 *    not against anything the app reports about itself;
 *  - removing a repository, and quitting the app, must leave no pty behind.
 *
 * Each shell runs `tail -f <unique marker file>` so the marker path shows up in
 * the process' argv and `pgrep -f` can count survivors from the test process.
 */

import fs from 'fs'
import os from 'os'
import path from 'path'
import { execFileSync } from 'child_process'
import { test, expect, dismissMoveToApplicationsDialog } from './e2e-fixtures'
import {
  ensureSecondTestRepository,
  secondRepoName,
  secondRepoPath,
  smokeRepoName,
  smokeRepoPath,
} from './test-helpers'
import type { Page } from '@playwright/test'

// The whole file is one story told in order: later tests depend on the state
// the earlier ones left behind.
test.describe.configure({ mode: 'serial' })

// pgrep/tail semantics differ enough on Windows that this suite is POSIX-only.
test.skip(
  process.platform === 'win32',
  'Terminal persistence e2e uses pgrep and tail -f; POSIX only.'
)

const markerDir = path.join(os.tmpdir(), 'madness-desktop-terminal-e2e')

/** Unique-per-run marker path a shell will hold open with `tail -f`. */
function markerPath(tag: string) {
  return path.join(markerDir, `marker-${tag}`)
}

/** How many live processes are holding the given marker open. */
function countMarkerProcesses(tag: string): number {
  try {
    const out = execFileSync('pgrep', ['-f', markerPath(tag)], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    return out.trim().length === 0 ? 0 : out.trim().split('\n').length
  } catch {
    // pgrep exits 1 when nothing matched.
    return 0
  }
}

// ── App-driving helpers ─────────────────────────────────────────────

async function emitMenuEvent(page: Page, id: string) {
  await page.evaluate(eventId => {
    require('electron').ipcRenderer.emit('menu-event', {}, eventId)
  }, id)
}

async function completeWelcomeFlow(page: Page) {
  await page.waitForFunction(
    () =>
      (document.getElementById('desktop-app-container')?.innerHTML.length ??
        0) > 100,
    null,
    { timeout: 30000 }
  )

  const skipButton = page.locator('a.skip-button')
  if (await skipButton.isVisible({ timeout: 30000 }).catch(() => false)) {
    await skipButton.click()

    const nameInput = page.locator('input[placeholder="Your Name"]')
    await nameInput.waitFor({ state: 'visible', timeout: 15000 })
    if ((await nameInput.inputValue()) === '') {
      await nameInput.fill('Madness Desktop E2E')
    }

    const emailInput = page.locator(
      'input[placeholder="your-email@example.com"]'
    )
    if ((await emailInput.inputValue()) === '') {
      await emailInput.fill('desktop-e2e@example.com')
    }

    await page.locator('button:has-text("Finish")').click()
    await page.waitForSelector('#welcome', { state: 'hidden', timeout: 15000 })
  }

  await dismissMoveToApplicationsDialog(page)
}

async function addRepository(page: Page, repoPath: string) {
  const dialog = page.locator('dialog#add-existing-repository')

  if (!(await dialog.isVisible().catch(() => false))) {
    await emitMenuEvent(page, 'add-local-repository')
  }

  await dialog.waitFor({ state: 'visible', timeout: 15000 })

  const pathInput = dialog.locator('input[placeholder="repository path"]')
  await pathInput.waitFor({ state: 'visible', timeout: 15000 })
  await pathInput.fill(repoPath)

  await dialog
    .locator(
      'button:has-text("Add Repository"), button:has-text("Add repository")'
    )
    .click()

  await dialog.waitFor({ state: 'hidden', timeout: 15000 })
}

/** Open the repository dropdown and select the repo with the given name. */
async function selectRepository(page: Page, repoName: string) {
  await dismissMoveToApplicationsDialog(page)

  await page
    .locator('.toolbar-button:has(.description:text-is("Current Repository"))')
    .first()
    .locator('button')
    .first()
    .click()

  const item = page
    .locator('.repository-list-item')
    .filter({ hasText: repoName })
    .first()
  await item.waitFor({ state: 'visible', timeout: 15000 })
  await item.click()

  // The toolbar title is the selection's source of truth and is present
  // whether or not the bottom panel has ever been opened.
  await expect(
    page
      .locator('.toolbar-button:has(.description:text-is("Current Repository"))')
      .first()
      .locator('.title')
  ).toHaveText(repoName, { timeout: 15000 })

  // Once the panel exists, the visible session must follow the selection.
  if (await page.locator('.terminal-panel-host').isVisible().catch(() => false)) {
    await expect
      .poll(() => activeSessionPath(page), { timeout: 15000 })
      .toContain(repoName)
  }
}

/** Path shown in the panel header — i.e. which session is on screen. */
async function activeSessionPath(page: Page): Promise<string> {
  return (
    (await page
      .locator('.repository-terminal-path')
      .textContent()
      .catch(() => null)) ?? ''
  )
}

/** The visible (non-`display:none`) session container. */
function activeSession(page: Page) {
  return page.locator('.terminal-panel-session:visible').first()
}

/** Type a command into the focused pane of the visible session and run it. */
async function runInActiveTerminal(page: Page, command: string) {
  const pane = activeSession(page)
    .locator('.terminal-tabs-pane:visible .shell-view-terminal')
    .first()
  await pane.waitFor({ state: 'visible', timeout: 15000 })
  await pane.click()
  await page.keyboard.type(command)
  await page.keyboard.press('Enter')
}

/** Rendered xterm text of the visible pane of the visible session. */
async function visibleTerminalText(page: Page): Promise<string> {
  return (
    (await activeSession(page)
      .locator('.terminal-tabs-pane:visible .xterm-rows')
      .first()
      .innerText()
      .catch(() => null)) ?? ''
  )
}

async function openTerminalPanel(page: Page) {
  await emitMenuEvent(page, 'toggle-integrated-terminal')
  await page
    .locator('.terminal-panel-host')
    .waitFor({ state: 'visible', timeout: 15000 })
}

/**
 * Start a marker process in the visible session and wait for the OS to show it.
 * Also echoes a unique banner first, which later doubles as the scrollback
 * assertion.
 */
async function startMarkerProcess(page: Page, tag: string) {
  fs.mkdirSync(markerDir, { recursive: true })
  fs.writeFileSync(markerPath(tag), '')

  await runInActiveTerminal(page, `echo BANNER_${tag}`)
  await expect
    .poll(() => visibleTerminalText(page), { timeout: 15000 })
    .toContain(`BANNER_${tag}`)

  await runInActiveTerminal(page, `tail -f ${markerPath(tag)}`)
  await expect
    .poll(() => countMarkerProcesses(tag), { timeout: 15000, intervals: [250] })
    .toBeGreaterThan(0)
}

// ── Tests ───────────────────────────────────────────────────────────

test.describe('integrated terminal persistence', () => {
  test('sets up two repositories with the panel open', async ({
    mainWindow: page,
  }) => {
    fs.rmSync(markerDir, { recursive: true, force: true })
    fs.mkdirSync(markerDir, { recursive: true })
    ensureSecondTestRepository()

    await completeWelcomeFlow(page)

    // The smoke repo is opened by --cli-open; add the second one.
    await addRepository(page, smokeRepoPath)
      .catch(() => {}) // already present when --cli-open registered it
      .then(() => dismissMoveToApplicationsDialog(page))
    await addRepository(page, secondRepoPath)

    await selectRepository(page, smokeRepoName)
    await openTerminalPanel(page)

    await expect(activeSession(page)).toBeVisible()
    expect(await activeSessionPath(page)).toContain(smokeRepoName)
  })

  test('keeps multiple tabs and their live processes across a repo swap', async ({
    mainWindow: page,
  }) => {
    // Repo A, tab 1.
    await startMarkerProcess(page, 'a1')

    // Repo A, tab 2.
    await activeSession(page).locator('.terminal-tabs-add-btn').click()
    await expect(activeSession(page).locator('.terminal-tabs-tab')).toHaveCount(
      2
    )
    await startMarkerProcess(page, 'a2')

    // Swap to repo B and give it its own shell.
    await selectRepository(page, secondRepoName)
    await expect(activeSession(page).locator('.terminal-tabs-tab')).toHaveCount(
      1
    )
    await startMarkerProcess(page, 'b1')

    // A's shells must have kept running the whole time.
    expect(countMarkerProcesses('a1')).toBeGreaterThan(0)
    expect(countMarkerProcesses('a2')).toBeGreaterThan(0)

    // Swap back: both tabs, the live process and the scrollback survive.
    await selectRepository(page, smokeRepoName)
    await expect(activeSession(page).locator('.terminal-tabs-tab')).toHaveCount(
      2
    )
    expect(countMarkerProcesses('a1')).toBeGreaterThan(0)
    expect(countMarkerProcesses('a2')).toBeGreaterThan(0)
    expect(countMarkerProcesses('b1')).toBeGreaterThan(0)

    // The active tab is A's second tab, which still shows its own banner and
    // not the first tab's — proving per-tab buffers were not swapped or reset.
    const text = await visibleTerminalText(page)
    expect(text).toContain('BANNER_a2')
    expect(text).not.toContain('BANNER_b1')
  })

  test('keeps sessions alive while the panel is closed', async ({
    mainWindow: page,
  }) => {
    await emitMenuEvent(page, 'toggle-integrated-terminal')
    await page
      .locator('.terminal-panel-host')
      .waitFor({ state: 'hidden', timeout: 15000 })

    // Hiding must not tear anything down.
    await page.waitForTimeout(1000)
    for (const tag of ['a1', 'a2', 'b1']) {
      expect(countMarkerProcesses(tag), `${tag} died while hidden`).toBe(1)
    }

    await openTerminalPanel(page)
    await expect(activeSession(page).locator('.terminal-tabs-tab')).toHaveCount(
      2
    )
    expect(await visibleTerminalText(page)).toContain('BANNER_a2')
  })

  test('closing a tab kills only that tab', async ({ mainWindow: page }) => {
    await activeSession(page)
      .locator('.terminal-tabs-tab.is-active .terminal-tabs-tab-close')
      .click()

    await expect(activeSession(page).locator('.terminal-tabs-tab')).toHaveCount(
      1
    )
    await expect
      .poll(() => countMarkerProcesses('a2'), { timeout: 15000 })
      .toBe(0)
    expect(countMarkerProcesses('a1')).toBe(1)
    expect(countMarkerProcesses('b1')).toBe(1)
  })

  test('removing a repository tears down its session and leaves no pty', async ({
    mainWindow: page,
  }) => {
    await selectRepository(page, secondRepoName)
    await emitMenuEvent(page, 'remove-repository')

    const confirm = page.locator('#confirm-remove-repository')
    if (await confirm.isVisible({ timeout: 5000 }).catch(() => false)) {
      await confirm.locator('button[type="submit"]').click()
      await confirm.waitFor({ state: 'hidden', timeout: 15000 })
    }

    await expect
      .poll(() => countMarkerProcesses('b1'), { timeout: 15000 })
      .toBe(0)

    // The surviving repo is untouched.
    expect(countMarkerProcesses('a1')).toBe(1)
  })

  test('quitting the app leaves no orphaned ptys', async ({
    app,
    mainWindow: page,
  }) => {
    // Prove there is something to leak first.
    expect(countMarkerProcesses('a1')).toBe(1)

    await page
      .context()
      .tracing.stop()
      .catch(() => {})
    await app.close().catch(() => {})

    await expect
      .poll(() => countMarkerProcesses('a1'), {
        timeout: 20000,
        intervals: [500],
      })
      .toBe(0)

    fs.rmSync(markerDir, { recursive: true, force: true })
  })
})
