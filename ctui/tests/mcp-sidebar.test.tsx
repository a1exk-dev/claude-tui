import type { On, ToolInfo } from 'claude-code'
import { type Engine, expect, mock, test } from 'claude-code/testing'

import { colors } from '../plugins/colors'
import mcp from '../plugins/mcp'
import type { McpRow } from '../types'
import { clientsAsTrees } from './clients'

// The `mcp` Sidebar plugin: its view with sample rows, and a scenario where
// `.claude.json`'s disabled list drives `off` through register.tsx's hooks.

const ROWS: McpRow[] = [
  { server: 'playwright', label: 'playwright', source: 'user', state: 'ok', tools: 22 },
  { server: 'github', label: 'github', source: 'user', state: 'off' },
  { server: 'claude_ai_Claude_Docs', label: 'Claude Docs', source: 'claude.ai', state: 'ok', tools: 1 },
  { server: 'sentry', label: 'sentry', source: 'project', state: 'down' },
  { server: 'authy', label: 'authy', source: 'local', state: 'auth' },
  { server: 'linear', label: 'linear', source: 'dynamic', state: 'connecting', since: 0 },
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
    const ui = clientsAsTrees($.ui.resolve(e))
    const drawn =
      part === 'view'
        ? mcp.view({ mcp: rows }, ui, { enable: true }, 36, colors())
        : mcp.summary?.({ mcp: rows }, ui, { enable: true }, 36, colors())
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

test('each row: the glyph in its color, the label, the state at the right', async ($, on) => {
  const pane = await draw($, on, 'view', ROWS)
  expect(await rowsOf(pane)).toEqual([
    '● playwrightuser · 22 tools',
    '○ githubuser · off',
    '● Claude Docsclaude.ai · 1 tool',
    '✕ sentryproject · down',
    '! authylocal · needs auth',
    '◐ lineardynamic · connecting',
  ])
  const color = async (text: string) => {
    // A string query matches inside a longer text: match it whole.
    const found = await pane.find({ type: 'Text', text: new RegExp(`^${text}$`) })
    return found?.props.color
  }
  expect(await Promise.all(['●', '!', '◐', '✕', '○'].map(color))).toEqual([
    'success',
    'warning',
    'warning',
    'error',
    'subtle',
  ])
  expect(await Promise.all(['22 tools', 'needs auth', 'connecting', 'down', 'off'].map(color))).toEqual([
    'inactive',
    'warning',
    'warning',
    'error',
    'inactive',
  ])
  // The label is main text, drawn with the theme's `text`.
  expect((await pane.find({ type: 'Text', text: /^● playwright$/ }))?.props.color).toBe('text')
})

test('the header counts ● rows over listed rows', () => {
  const ui = {} as never
  expect(mcp.count?.({ mcp: ROWS }, ui, { enable: true }, 36, colors())).toBe('2/6')
  expect(mcp.count?.({ mcp: [] }, ui, { enable: true }, 36, colors())).toBe('0/0')
})

test('folded, each state present with its count, in its color, in glyph order', async ($, on) => {
  const pane = await draw($, on, 'summary', [...ROWS, { server: 'x', label: 'x', source: 'dynamic', state: 'ok', tools: 3 }])
  const parts = await pane.findAll({ type: 'Text', text: /^ ?[●!◐✕○] \d$/ })
  expect(parts.map((part) => [part.text.trim(), part.props.color])).toEqual([
    ['● 3', 'success'],
    ['! 1', 'warning'],
    ['◐ 1', 'warning'],
    ['✕ 1', 'error'],
    ['○ 1', 'subtle'],
  ])
  expect(mcp.summary?.({ mcp: [] }, {} as never, { enable: true }, 36, colors())).toBeUndefined()
})

// Scenario: the Sidebar through register.tsx's hooks.

const HOME = '/home/a'
const CLAUDE_JSON = `${HOME}/.claude.json`
const tools = (server: string, count: number): ToolInfo[] =>
  Array.from({ length: count }, (_, i) => ({ name: `mcp__${server}__t${i}`, description: '', mcp: true }))

// The world beneath the plugin: a session in /srv/x/app inside the repo
// /srv/x, a tool list and a `~/.claude.json` the test changes.
type World = {
  tools: ToolInfo[]
  json: string
  mtimeMs: number
  cwd?: string
  files?: Record<string, unknown> // other config files by path: `.mcp.json`, `managed-mcp.json`
  settings?: Record<string, unknown> // the merged settings
  policy?: Record<string, unknown> // the managed (policy) settings
}

function host(on: On, world: World, path = CLAUDE_JSON) {
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('session.cwd', () => ({ value: world.cwd ?? '/srv/x/app' }))
  on('session.version', () => ({ value: { version: '2.1.288' } }))
  on('agent.list', () => ({ value: [] }))
  on('session.usage', () => ({
    value: { startedAt: 0, context: { window: 200000 }, rateLimits: [], cost: { usd: 0 } },
  }))
  on('process.run', () => ({
    value: { exitCode: 128, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false },
  }))
  on('fs.exists', (_, e) => ({ value: e.path === '/srv/x/.git' || e.path === '/srv/y/.git' }))
  on('fs.stat', (_, e) => {
    if (e.path !== path) throw new Error('ENOENT')
    return { value: { kind: 'file', size: world.json.length, mtimeMs: world.mtimeMs, isLink: false } }
  })
  on('fs.read', (_, e) => {
    if (e.path === path) return { value: world.json }
    const file = world.files?.[e.path]
    if (file) return { value: JSON.stringify(file) }
    if (e.path.endsWith('mcp.json')) throw new Error('ENOENT')
    return { value: '{ "version": "0.0.0" }' }
  })
  on('settings.read', (_, e) => ({ value: (e.source === 'policy' ? world.policy : world.settings) ?? {} }))
  on('classic.PostToolUse', () => ({}))
  on('tool.list', () => ({ value: [{ name: 'Bash', description: '', mcp: false }, ...world.tools] }))
  on('tool.describe', (_, e) => ({ description: e.description }))
  on('classic.CwdChanged', () => ({}))
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
  expect(await rows()).toEqual(['● Claude Docsclaude.ai · 2 tools', '● playwrightdynamic · 22 tools', '○ githubdynamic · off'])
  expect(await pane.find({ type: 'Text', text: '2/3', in: 'foldrow-mcp' })).toBeDefined()

  // `/mcp disable playwright`: its tools go and the file lists it.
  world.tools = tools('claude_ai_Claude_Docs', 2)
  world.json = claudeJson(['github', 'playwright'])
  world.mtimeMs = 2
  await clock.advance(1000)
  await pane.redraw()
  expect(await rows()).toEqual(['● Claude Docsclaude.ai · 2 tools', '○ githubdynamic · off', '○ playwrightdynamic · off'])

  // `/mcp enable playwright`: it connects until its tools come back.
  world.json = claudeJson(['github'])
  world.mtimeMs = 3
  await clock.advance(1000)
  await pane.redraw()
  expect(await rows()).toEqual(['● Claude Docsclaude.ai · 2 tools', '◐ playwrightdynamic · connecting', '○ githubdynamic · off'])
  world.tools = [...tools('playwright', 22), ...tools('claude_ai_Claude_Docs', 2)]
  await clock.advance(1000)
  await pane.redraw()
  expect(await rows()).toEqual(['● Claude Docsclaude.ai · 2 tools', '● playwrightdynamic · 22 tools', '○ githubdynamic · off'])

  // A server that drops its tools reads down after MCP_TIMEOUT.
  world.tools = tools('playwright', 22)
  await clock.advance(1000)
  await pane.redraw()
  expect((await rows())[0]).toBe('◐ Claude Docsclaude.ai · connecting')
  await clock.advance(10_000)
  await pane.redraw()
  expect((await rows())[0]).toBe('✕ Claude Docsclaude.ai · down')

  // A click on the title row folds it; the summary keeps its colors inside the row's Client.
  await pane.pointer({ type: 'down', x: 2, y: 0, button: 'left', in: 'foldrow-mcp' })
  const summary = await pane.findAll({ type: 'Text', text: /^ ?[●✕○] \d$/, in: 'foldrow-mcp' })
  expect(summary.map((part) => [part.text.trim(), part.props.color])).toEqual([
    ['● 1', 'success'],
    ['✕ 1', 'error'],
    ['○ 1', 'subtle'],
  ])
})

