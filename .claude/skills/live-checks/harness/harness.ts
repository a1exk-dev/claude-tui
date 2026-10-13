// Drives Claude Code in a bare pty and reads the screen back. HARNESS.md is the operator's page.
//
//   node harness.ts seed  <scenario> [--settings JSON] [--claude-json JSON] [--trust DIR] [--mcp]
//   node harness.ts once  <configDir> <cols> <rows> <steps-file> [options] [-- <claude args>]
//   node harness.ts serve <configDir> <cols> <rows> <fifo> <out>  [options] [-- <claude args>]
//   node harness.ts send  <fifo> <out> <settle-seconds>            (steps on stdin)
//
// Options: --cwd DIR, --env K=V (repeatable), --plugin-key KEY.
import { Buffer } from 'node:buffer'
import { spawnSync } from 'node:child_process'
import { appendFileSync, closeSync, constants, existsSync, openSync, readFileSync, readSync, statSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'
import headless from '@xterm/headless'
import { spawn } from 'node-pty'
import { repoRoot, seedConfigDir } from './config.ts'
import { runStep, type Session } from './steps.ts'

interface LaunchOptions {
  configDir: string
  cols: number
  rows: number
  cwd: string
  env: Record<string, string>
  pluginKey: string
  claudeArgs: string[]
}

/** The parent's own session must not leak in: a CLAUDE_* or TMUX_* variable would point the child elsewhere. */
const childEnv = (options: LaunchOptions): Record<string, string> => {
  const env: Record<string, string> = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (value === undefined || key.startsWith('CLAUDE') || key.startsWith('TMUX')) continue
    env[key] = value
  }
  return {
    ...env,
    CLAUDE_CONFIG_DIR: options.configDir,
    TERM: 'xterm-256color',
    COLORTERM: 'truecolor',
    LINES: String(options.rows),
    COLUMNS: String(options.cols),
    ...options.env,
  }
}

/** One engine boot: the pty, the screen it paints, and the steps' view of both. */
const launch = (options: LaunchOptions): Session => {
  const term = new headless.Terminal({ cols: options.cols, rows: options.rows, allowProposedApi: true })
  const pty = spawn(join(repoRoot, 'node_modules', '.bin', 'claude'), ['--plugin-dir', join(repoRoot, 'ctui'), ...options.claudeArgs], {
    name: 'xterm-256color',
    cols: options.cols,
    rows: options.rows,
    cwd: options.cwd,
    env: childEnv(options),
  })
  // The screen is only as current as the last parsed write, so every step settles on it before it reads.
  let parsed: Promise<void> = Promise.resolve()
  pty.onData((data) => {
    parsed = new Promise<void>((resolve) => term.write(data, resolve))
  })
  return {
    term,
    configDir: options.configDir,
    pluginKey: options.pluginKey,
    write: (data) => pty.write(data),
    resize: (cols, rows) => {
      term.resize(cols, rows)
      pty.resize(cols, rows)
    },
    pump: async (seconds) => {
      await delay(seconds * 1000)
      await parsed
    },
    quit: () => pty.kill(),
  }
}

const steps = (text: string): string[] =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))

/** Every step's own echo, then its lines: the operator reads one stream, whichever driver produced it. */
const report = async (session: Session, line: string, write: (text: string) => void) => {
  write(`\n$ ${line}\n`)
  try {
    for (const out of await runStep(session, line)) write(`${out}\n`)
  } catch (error) {
    write(`!! ${error instanceof Error ? error.message : String(error)}\n`)
  }
  write('--- ok\n')
}

const once = async (options: LaunchOptions, stepsFile: string) => {
  const session = launch(options)
  for (const line of steps(readFileSync(stepsFile, 'utf8'))) {
    await report(session, line, (text) => process.stdout.write(text))
    if (line === 'quit') return
  }
  session.quit()
}

/**
 * Interactive: steps arrive on a fifo, output lands in a file. Non-blocking reads keep the loop pumping the
 * child's output between steps, so the screen is current when a step the operator just chose arrives.
 */
