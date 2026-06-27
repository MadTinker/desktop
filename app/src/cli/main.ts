import { join, resolve } from 'path'
import parse from 'minimist'
import { execFile, spawn } from 'child_process'

const run = (...args: Array<string>) => {
  function cb(e: unknown | null, stderr?: string) {
    if (e) {
      console.error(`Error running command ${args}`)
      console.error(stderr ?? `${e}`)
      process.exit(
        typeof e === 'object' && 'code' in e && typeof e.code === 'number'
          ? e.code
          : 1
      )
    }
  }

  if (process.platform === 'darwin') {
    execFile('open', ['-n', join(__dirname, '../../..'), '--args', ...args], cb)
  } else if (process.platform === 'win32') {
    const exeName = `MadnessDesktop${__DEV__ ? '-dev' : ''}.exe`
    spawn(join(__dirname, `../../${exeName}`), args, {
      detached: true,
      stdio: 'ignore',
    })
      .on('error', cb)
      .on('exit', code => (process.exitCode = code ?? process.exitCode))
      .unref()
  } else {
    throw new Error('Unsupported platform')
  }
}

const args = parse(process.argv.slice(2), {
  alias: { help: 'h', branch: 'b', group: 'g' },
  boolean: ['help'],
  string: ['group'],
})

const usage = (exitCode = 1): never => {
  process.stderr.write(
    'Madness Desktop CLI usage: \n' +
      '  madhub                              Open the current directory\n' +
      '  madhub open [path]                  Open the provided path\n' +
      '  madhub add [path] -g <group>        Add the repo to the list and file it\n' +
      '                                      under <group> (created if it is new)\n' +
      '  madhub clone [-b branch] [-g group] Clone the repository by url or name/owner\n' +
      '         <url>                        (ex torvalds/linux), optionally checking\n' +
      '                                      out the branch and filing it under a group\n' +
      '  madhub sub <init|pull|push> [path]  Run a repo-wide submodule op: init all,\n' +
      '                                      pull all, or push all submodules\n' +
      '  madhub upgrade                      Download and install the latest release\n'
  )
  process.exit(exitCode)
}

const SUBMODULE_OPS = ['init', 'pull', 'push']

delete process.env.ELECTRON_RUN_AS_NODE

if (args.help || args._.at(0) === 'help') {
  usage(0)
} else if (args._.at(0) === 'clone') {
  const urlArg = args._.at(1)
  // Assume name with owner slug if it looks like it
  const url =
    urlArg && /^[^\/]+\/[^\/]+$/.test(urlArg)
      ? `https://github.com/${urlArg}`
      : urlArg

  if (!url) {
    usage(1)
  } else {
    const flags = [`--cli-clone=${url}`]
    if (typeof args.branch === 'string') {
      flags.push(`--cli-branch=${args.branch}`)
    }
    if (typeof args.group === 'string' && args.group.length > 0) {
      flags.push(`--cli-group=${args.group}`)
    }
    run(...flags)
  }
} else if (args._.at(0) === 'add') {
  const group = typeof args.group === 'string' ? args.group : undefined
  if (!group) {
    process.stderr.write('madhub add: -g/--group <name> is required\n')
    usage(1)
  }
  const path = resolve(args._.at(1) ?? '.')
  run(`--cli-add=${path}`, `--cli-group=${group}`)
} else if (args._.at(0) === 'sub') {
  const op = args._.at(1)
  if (typeof op !== 'string' || !SUBMODULE_OPS.includes(op)) {
    process.stderr.write(
      `madhub sub: expected one of ${SUBMODULE_OPS.join('|')}\n`
    )
    usage(1)
  }
  const path = resolve(args._.at(2) ?? '.')
  run(`--cli-submodule=${op}`, `--cli-submodule-path=${path}`)
} else {
  const [firstArg, secondArg] = args._
  const pathArg = firstArg === 'open' ? secondArg : firstArg
  const path = resolve(pathArg ?? '.')
  run(`--cli-open=${path}`)
}
