// The step vocabulary. One step is one line of text, so `once` reads it from a file and `serve` from a fifo.
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Terminal } from '@xterm/headless'
import { cells, dump, dumpbg, grep, rowText, runs } from './screen.ts'

/** What a step can do to a running session. `harness.ts` builds it around one pty and one parsed screen. */
export interface Session {
  readonly term: Terminal
  /** The seeded CLAUDE_CONFIG_DIR, which `setopt` and `setting` edit to trigger a live reload. */
  readonly configDir: string
  /** The `pluginConfigs` key the session's ctui runs under: `ctui@inline` under `--plugin-dir`. */
  readonly pluginKey: string
  /** Send bytes to the child. */
  write(data: string): void
  /** Resize the pty and the parsed screen together, so the child sees SIGWINCH. */
  resize(cols: number, rows: number): void
  /** Read the child's output for this many seconds, then settle the screen. */
  pump(seconds: number): Promise<void>
  /** Stop the child. */
  quit(): void
}

const escapes: Record<string, string> = { n: '\n', r: '\r', t: '\t', e: '\x1b', '0': '\0', '\\': '\\' }

/** `\x1b[B`, `\x18\t`, `\e[A`: the escapes a key step is written with. */
const unescape = (text: string): string =>
  text.replace(/\\(?:x([0-9a-fA-F]{2})|u([0-9a-fA-F]{4})|(.))/g, (_, hex: string, unicode: string, char: string) => {
    if (hex ?? unicode) return String.fromCharCode(parseInt(hex ?? unicode, 16))
    return escapes[char] ?? char
  })

const numbers = (arg: string, count: number): number[] => {
  const values = arg.split(/\s+/).filter(Boolean).map(Number)
  if (values.length !== count || values.some(Number.isNaN)) {
    throw new Error(`expected ${count} numbers, got ${JSON.stringify(arg)}`)
  }
  return values
}

const settingsPath = (session: Session) => join(session.configDir, 'settings.json')
const readSettings = (session: Session) => JSON.parse(readFileSync(settingsPath(session), 'utf8')) as Record<string, unknown>
const writeSettings = (session: Session, settings: Record<string, unknown>) =>
  writeFileSync(settingsPath(session), `${JSON.stringify(settings, null, 2)}\n`)

const branch = (parent: Record<string, unknown>, key: string): Record<string, unknown> => {
  const next = parent[key]
  if (next && typeof next === 'object' && !Array.isArray(next)) return next as Record<string, unknown>
  const fresh: Record<string, unknown> = {}
  parent[key] = fresh
  return fresh
}

/** An SGR mouse report, as a terminal sends one: button 0 clicks, 35 moves, 64/65 wheel up/down. */
const mouse = (session: Session, button: number, col: number, row: number, press = true) =>
  session.write(`\x1b[<${button};${col + 1};${row + 1}${press ? 'M' : 'm'}`)

const found = (session: Session, needle: string): boolean => {
  for (let y = 0; y < session.term.rows; y++) if (rowText(session.term, y).includes(needle)) return true
  return false
}

/**
 * Run one step and return the lines it printed. Throws on a bad step, which the driver reports without
 * ending the session: a mistyped step in the middle of a scenario must not cost another engine boot.
 */
export const runStep = async (session: Session, line: string): Promise<string[]> => {
  const [command = '', arg = ''] = ((): [string, string] => {
    const space = line.indexOf(' ')
    return space < 0 ? [line, ''] : [line.slice(0, space), line.slice(space + 1)]
  })()
  switch (command) {
    case 'wait':
      await session.pump(Number(arg))
      return []
    case 'print':
      return [arg]
    case 'type':
      session.write(arg)
      await session.pump(0.6)
      return []
    case 'enter':
      session.write('\r')
      await session.pump(1)
      return []
    case 'key':
      session.write(unescape(arg))
      await session.pump(0.8)
      return []
    case 'click': {
      const [col, row] = numbers(arg, 2) as [number, number]
      mouse(session, 0, col, row)
      await session.pump(0.2)
      mouse(session, 0, col, row, false)
      await session.pump(1.5)
      return []
    }
    case 'move': {
      const [col, row] = numbers(arg, 2) as [number, number]
      mouse(session, 35, col, row)
      await session.pump(1)
      return []
    }
    case 'wheel': {
      const [position, direction] = [arg.slice(0, arg.lastIndexOf(' ')), arg.slice(arg.lastIndexOf(' ') + 1)]
      const [col, row] = numbers(position, 2) as [number, number]
      if (direction !== 'up' && direction !== 'down') throw new Error(`wheel takes up or down, got ${direction}`)
      mouse(session, direction === 'up' ? 64 : 65, col, row)
      await session.pump(0.8)
      return []
    }
    case 'resize': {
      const [cols, rows] = numbers(arg, 2) as [number, number]
      session.resize(cols, rows)
      await session.pump(3)
      return []
    }
    case 'setopt': {
      // A ctui option, written where /config writes it. The engine reloads the mod when the file changes.
      const [key, value] = [arg.slice(0, arg.indexOf('=')), arg.slice(arg.indexOf('=') + 1)]
      const settings = readSettings(session)
      branch(branch(branch(settings, 'pluginConfigs'), session.pluginKey), 'options')[key] = JSON.parse(value)
      writeSettings(session, settings)
      await session.pump(4)
      return []
    }
    case 'setting': {
      const [key, value] = [arg.slice(0, arg.indexOf('=')), arg.slice(arg.indexOf('=') + 1)]
      const settings = readSettings(session)
      settings[key] = JSON.parse(value)
      writeSettings(session, settings)
      await session.pump(4)
      return []
    }
    case 'sh': {
      const result = spawnSync('bash', ['-c', arg], { encoding: 'utf8' })
      await session.pump(1)
      return `${result.stdout ?? ''}${result.stderr ?? ''}`.split('\n').filter(Boolean)
    }
    case 'dump':
      return dump(session.term)
    case 'dumpbg':
      return dumpbg(session.term)
    case 'grep':
      return grep(session.term, arg)
    case 'cells': {
      const [row, from, to] = numbers(arg, 3) as [number, number, number]
      return cells(session.term, row, from, to)
    }
    case 'runs':
      return runs(session.term, numbers(arg, 1)[0]!)
    case 'watch': {
      // How long something took to appear, in ms: the cold-cache cost row's arrival is this step's measurement.
      const space = arg.indexOf(' ')
      const timeout = Number(arg.slice(0, space)) * 1000
      const needle = arg.slice(space + 1)
      const start = Date.now()
      while (Date.now() - start < timeout) {
        await session.pump(0.05)
        if (found(session, needle)) return [`  watch ${JSON.stringify(needle)}: found after ${Date.now() - start} ms`]
      }
      return [`  watch ${JSON.stringify(needle)}: NOT FOUND in ${timeout} ms`]
    }
    case 'anim': {
      // Samples the rows holding a needle over time, for a spinner: that the glyph changes, never its frame rate.
      const [count, interval] = [Number(arg.split(' ')[0]), Number(arg.split(' ')[1])]
      const needle = arg.split(' ').slice(2).join(' ')
      const out: string[] = []
      for (let sample = 0; sample < count; sample++) {
        await session.pump(interval)
        out.push(`  ${Date.now() % 100000} ${JSON.stringify(grep(session.term, needle).map((row) => row.slice(4)))}`)
      }
      return out
    }
    case 'quit':
      session.quit()
      return ['bye']
    default:
      throw new Error(`unknown step ${JSON.stringify(command)}`)
  }
}