test("a plugin's server is labelled by its server name, its plugin name holding _", async ($, on) => {
  const clock = mock.clock(on, { now: 0 })
  mock.env(on, { HOME })
  host(on, { tools: tools('plugin_my_kit_linear', 2), json: '{}', mtimeMs: 1 })
  await $.session.start({ cwd: '/srv/x/app', surface: 'terminal', isInteractive: true })
  await $.tool.describe({
    tool: 'mcp__plugin_my_kit_linear__t0',
    description: '',
    provider: { plugin: 'my_kit@market', tier: 'user' },
  })
  await clock.advance(1000)
  const pane = await $.ui.mount({ ...PANE, plugin: 'ctui', requestId: 'sidebar' })
  expect(await rowsOf(pane)).toEqual(['● linearmy_kit · 2 tools'])
})

test('after /cd to another project, off rows follow that project', async ($, on) => {
  const clock = mock.clock(on, { now: 0 })
  mock.env(on, { HOME })
  const json = JSON.stringify({
    projects: { '/srv/x': { disabledMcpServers: ['github'] }, '/srv/y': { disabledMcpServers: ['sentry'] } },
  })
  const world = { tools: [], json, mtimeMs: 1, cwd: '/srv/x/app' }
  host(on, world)
  await $.session.start({ cwd: '/srv/x/app', surface: 'terminal', isInteractive: true })
  await clock.advance(1000)
  const pane = await $.ui.mount({ ...PANE, plugin: 'ctui', requestId: 'sidebar' })
  expect(await rowsOf(pane)).toEqual(['○ githubdynamic · off'])

  // `/cd /srv/y`: the file is unchanged, the project key isn't.
  world.cwd = '/srv/y'
  await $.classic.CwdChanged({ old_cwd: '/srv/x/app', new_cwd: '/srv/y' })
  await clock.advance(1000)
  await pane.redraw()
  expect(await rowsOf(pane)).toEqual(['○ sentrydynamic · off'])
})

