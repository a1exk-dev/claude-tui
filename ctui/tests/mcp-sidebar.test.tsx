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

// Every connection state's mark, from the Sidebar's shared circle vocabulary.
const OK = '\u{f05e1}' // nf-md-check_circle_outline
const AUTH = '\u{f0028}' // nf-md-alert_circle
const CONNECTING = '\u{f043e}' // nf-md-radiobox_marked
const DOWN = '\u{f0159}' // nf-md-close_circle
const OFF = '\u{f0377}' // nf-md-minus_circle_outline
// A busy row draws the sweep in the glyph cell instead; at rest its Client
// draws the first frame, and a fold line's busy term the frozen sixth.
const SWEEP_1 = '\u{f0a9e}' // nf-md-circle_slice_1
const SWEEP_6 = '\u{f0aa3}' // nf-md-circle_slice_6
const SWEEP_FRAMES = Array.from({ length: 8 }, (_, index) => String.fromCodePoint(0xf0a9e + index))
const CIRCLES = new RegExp(`^[${OK}${AUTH}${CONNECTING}${DOWN}${OFF}${SWEEP_1}]`, 'u')

// The text of each MCP row: a Box spreading the label and the state. The two
// spaces after the glyph are part of the row, so they are kept as drawn.
async function rowsOf(pane: Awaited<ReturnType<typeof draw>>) {
  const boxes = await pane.findAll({ type: 'Box' })
  return boxes.filter((box) => box.props.justifyContent === 'space-between' && CIRCLES.test(box.text)).map((box) => box.text)
}