const serve = async (options: LaunchOptions, fifo: string, out: string) => {
  if (!existsSync(fifo)) spawnSync('mkfifo', [fifo])
  const session = launch(options)
  const write = (text: string) => appendFileSync(out, text)
  const fd = openSync(fifo, constants.O_RDONLY | constants.O_NONBLOCK)
  let pending = ''
  for (;;) {
    await session.pump(0.3)
    const chunk = Buffer.alloc(4096)
    let read = 0
    try {
      read = readSync(fd, chunk, 0, chunk.length, null)
    } catch {
      read = 0
    }
    pending += chunk.subarray(0, read).toString()
    let newline = pending.indexOf('\n')
    for (; newline >= 0; newline = pending.indexOf('\n')) {
      const line = pending.slice(0, newline).trim()
      pending = pending.slice(newline + 1)
      if (!line) continue
      await report(session, line, write)
      if (line === 'quit') {
        closeSync(fd)
        return
      }
    }
  }
}

/** The operator's half of a fifo session: steps on stdin, and the output the session appended in reply. */
const send = async (fifo: string, out: string, settle: number) => {
  const before = existsSync(out) ? statSync(out).size : 0
  appendFileSync(fifo, readFileSync(0, 'utf8'))
  await delay(settle * 1000)
  const handle = openSync(out, 'r')
  const size = statSync(out).size
  const chunk = Buffer.alloc(Math.max(size - before, 0))
  readSync(handle, chunk, 0, chunk.length, before)
  closeSync(handle)
  process.stdout.write(chunk.toString())
}

const usage = (): never => {
  process.stderr.write(
    [
      'node harness.ts seed  <scenario> [--settings JSON] [--claude-json JSON] [--trust DIR] [--mcp]',
      'node harness.ts once  <configDir> <cols> <rows> <steps-file> [options] [-- <claude args>]',
      'node harness.ts serve <configDir> <cols> <rows> <fifo> <out>  [options] [-- <claude args>]',
      'node harness.ts send  <fifo> <out> <settle-seconds>            (steps on stdin)',
      'options: --cwd DIR, --env K=V (repeatable), --plugin-key KEY',
      '',
    ].join('\n'),
  )
  return process.exit(2)
}

const main = async () => {
  const argv = process.argv.slice(2)
  const command = argv.shift()
  const claudeArgs = argv.includes('--') ? argv.splice(argv.indexOf('--')).slice(1) : []
  const flag = (name: string): string[] => {
    const values: string[] = []
    for (let at = argv.indexOf(name); at >= 0; at = argv.indexOf(name)) values.push(...argv.splice(at, 2).slice(1))
    return values
  }
  const cwd = flag('--cwd').at(-1) ?? repoRoot
  const pluginKey = flag('--plugin-key').at(-1) ?? 'ctui@inline'
  const settingsFlag = flag('--settings').at(-1)
  const claudeJsonFlag = flag('--claude-json').at(-1)
  const trust = flag('--trust')
  const mcp = argv.includes('--mcp')
  if (mcp) argv.splice(argv.indexOf('--mcp'), 1)
  const env: Record<string, string> = {}
  for (const pair of flag('--env')) env[pair.slice(0, pair.indexOf('='))] = pair.slice(pair.indexOf('=') + 1)

  if (command === 'seed') {
    const [scenario] = argv
    if (!scenario) return usage()
    process.stdout.write(
      `${seedConfigDir({
        scenario,
        settings: settingsFlag ? (JSON.parse(settingsFlag) as Record<string, unknown>) : undefined,
        claudeJson: claudeJsonFlag ? (JSON.parse(claudeJsonFlag) as Record<string, unknown>) : undefined,
        trust,
        mcp,
      })}\n`,
    )
    return
  }
  if (command === 'send') {
    const [fifo, out, settle] = argv
    if (!fifo || !out) return usage()
    await send(fifo, out, Number(settle ?? 4))
    return
  }
  const [configDir, cols, rows, fourth, fifth] = argv
  if (!configDir || !cols || !rows || !fourth) return usage()
  const options: LaunchOptions = { configDir, cols: Number(cols), rows: Number(rows), cwd, env, pluginKey, claudeArgs }
  if (command === 'once') await once(options, fourth)
  else if (command === 'serve' && fifth) await serve(options, fourth, fifth)
  else return usage()
}

await main()