// Sources (#174), as `~/.claude.json`, `.mcp.json` files and the policy name them.
test('each row reads its source · status, from the config files in Claude Code’s order', async ($, on) => {
  const clock = mock.clock(on, { now: 0 })
  mock.env(on, { HOME })
  const json = JSON.stringify({
    mcpServers: { playwright: { command: 'npx' }, sentry: { command: 'npx' } },
    projects: { '/srv/x': { mcpServers: { linear: { command: 'npx' } } } },
  })
  host(on, {
    tools: ['playwright', 'linear', 'sentry', 'pending', 'policy', 'cli'].flatMap((server) => tools(server, 1)),
    json,
    mtimeMs: 1,
    files: {
      '/srv/x/app/.mcp.json': { mcpServers: { sentry: {} } },
      '/srv/.mcp.json': { mcpServers: { pending: {} } },
    },
    settings: { enabledMcpjsonServers: ['sentry'] },
    policy: { managedMcpServers: { policy: {} } },
  })
  await $.session.start({ cwd: '/srv/x/app', surface: 'terminal', isInteractive: true })
  await clock.advance(1000)
  const pane = await $.ui.mount({ ...PANE, plugin: 'ctui', requestId: 'sidebar' })
  await pane.pointer({ type: 'down', x: 0, y: 0, button: 'left', in: 'more-mcp' })
  expect(await rowsOf(pane)).toEqual([
    '● clidynamic · 1 tool',
    '● linearlocal · 1 tool',
    // Unapproved in this project: it can't shadow, so it reads as nothing holds it.
    '● pendingdynamic · 1 tool',
    '● playwrightuser · 1 tool',
    '● policymanaged · 1 tool',
    '● sentryproject · 1 tool',
  ])
  // The source and its `·` are muted; the status keeps its role.
  expect((await pane.find({ type: 'Text', text: /^dynamic · / }))?.props.color).toBe('inactive')
})

test('a tool run’s reported source corrects the guess', async ($, on) => {
  const clock = mock.clock(on, { now: 0 })
  mock.env(on, { HOME })
  const json = JSON.stringify({ mcpServers: { dup: { command: 'npx' } } })
  host(on, { tools: tools('dup', 1), json, mtimeMs: 1 })
  let cleared = false
  on('state.get', async ($, e, next) =>
    cleared && e.key === 'mcpObserved' ? { value: { value: undefined, version: 0 } } : next(e),
  )
  await $.session.start({ cwd: '/srv/x/app', surface: 'terminal', isInteractive: true })
  await clock.advance(1000)
  const pane = await $.ui.mount({ ...PANE, plugin: 'ctui', requestId: 'sidebar' })
  expect(await rowsOf(pane)).toEqual(['● dupuser · 1 tool'])
  // `--mcp-config` overrode the user server of that name.
  await $.classic.PostToolUse({
    tool_name: 'mcp__dup__t0',
    tool_input: {},
    tool_response: {},
    tool_use_id: 'toolu_1',
    mcp_server: { name: 'dup', source: 'dynamic' },
  })
  await clock.advance(1000)
  await pane.redraw()
  expect(await rowsOf(pane)).toEqual(['● dupdynamic · 1 tool'])

  // `/clear` empties $.state, not the servers: the correction holds.
  cleared = true
  await clock.advance(1000)
  await pane.redraw()
  expect(await rowsOf(pane)).toEqual(['● dupdynamic · 1 tool'])
})

