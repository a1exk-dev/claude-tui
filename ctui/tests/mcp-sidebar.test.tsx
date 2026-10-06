import type { On, ToolInfo } from 'claude-code'
import { type Engine, expect, mock, test } from 'claude-code/testing'

import mcp from '../plugins/mcp'
import type { McpRow } from '../types'

// The `mcp` Sidebar plugin: its view with sample rows, and a scenario where
// `.claude.json`'s disabled list drives `off` through register.tsx's hooks.

const ROWS: McpRow[] = [
  { server: 'playwright', label: 'playwright', state: 'ok', tools: 22 },
  { server: 'github', label: 'github', state: 'off' },
  { server: 'claude_ai_Claude_Docs', label: 'Claude Docs', state: 'ok', tools: 1 },
  { server: 'sentry', label: 'sentry', state: 'down' },
  { server: 'authy', label: 'authy', state: 'auth' },
  { server: 'linear', label: 'linear', state: 'connecting', since: 0 },
]

const PANE = {
  surface: 'terminal',
  component: 'Pane',
  props: {
    title: 'Sidebar',
    isFocused: false,
    bodyColumns: 42,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

// Draws the view's rows, or the folded summary, in a test Pane.
async function draw($: Engine, on: On, part: 'view' | 'summary', rows: McpRow[]) {
  on('ui.render', { component: 'Pane', requestId: 'unit' }, async ($, e) => {
    const ui = $.ui.resolve(e)
    const drawn =
      part === 'view'
        ? mcp.view({ mcp: rows }, ui, { enable: true }, 36)
        : mcp.summary?.({ mcp: rows }, ui, { enable: true }, 36)
    return <ui.Box flexDirection="column">{drawn}</ui.Box>
  })
  return $.ui.mount({ ...PANE, plugin: 'test', requestId: 'unit' })
}

// The text of each MCP row: a Box spreading the label and the state.
async function rowsOf(pane: Awaited<ReturnType<typeof draw>>) {
  const boxes = await pane.findAll({ type: 'Box' })
  return boxes
    .filter((box) => box.props.justifyContent === 'space-between' && /^[●!◐✕○]/.test(box.text))
    .map((box) => box.text.replace(/\s+/g, ' '))
}

test('each row: the glyph in its color, the label, the state at the right; off rows last', async ($, on) => {
  const pane = await draw($, on, 'view', ROWS)
  expect(await rowsOf(pane)).toEqual([
    '● playwright22 tools',
    '● Claude Docs1 tool',
    '✕ sentrydown',
    '! authyneeds auth',
    '◐ linearconnecting',
    '○ githuboff',
  ])
  const color = async (text: string) => {
    // A string query matches inside a longer text: match it whole.
    const found = await pane.find({ type: 'Text', text: new RegExp(`^${text}$`) })
    return found?.props.color ?? (found?.props.dimColor ? 'dim' : undefined)
  }
  expect(await Promise.all(['●', '!', '◐', '✕', '○'].map(color))).toEqual([
    'success',
    'warning',
    'warning',
    'error',
    'inactive',
  ])
  expect(await Promise.all(['22 tools', 'needs auth', 'connecting', 'down', 'off'].map(color))).toEqual([
    'dim',
    'warning',
    'warning',
    'error',
    'inactive',
  ])
})

test('the header counts ● rows over listed rows', () => {
  const ui = {} as never
  expect(mcp.count?.({ mcp: ROWS }, ui, { enable: true }, 36)).toBe('2/6')
  expect(mcp.count?.({ mcp: [] }, ui, { enable: true }, 36)).toBe('0/0')
})

test('folded, each state present with its count, in its color, in glyph order', async ($, on) => {
  const pane = await draw($, on, 'summary', [...ROWS, { server: 'x', label: 'x', state: 'ok', tools: 3 }])
  const parts = await pane.findAll({ type: 'Text', text: /^ ?[●!◐✕○] \d$/ })
  expect(parts.map((part) => [part.text.trim(), part.props.color])).toEqual([
    ['● 3', 'success'],
    ['! 1', 'warning'],
    ['◐ 1', 'warning'],
    ['✕ 1', 'error'],
    ['○ 1', 'inactive'],
  ])
  expect(mcp.summary?.({ mcp: [] }, {} as never, { enable: true }, 36)).toBeUndefined()
})

// Scenario: the Sidebar through register.tsx's hooks.

const HOME = '/home/a'
const CLAUDE_JSON = `${HOME}/.claude.json`
const tools = (server: string, count: number): ToolInfo[] =>
  Array.from({ length: count }, (_, i) => ({ name: `mcp__${server}__t${i}`, description: '', mcp: true }))

// The world beneath the plugin: a session in /srv/x/app inside the repo
// /srv/x, a tool list and a `~/.claude.json` the test changes.
function host(on: On, world: { tools: ToolInfo[]; json: string; mtimeMs: number }, path = CLAUDE_JSON) {
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('session.cwd', () => ({ value: '/srv/x/app' }))
  on('session.version', () => ({ value: { version: '2.1.288' } }))
  on('session.usage', () => ({
    value: { startedAt: 0, context: { window: 200000 }, rateLimits: [], cost: { usd: 0 } },
  }))
  on('process.run', () => ({
    value: { exitCode: 128, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false },
  }))
  on('fs.exists', (_, e) => ({ value: e.path === '/srv/x/.git' }))
  on('fs.stat', (_, e) => {
    if (e.path !== path) throw new Error('ENOENT')
    return { value: { kind: 'file', size: world.json.length, mtimeMs: world.mtimeMs, isLink: false } }
  })
  on('fs.read', (_, e) => ({ value: e.path === path ? world.json : '{ "version": "0.0.0" }' }))
  on('tool.list', () => ({ value: [{ name: 'Bash', description: '', mcp: false }, ...world.tools] }))
  on('tool.describe', (_, e) => ({ description: e.description }))
  // ctui sets CLAUDE_CODE_ENABLE_TODO_TOOLS at start.
  on('env.set', () => ({ value: undefined }))
}

// `~/.claude.json` as Claude Code writes it, trimmed to the keys read, with
// another project's list that must not count.
const claudeJson = (disabled: string[]) =>
  JSON.stringify({
    numStartups: 12,
    projects: {
      '/srv/x': { allowedTools: [], disabledMcpServers: disabled },
      '/srv/x/app': { disabledMcpServers: ['playwright'] },
    },
  })

test('/mcp disable and enable follow within a second, labels as /mcp names them', async ($, on) => {
  const clock = mock.clock(on, { now: 0 })
  mock.env(on, { HOME, MCP_TIMEOUT: '10000' })
  const world = {
    tools: [...tools('playwright', 22), ...tools('claude_ai_Claude_Docs', 2)],
    json: claudeJson(['github']),
    mtimeMs: 1,
  }
  host(on, world)
  await $.session.start({ cwd: '/srv/x/app', surface: 'terminal', isInteractive: true })
  await $.tool.describe({
    tool: 'mcp__claude_ai_Claude_Docs__t0',
    description: '',
    provider: { plugin: 'mcp:claude.ai Claude Docs', tier: 'user' },
  })
  await clock.advance(1000)
  const pane = await $.ui.mount({ ...PANE, plugin: 'ctui', requestId: 'sidebar' })
  const rows = () => rowsOf(pane)
  expect(await rows()).toEqual(['● playwright22 tools', '● Claude Docs2 tools', '○ githuboff'])
  expect(await pane.find({ type: 'Text', text: '2/3' })).toBeDefined()

  // `/mcp disable playwright`: its tools go and the file lists it.
  world.tools = tools('claude_ai_Claude_Docs', 2)
  world.json = claudeJson(['github', 'playwright'])
  world.mtimeMs = 2
  await clock.advance(1000)
  await pane.redraw()
  expect(await rows()).toEqual(['● Claude Docs2 tools', '○ playwrightoff', '○ githuboff'])

  // `/mcp enable playwright`: it connects until its tools come back.
  world.json = claudeJson(['github'])
  world.mtimeMs = 3
  await clock.advance(1000)
  await pane.redraw()
  expect(await rows()).toEqual(['◐ playwrightconnecting', '● Claude Docs2 tools', '○ githuboff'])
  world.tools = [...tools('playwright', 22), ...tools('claude_ai_Claude_Docs', 2)]
  await clock.advance(1000)
  await pane.redraw()
  expect(await rows()).toEqual(['● playwright22 tools', '● Claude Docs2 tools', '○ githuboff'])

  // A server that drops its tools reads down after MCP_TIMEOUT.
  world.tools = tools('playwright', 22)
  await clock.advance(1000)
  await pane.redraw()
  expect((await rows())[1]).toBe('◐ Claude Docsconnecting')
  await clock.advance(10_000)
  await pane.redraw()
  expect((await rows())[1]).toBe('✕ Claude Docsdown')

  await pane.press({ key: 'fold-mcp' })
  const summary = await pane.findAll({ type: 'Text', text: /^ ?[●✕○] \d$/ })
  expect(summary.map((part) => part.text.trim())).toEqual(['● 1', '✕ 1', '○ 1'])
})

test('with CLAUDE_CONFIG_DIR set, the disabled list comes from the .claude.json there', async ($, on) => {
  const clock = mock.clock(on, { now: 0 })
  mock.env(on, { HOME, CLAUDE_CONFIG_DIR: '/cfg' })
  host(on, { tools: [], json: claudeJson(['github']), mtimeMs: 1 }, '/cfg/.claude.json')
  await $.session.start({ cwd: '/srv/x/app', surface: 'terminal', isInteractive: true })
  await clock.advance(1000)
  const pane = await $.ui.mount({ ...PANE, plugin: 'ctui', requestId: 'sidebar' })
  expect(await rowsOf(pane)).toEqual(['○ githuboff'])
})