test('each row: the mark in its role, two spaces, the label, the state at the right', async ($, on) => {
  const pane = await draw($, on, 'view', ROWS)
  expect(await rowsOf(pane)).toEqual([
    `${OK}  playwrightuser · 22 tools`,
    `${OFF}  githubuser · off`,
    `${OK}  Claude Docsclaude.ai · 1 tool`,
    `${DOWN}  sentryproject · down`,
    `${AUTH}  authylocal · needs auth`,
    `${CONNECTING}  lineardynamic · connecting`,
  ])
  const color = async (text: string) => {
    // A string query matches inside a longer text: match it whole.
    const found = await pane.find({ type: 'Text', text: new RegExp(`^${text}$`, 'u') })
    return found?.props.color
  }
  expect(await Promise.all([OK, AUTH, CONNECTING, DOWN, OFF].map(color))).toEqual([
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
  expect((await pane.find({ type: 'Text', text: new RegExp(`^${OK} {2}playwright$`, 'u') }))?.props.color).toBe('text')
})

// Busy is an overlay on the glyph cell, not a sixth state: the sweep replaces
// whatever the connection state would draw, in that state's own role, and the
// right-hand `<source> · <state text>` is untouched.
test('a busy row sweeps in its own state’s role, its state text unchanged', async ($, on) => {
  const busy = ROWS.filter((row) => row.state !== 'connecting').map((row) => ({ ...row, busy: true as const }))
  const pane = await draw($, on, 'view', [
    ...busy,
    { server: 'linear', label: 'linear', source: 'dynamic', state: 'connecting', since: 0, busy: true },
  ])
  expect(await rowsOf(pane)).toEqual([
    `${SWEEP_1}  playwrightuser · 22 tools`,
    `${SWEEP_1}  githubuser · off`,
    `${SWEEP_1}  Claude Docsclaude.ai · 1 tool`,
    `${SWEEP_1}  sentryproject · down`,
    `${SWEEP_1}  authylocal · needs auth`,
    `${SWEEP_1}  lineardynamic · connecting`,
  ])
  const sweeps = await pane.findAll({ type: 'Text', text: new RegExp(`^${SWEEP_1}$`, 'u') })
  expect(sweeps.map((sweep) => sweep.props.color)).toEqual([
    'success',
    'subtle',
    'success',
    'error',
    'warning',
    'warning',
  ])
})

// The gap costs the label a column, so at the 42-column dock the label is the
// half that gives way and `<source> · <state text>` keeps its room.
test('at the 42-column dock the glyph and gap sit in the truncating half', async ($, on) => {
  const long = { server: 'l', label: 'a-very-long-mcp-server-name-that-cannot-fit', source: 'user', state: 'ok' as const, tools: 7 }
  const pane = await draw($, on, 'view', [long])
  const label = await pane.find({ type: 'Text', text: new RegExp(`^${OK} {2}${long.label}$`, 'u') })
  expect(label?.props.wrap).toBe('truncate-end')
  const boxes = await pane.findAll({ type: 'Box' })
  expect(boxes.some((box) => box.props.flexShrink === 0 && box.text === 'user · 7 tools')).toBe(true)
})

// Busy swaps the glyph cell for its own `Client`, so the truncating half is
// the Box around the sweep rather than one Text. The row gives way the same
// way: the label truncates and `<source> · <state text>` keeps its room.
test('at the 42-column dock a busy row’s sweep and gap sit in the truncating half', async ($, on) => {
  const long = { server: 'l', label: 'a-very-long-mcp-server-name-that-cannot-fit', source: 'user', state: 'ok' as const, tools: 7, busy: true as const }
  const pane = await draw($, on, 'view', [long])
  const label = await pane.find({ type: 'Text', text: new RegExp(`^ {2}${long.label}$`, 'u') })
  expect(label?.props.wrap).toBe('truncate-end')
  const boxes = await pane.findAll({ type: 'Box' })
  // The sweep and its gap shrink with the label, not beside it.
  expect(boxes.some((box) => box.props.flexShrink === 1 && box.props.minWidth === 0 && box.text === `${SWEEP_1}  ${long.label}`)).toBe(true)
  expect(boxes.some((box) => box.props.flexShrink === 0 && box.text === 'user · 7 tools')).toBe(true)
})

test('the header counts ok rows over listed rows', () => {
  const ui = {} as never
  expect(mcp.count?.({ mcp: ROWS }, ui, { enable: true }, 36, colors())).toBe('2/6')
  expect(mcp.count?.({ mcp: [] }, ui, { enable: true }, 36, colors())).toBe('0/0')
})

// Folded, the shared tally: each state's mark, two spaces, its count, two
// spaces between terms, in the same state order the rows keep.
test('folded, a tally of the states present, each in its role, in state order', async ($, on) => {
  let rows: McpRow[] = [...ROWS, { server: 'x', label: 'x', source: 'dynamic', state: 'ok', tools: 3 }]
  on('ui.render', { component: 'Pane', requestId: 'unit' }, async ($, e) => {
    const ui = clientsAsTrees($.ui.resolve(e))
    return <ui.Box>{mcp.summary?.({ mcp: rows }, ui, { enable: true }, 36, colors()) ?? <ui.Text>none</ui.Text>}</ui.Box>
  })
  const pane = await $.ui.mount({ ...PANE, plugin: 'test', requestId: 'unit' })
  const summary = async (next: McpRow[]) => {
    rows = next
    await pane.redraw()
    return (await pane.find({ type: 'Text' }))?.text
  }
  expect(await summary(rows)).toBe(`${OK}  3  ${AUTH}  1  ${CONNECTING}  1  ${DOWN}  1  ${OFF}  1`)
  const terms = await pane.findAll({ type: 'Text', text: /^\S {2}\d$/u })
  expect(terms.map((term) => term.props.color)).toEqual(['success', 'warning', 'warning', 'error', 'subtle'])
  // A state with no servers has no term, so the terms sum to the listed servers.
  expect(await summary(ROWS.filter((row) => row.state === 'ok'))).toBe(`${OK}  2`)
  expect(await summary([])).toBe('none')

  // Folded, the busy term leads in `warning` however the busy servers' own
  // states differ, drawing the frozen frame; a busy server leaves its state
  // term, so the terms still sum to the server count.
  const working = ROWS.map((row) => (row.state === 'ok' || row.state === 'down' ? { ...row, busy: true as const } : row))
  expect(await summary(working)).toBe(
    `${SWEEP_6}  3  ${OK}  2  ${AUTH}  1  ${CONNECTING}  1  ${DOWN}  1  ${OFF}  1`,
  )
  expect((await pane.findAll({ type: 'Text', text: /^\S {2}\d$/u })).map((term) => term.props.color)).toEqual([
    'warning',
    'success',
    'warning',
    'warning',
    'error',
    'subtle',
  ])
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
  expect(await rows()).toEqual([`${OK}  Claude Docsclaude.ai · 2 tools`, `${OK}  playwrightdynamic · 22 tools`, `${OFF}  githubdynamic · off`])
  expect(await pane.find({ type: 'Text', text: '2/3', in: 'foldrow-mcp' })).toBeDefined()

  // `/mcp disable playwright`: its tools go and the file lists it.
  world.tools = tools('claude_ai_Claude_Docs', 2)
  world.json = claudeJson(['github', 'playwright'])
  world.mtimeMs = 2
  await clock.advance(1000)
  await pane.redraw()
  expect(await rows()).toEqual([`${OK}  Claude Docsclaude.ai · 2 tools`, `${OFF}  githubdynamic · off`, `${OFF}  playwrightdynamic · off`])

  // `/mcp enable playwright`: it connects until its tools come back.
  world.json = claudeJson(['github'])
  world.mtimeMs = 3
  await clock.advance(1000)
  await pane.redraw()
  expect(await rows()).toEqual([`${OK}  Claude Docsclaude.ai · 2 tools`, `${CONNECTING}  playwrightdynamic · connecting`, `${OFF}  githubdynamic · off`])
  world.tools = [...tools('playwright', 22), ...tools('claude_ai_Claude_Docs', 2)]
  await clock.advance(1000)
  await pane.redraw()
  expect(await rows()).toEqual([`${OK}  Claude Docsclaude.ai · 2 tools`, `${OK}  playwrightdynamic · 22 tools`, `${OFF}  githubdynamic · off`])

  // A server that drops its tools reads down after MCP_TIMEOUT.
  world.tools = tools('playwright', 22)
  await clock.advance(1000)
  await pane.redraw()
  expect((await rows())[0]).toBe(`${CONNECTING}  Claude Docsclaude.ai · connecting`)
  await clock.advance(10_000)
  await pane.redraw()
  expect((await rows())[0]).toBe(`${DOWN}  Claude Docsclaude.ai · down`)

  // A click on the title row folds it; the summary keeps its colors inside the row's Client.
  await pane.pointer({ type: 'down', x: 2, y: 0, button: 'left', in: 'foldrow-mcp' })
  const summary = await pane.findAll({ type: 'Text', text: /^\S {2}\d$/u, in: 'foldrow-mcp' })
  expect(summary.map((part) => [part.text, part.props.color])).toEqual([
    [`${OK}  1`, 'success'],
    [`${DOWN}  1`, 'error'],
    [`${OFF}  1`, 'subtle'],
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
  expect(await rowsOf(pane)).toEqual([`${OK}  linearmy_kit · 2 tools`])
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
  expect(await rowsOf(pane)).toEqual([`${OFF}  githubdynamic · off`])

  // `/cd /srv/y`: the file is unchanged, the project key isn't.
  world.cwd = '/srv/y'
  await $.classic.CwdChanged({ old_cwd: '/srv/x/app', new_cwd: '/srv/y' })
  await clock.advance(1000)
  await pane.redraw()
  expect(await rowsOf(pane)).toEqual([`${OFF}  sentrydynamic · off`])
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
    `${OK}  clidynamic · 1 tool`,
    `${OK}  linearlocal · 1 tool`,
    // Unapproved in this project: it can't shadow, so it reads as nothing holds it.
    `${OK}  pendingdynamic · 1 tool`,
    `${OK}  playwrightuser · 1 tool`,
    `${OK}  policymanaged · 1 tool`,
    `${OK}  sentryproject · 1 tool`,
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
  expect(await rowsOf(pane)).toEqual([`${OK}  dupuser · 1 tool`])
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
  expect(await rowsOf(pane)).toEqual([`${OK}  dupdynamic · 1 tool`])

  // `/clear` empties $.state, not the servers: the correction holds.
  cleared = true
  await clock.advance(1000)
  await pane.redraw()
  expect(await rowsOf(pane)).toEqual([`${OK}  dupdynamic · 1 tool`])
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
  expect(await rowsOf(pane)).toEqual([`${OK}  docsdynamic · 1 tool`])
  world.cwd = '/srv/y'
  await $.classic.CwdChanged({ old_cwd: '/srv/x/app', new_cwd: '/srv/y' })
  await clock.advance(1000)
  await pane.redraw()
  expect(await rowsOf(pane)).toEqual([`${OK}  docsproject · 1 tool`])
})

test('with CLAUDE_CONFIG_DIR set, the disabled list comes from the .claude.json there', async ($, on) => {
  const clock = mock.clock(on, { now: 0 })
  mock.env(on, { HOME, CLAUDE_CONFIG_DIR: '/cfg' })
  host(on, { tools: [], json: claudeJson(['github']), mtimeMs: 1 }, '/cfg/.claude.json')
  await $.session.start({ cwd: '/srv/x/app', surface: 'terminal', isInteractive: true })
  await clock.advance(1000)
  const pane = await $.ui.mount({ ...PANE, plugin: 'ctui', requestId: 'sidebar' })
  expect(await rowsOf(pane)).toEqual([`${OFF}  githubdynamic · off`])
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

// Busy through register.tsx's hooks: a `tool.call` to a server is bracketed,
// so the row sweeps while a call is in flight and settles the instant the last
// one ends.

// A held call's answer, so a test can keep one in flight and release it.
type Answer = (result: { result: string }) => void
const OK_RESULT = { result: 'ok' }

// One server's row as the docked Sidebar draws it. A sweeping row's glyph
// lives inside its own `Client`, so the row's own text starts at the gap. The
// busy write is queued behind the hook, so the first redraw lets it land.
async function sentryRow(pane: Awaited<ReturnType<typeof draw>>) {
  await pane.redraw()
  await pane.redraw()
  const boxes = await pane.findAll({ type: 'Box' })
  const row = boxes.find((box) => box.props.justifyContent === 'space-between' && /sentry/.test(box.text))
  const sweep = await pane.find({ type: 'Client', key: 'spinner-sentry' })
  return { text: row?.text, sweep: sweep?.props.props as { frames: string[]; ms: number; color: string } | undefined }
}

test('two overlapping calls leave the row busy until the second ends', async ($, on) => {
  const clock = mock.clock(on, { now: 0 })
  mock.env(on, { HOME, MCP_TIMEOUT: '10000' })
  host(on, { tools: tools('sentry', 1), json: '{}', mtimeMs: 1 })
  const answers: Answer[] = []
  on('tool.call', { tool: 'mcp__sentry__t0' }, () => new Promise<{ result: string }>((resolve) => answers.push(resolve)))
  await $.session.start({ cwd: '/srv/x/app', surface: 'terminal', isInteractive: true })
  await clock.advance(1000)
  const pane = await $.ui.mount({ ...PANE, plugin: 'ctui', requestId: 'sidebar' })
  expect(await sentryRow(pane)).toEqual({ text: `${OK}  sentrydynamic · 1 tool`, sweep: undefined })

  const first = $.tool.call({ tool: 'mcp__sentry__t0', tool_use_id: 'toolu_1' })
  const second = $.tool.call({ tool: 'mcp__sentry__t0', tool_use_id: 'toolu_2' })
  // The row sweeps as the calls cross the wire, without waiting for a tick:
  // the glyph cell is the Client's, so the row's own text starts at the gap.
  expect(await sentryRow(pane)).toEqual({
    text: '  sentrydynamic · 1 tool',
    sweep: { frames: SWEEP_FRAMES, ms: 100, color: 'success' },
  })
  answers[0]?.(OK_RESULT)
  await first
  expect((await sentryRow(pane)).text).toBe('  sentrydynamic · 1 tool')
  answers[1]?.(OK_RESULT)
  await second
  // It settles the instant the last call ends: no hold, no floor.
  expect(await sentryRow(pane)).toEqual({ text: `${OK}  sentrydynamic · 1 tool`, sweep: undefined })
})

test('a call that throws releases the count, so the row still settles', async ($, on) => {
  const clock = mock.clock(on, { now: 0 })
  mock.env(on, { HOME, MCP_TIMEOUT: '10000' })
  host(on, { tools: tools('sentry', 2), json: '{}', mtimeMs: 1 })
  let answer: Answer | undefined
  on('tool.call', { tool: 'mcp__sentry__t0' }, () => new Promise<{ result: string }>((resolve) => (answer = resolve)))
  on('tool.call', { tool: 'mcp__sentry__t1' }, () => {
    throw new Error('the server hung up')
  })
  await $.session.start({ cwd: '/srv/x/app', surface: 'terminal', isInteractive: true })
  await clock.advance(1000)
  const pane = await $.ui.mount({ ...PANE, plugin: 'ctui', requestId: 'sidebar' })
  const held = $.tool.call({ tool: 'mcp__sentry__t0', tool_use_id: 'toolu_1' })
  expect((await sentryRow(pane)).text).toBe('  sentrydynamic · 2 tools')
  // A second call to the same server fails. Its own count goes with it, so the
  // row turns on the call that is left and settles when that one ends.
  await $.tool.call({ tool: 'mcp__sentry__t1', tool_use_id: 'toolu_2' }).catch(() => undefined)
  expect((await sentryRow(pane)).text).toBe('  sentrydynamic · 2 tools')
  answer?.(OK_RESULT)
  await held
  expect(await sentryRow(pane)).toEqual({ text: `${OK}  sentrydynamic · 2 tools`, sweep: undefined })
})

test('a call to a down server sweeps in error without changing its state text', async ($, on) => {
  const clock = mock.clock(on, { now: 0 })
  mock.env(on, { HOME, MCP_TIMEOUT: '1000' })
  const world = { tools: tools('sentry', 1), json: '{}', mtimeMs: 1 }
  host(on, world)
  let answer: Answer | undefined
  on('tool.call', { tool: 'mcp__sentry__t0' }, () => new Promise<{ result: string }>((resolve) => (answer = resolve)))
  await $.session.start({ cwd: '/srv/x/app', surface: 'terminal', isInteractive: true })
  await clock.advance(1000)
  const pane = await $.ui.mount({ ...PANE, plugin: 'ctui', requestId: 'sidebar' })
  // Its tools go, so the row connects and then reads down.
  world.tools = []
  await clock.advance(1000)
  await clock.advance(1000)
  expect((await sentryRow(pane)).text).toBe(`${DOWN}  sentrydynamic · down`)

  const held = $.tool.call({ tool: 'mcp__sentry__t0', tool_use_id: 'toolu_1' })
  // Busy outranks the state in the glyph cell alone: the right-hand text keeps
  // saying "the last read said down", and the sweep takes the row's own role.
  expect(await sentryRow(pane)).toEqual({
    text: '  sentrydynamic · down',
    sweep: { frames: SWEEP_FRAMES, ms: 100, color: 'error' },
  })
  // The header count is about reachability, not work.
  expect(await pane.find({ type: 'Text', text: '0/1', in: 'foldrow-mcp' })).toBeDefined()
  answer?.(OK_RESULT)
  await held
})

// The tick and the bracket write the same rows, so both go through one queue
// that re-reads the in-flight count at write time. Without that, a tick whose
// write is already in flight when the last call ends puts the count back as it
// stood and the row sweeps on with nothing running until the next tick — the
// stale-hot read MEMORY.md rules out ("The `mcp` Sidebar plugin reads live tools and MCP config
// names; it never probes").
test('a release landing while a tick writes still leaves the row settled', async ($, on) => {
  const clock = mock.clock(on, { now: 0 })
  mock.env(on, { HOME, MCP_TIMEOUT: '10000' })
  const world = { tools: tools('sentry', 1), json: '{}', mtimeMs: 1 }
  host(on, world)
  let answer: Answer | undefined
  on('tool.call', { tool: 'mcp__sentry__t0' }, () => new Promise<{ result: string }>((resolve) => (answer = resolve)))
  // Holds the next write of the rows open, which is the window a second
  // writer could overwrite.
  let hold: (() => void) | undefined
  let holding = false
  on('state.set', async ($, e, next) => {
    if (e.key === 'mcp' && holding) {
      holding = false
      await new Promise<void>((resolve) => (hold = resolve))
    }
    return next(e)
  })
  await $.session.start({ cwd: '/srv/x/app', surface: 'terminal', isInteractive: true })
  await clock.advance(1000)
  const pane = await $.ui.mount({ ...PANE, plugin: 'ctui', requestId: 'sidebar' })
  const held = $.tool.call({ tool: 'mcp__sentry__t0', tool_use_id: 'toolu_1' })
  expect((await sentryRow(pane)).sweep?.color).toBe('success')

  // A tick with something of its own to write — the server gained a tool —
  // caught mid-write, and the call ends inside that window.
  world.tools = tools('sentry', 2)
  holding = true
  await clock.advance(1000)
  answer?.(OK_RESULT)
  await held
  hold?.()
  await clock.settle()
  // The tick's own change lands, and the row settles with it: no sweep left
  // over for the next second.
  expect(await sentryRow(pane)).toEqual({ text: `${OK}  sentrydynamic · 2 tools`, sweep: undefined })
})

// This holds through the hooks as well as per view: with a call in
// flight, the folded tally's busy term leads and a busy server keeps its state
// term, so the state terms still sum to the server count.
test('folded with a busy server, the busy term leads and the terms sum to the server count', async ($, on) => {
  const clock = mock.clock(on, { now: 0 })
  mock.env(on, { HOME, MCP_TIMEOUT: '10000' })
  host(on, { tools: [...tools('sentry', 1), ...tools('docs', 1)], json: claudeJson(['github']), mtimeMs: 1 })
  let answer: Answer | undefined
  on('tool.call', { tool: 'mcp__sentry__t0' }, () => new Promise<{ result: string }>((resolve) => (answer = resolve)))
  await $.session.start({ cwd: '/srv/x/app', surface: 'terminal', isInteractive: true })
  await clock.advance(1000)
  const pane = await $.ui.mount({ ...PANE, plugin: 'ctui', requestId: 'sidebar' })
  // Three servers listed: two reachable, one disabled.
  expect(await pane.find({ type: 'Text', text: '2/3', in: 'foldrow-mcp' })).toBeDefined()
  const held = $.tool.call({ tool: 'mcp__sentry__t0', tool_use_id: 'toolu_1' })
  expect((await sentryRow(pane)).sweep?.color).toBe('success')

  // A click on the title row folds it; the tally is that row's own Client.
  await pane.pointer({ type: 'down', x: 2, y: 0, button: 'left', in: 'foldrow-mcp' })
  const terms = await pane.findAll({ type: 'Text', text: /^\S {2}\d$/u, in: 'foldrow-mcp' })
  expect(terms.map((term) => [term.text, term.props.color])).toEqual([
    [`${SWEEP_6}  1`, 'warning'],
    [`${OK}  2`, 'success'],
    [`${OFF}  1`, 'subtle'],
  ])
  // The busy term leads and claims only that something is working; the state
  // terms after it still sum to the three servers the header counted.
  expect(terms.slice(1).reduce((sum, term) => sum + Number(term.text.slice(-1)), 0)).toBe(3)
  answer?.(OK_RESULT)
  await held
})
