import { join } from 'path'
import { spawn, SpawnOptions } from 'child_process'
import * as Fs from 'fs'
import { getDistPath, getExecutableName } from './dist-info'

const distPath = getDistPath()
const productName = getExecutableName()
const projectRoot = join(__dirname, '..')

let binaryPath = ''
if (process.platform === 'darwin') {
  binaryPath = join(
    distPath,
    `${productName}.app`,
    'Contents',
    'MacOS',
    `${productName}`
  )
} else if (process.platform === 'win32') {
  binaryPath = join(distPath, `${productName}.exe`)
} else if (process.platform === 'linux') {
  binaryPath = join(distPath, productName)
} else {
  console.error(`I dunno how to run on ${process.platform} ${process.arch} :(`)
  process.exit(1)
}

export function run(spawnOptions: SpawnOptions) {
  const opts = Object.assign({}, spawnOptions)

  opts.env = Object.assign(opts.env || {}, process.env, {
    NODE_ENV: 'development',
  })

  // Dev mode: launch electron directly on out/ so we always use latest compiled code
  // without needing a full electron-packager build
  if (process.env.NODE_ENV === 'development') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const electronPath = require('electron') as unknown as string
    const outPath = join(projectRoot, 'out')
    if (Fs.existsSync(join(outPath, 'main.js'))) {
      return spawn(electronPath, [outPath], opts)
    }
  }

  // Production / fallback: use the packaged binary
  try {
    // eslint-disable-next-line no-sync
    const stats = Fs.statSync(binaryPath)
    if (!stats.isFile()) {
      return null
    }
  } catch (e) {
    return null
  }

  return spawn(binaryPath, [], opts)
}
