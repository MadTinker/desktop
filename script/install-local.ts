/// <reference path="./globals.d.ts" />

import * as cp from 'child_process'
import * as fs from 'fs'
import * as path from 'path'

import { getDistPath, getExecutableName } from './dist-info'

const appName = `${getExecutableName()}.app`
const appSource = path.join(getDistPath(), appName)
const appDest = path.join('/Applications', appName)

if (!fs.existsSync(appSource)) {
  console.error(`No build found at ${appSource}`)
  console.error('Run `yarn build:prod` first.')
  process.exit(1)
}

console.log(`Installing ${appName} → /Applications/`)

if (fs.existsSync(appDest)) {
  console.log('Removing existing installation…')
  fs.rmSync(appDest, { recursive: true, force: true })
}

cp.execSync(`cp -r "${appSource}" /Applications/`, { stdio: 'inherit' })

console.log(`Done. Launch from /Applications/${appName} or Spotlight.`)