test('after /cd the project servers are the new directory’s', async ($, on) => {
  const clock = mock.clock(on, { now: 0 })
  mock.env(on, { HOME })
  const world: World = {
    tools: tools('docs', 1),
    json: '{}',
    mtimeMs: 1,
    cwd: '/srv/x/app',
    files: { '/srv/y/.mcp.json': { mcpServers: { docs: {} } } },
    settings: { enableAllProjectMcpServers: true },
  }
  host(on, world)
  await $.session.start({ cwd: '/srv/x/app', surface: 'terminal', isInteractive: true })
  await clock.advance(1000)
  const pane = await $.ui.mount({ ...PANE, plugin: 'ctui', requestId: 'sidebar' })
  expect(await rowsOf(pane)).toEqual(['● docsdynamic · 1 tool'])
  world.cwd = '/srv/y'
  await $.classic.CwdChanged({ old_cwd: '/srv/x/app', new_cwd: '/srv/y' })
  await clock.advance(1000)
  await pane.redraw()
  expect(await rowsOf(pane)).toEqual(['● docsproject · 1 tool'])
})

test('with CLAUDE_CONFIG_DIR set, the disabled list comes from the .claude.json there', async ($, on) => {
  const clock = mock.clock(on, { now: 0 })
  mock.env(on, { HOME, CLAUDE_CONFIG_DIR: '/cfg' })
  host(on, { tools: [], json: claudeJson(['github']), mtimeMs: 1 }, '/cfg/.claude.json')
  await $.session.start({ cwd: '/srv/x/app', surface: 'terminal', isInteractive: true })
  await clock.advance(1000)
  const pane = await $.ui.mount({ ...PANE, plugin: 'ctui', requestId: 'sidebar' })
  expect(await rowsOf(pane)).toEqual(['○ githubdynamic · off'])
})

test('a click on ▸ N more lists every server, and ▾ show less caps them again', async ($, on) => {
  const clock = mock.clock(on, { now: 0 })
  mock.env(on, { HOME })
  host(on, { tools: ['a', 'b', 'c', 'd', 'e', 'f'].flatMap((server) => tools(server, 1)), json: '{}', mtimeMs: 1 })
  await $.session.start({ cwd: '/srv/x/app', surface: 'terminal', isInteractive: true })
  await clock.advance(1000)
  const pane = await $.ui.mount({ ...PANE, plugin: 'ctui', requestId: 'sidebar' })
  expect(await rowsOf(pane)).toHaveLength(4)
  expect((await pane.find({ in: 'more-mcp' }))?.text).toBe('▸ 2 more')
  await pane.pointer({ type: 'down', x: 0, y: 0, button: 'left', in: 'more-mcp' })
  expect(await rowsOf(pane)).toHaveLength(6)
  expect((await pane.find({ in: 'more-mcp' }))?.text).toBe('▾ show less')
  await pane.pointer({ type: 'down', x: 0, y: 0, button: 'left', in: 'more-mcp' })
  expect(await rowsOf(pane)).toHaveLength(4)
})

test('▸ N more lights main under the pointer, not accent', async ($, on) => {
  const clock = mock.clock(on, { now: 0 })
  mock.env(on, { HOME })
  host(on, { tools: ['a', 'b', 'c', 'd', 'e', 'f'].flatMap((server) => tools(server, 1)), json: '{}', mtimeMs: 1 })
  await $.session.start({ cwd: '/srv/x/app', surface: 'terminal', isInteractive: true })
  await clock.advance(1000)
  const pane = await $.ui.mount({ ...PANE, plugin: 'ctui', requestId: 'sidebar' })
  const color = async () => (await pane.find({ in: 'more-mcp' }))?.props.color
  expect(await color()).toBe('inactive')
  await pane.pointer({ type: 'enter', x: 0, y: 0, in: 'more-mcp' })
  expect(await color()).toBe('text')
})
