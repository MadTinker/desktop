/* eslint-disable no-sync */

import { execFileSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'

export const smokeRepoPath = path.join(
  os.tmpdir(),
  'github-desktop-e2e-smoke-repository'
)
export const smokeRepoName = path.basename(smokeRepoPath)
export const smokeRepoFileName = 'smoke-change.txt'
export const smokeRepoFileContents =
  'This file should appear in the changes list.'

export function ensureSmokeTestRepository() {
  fs.rmSync(smokeRepoPath, { recursive: true, force: true })
  fs.mkdirSync(smokeRepoPath, { recursive: true })

  runGit(['init'], smokeRepoPath)
  runGit(['config', 'user.name', 'Madness Desktop E2E'], smokeRepoPath)
  runGit(['config', 'user.email', 'desktop-e2e@example.com'], smokeRepoPath)

  fs.writeFileSync(
    path.join(smokeRepoPath, 'README.md'),
    '# Madness Desktop Smoke Repo\n'
  )

  runGit(['add', 'README.md'], smokeRepoPath)
  runGit(['commit', '-m', 'Initial commit'], smokeRepoPath)

  fs.writeFileSync(
    path.join(smokeRepoPath, smokeRepoFileName),
    `${smokeRepoFileContents}\n`
  )
}

function runGit(args: ReadonlyArray<string>, cwd: string) {
  execFileSync('git', [...args], {
    cwd,
    stdio: 'ignore',
  })
}

function readGitOutput(args: ReadonlyArray<string>, cwd: string) {
  return execFileSync('git', [...args], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim()
}

export function getSmokeRepoStatus() {
  return readGitOutput(['status', '--short'], smokeRepoPath)
}

export function getSmokeRepoHeadMessage() {
  return readGitOutput(['log', '-1', '--pretty=%s'], smokeRepoPath)
}

export function getSmokeRepoCurrentBranch() {
  return readGitOutput(['branch', '--show-current'], smokeRepoPath)
}

// ── Second repository (terminal persistence tests) ──────────────────

export const secondRepoPath = path.join(
  os.tmpdir(),
  'github-desktop-e2e-second-repository'
)
export const secondRepoName = path.basename(secondRepoPath)

/**
 * A second, minimal repository. The terminal-persistence suite needs two
 * repositories so it can swap between them and prove each keeps its own live
 * shells.
 */
export function ensureSecondTestRepository() {
  fs.rmSync(secondRepoPath, { recursive: true, force: true })
  fs.mkdirSync(secondRepoPath, { recursive: true })

  runGit(['init'], secondRepoPath)
  runGit(['config', 'user.name', 'Madness Desktop E2E'], secondRepoPath)
  runGit(['config', 'user.email', 'desktop-e2e@example.com'], secondRepoPath)

  fs.writeFileSync(
    path.join(secondRepoPath, 'README.md'),
    '# Madness Desktop Second Repo\n'
  )

  runGit(['add', 'README.md'], secondRepoPath)
  runGit(['commit', '-m', 'Initial commit'], secondRepoPath)
}
