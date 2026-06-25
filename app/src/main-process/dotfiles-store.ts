import { app } from 'electron'
import { promises as Fs } from 'fs'
import * as Path from 'path'

import {
  DotfileId,
  IDotfileDescriptor,
} from '../lib/dotfiles'

/**
 * Main-process resolver and read/write surface for the integrated Dotfiles
 * panel. The renderer addresses files by `id` only; this module owns the
 * mapping from id -> absolute path, so a compromised renderer can never coax
 * an arbitrary-path read or write out of us (the supplied `id` is matched
 * against a freshly-resolved descriptor set on every call).
 */

const ALIAS_CANDIDATES = ['.aliases', '.zsh_aliases', '.bash_aliases']

function isNotFound(err: unknown): boolean {
  return (err as NodeJS.ErrnoException)?.code === 'ENOENT'
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await Fs.access(path)
    return true
  } catch {
    return false
  }
}

/** Pick the first alias file that exists, defaulting to `~/.aliases`. */
async function resolveAliasPath(home: string): Promise<string> {
  for (const candidate of ALIAS_CANDIDATES) {
    const p = Path.join(home, candidate)
    if (await fileExists(p)) {
      return p
    }
  }
  return Path.join(home, ALIAS_CANDIDATES[0])
}

async function describe(
  id: DotfileId,
  label: string,
  path: string,
  mode: IDotfileDescriptor['mode']
): Promise<IDotfileDescriptor> {
  return { id, label, path, mode, exists: await fileExists(path) }
}

/** Build the descriptor set for the given repository. */
export async function resolveDescriptors(
  repoPath: string
): Promise<ReadonlyArray<IDotfileDescriptor>> {
  const home = app.getPath('home')
  const aliasPath = await resolveAliasPath(home)

  return Promise.all([
    describe('zshrc', '.zshrc', Path.join(home, '.zshrc'), 'shell'),
    describe('gitconfig', '.gitconfig', Path.join(home, '.gitconfig'), 'properties'),
    describe('aliases', Path.basename(aliasPath), aliasPath, 'shell'),
    describe(
      'repo-config',
      '.git/config',
      Path.join(repoPath, '.git', 'config'),
      'properties'
    ),
  ])
}

async function pathForId(
  repoPath: string,
  id: string
): Promise<string> {
  const descriptors = await resolveDescriptors(repoPath)
  const match = descriptors.find(d => d.id === id)
  if (match === undefined) {
    throw new Error(`Unknown dotfile id: ${id}`)
  }
  return match.path
}

/** Read a dotfile's contents by id; a missing file reads as empty. */
export async function readDotfileById(
  repoPath: string,
  id: string
): Promise<string> {
  const path = await pathForId(repoPath, id)
  try {
    return await Fs.readFile(path, 'utf8')
  } catch (err) {
    if (isNotFound(err)) {
      return ''
    }
    throw err
  }
}

/** Write a dotfile's contents by id, creating it if it doesn't exist. */
export async function writeDotfileById(
  repoPath: string,
  id: string,
  contents: string
): Promise<void> {
  const path = await pathForId(repoPath, id)
  await Fs.writeFile(path, contents, 'utf8')
}
