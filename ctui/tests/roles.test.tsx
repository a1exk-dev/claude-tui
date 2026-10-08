import type { ElementTable, On } from 'claude-code'
import { type Engine, expect, test } from 'claude-code/testing'

import { readConfig } from '../hooks/config'
import { sidebar, type SidebarInput } from '../hooks/sidebar'
import { plugins } from '../plugins'
import { type Colors, colors } from '../plugins/colors'
import type { SidebarData } from '../plugins/plugin'
import { clientsAsTrees } from './clients'

// The Sidebar's color roles (MEMORY.md "Sidebar colors inherit the Claude
// Code theme"): every plugin and the Sidebar's own rows, with sample data.

const NOW = 100_000

const DATA: SidebarData = {
  git: {
    path: '~/Projects/claude-tui',
    repo: { branch: 'develop', ahead: 1, behind: 0, staged: 2, modified: 3, untracked: 1, stashes: 1, added: 12, removed: 4 },
  },
  usage: {
    context: { tokens: 18402, window: 200000, percent: 9 },
    rateLimits: [{ kind: 'five_hour', percentUsed: 34, resetsAt: new Date(NOW + 3_600_000).toISOString() }],
    cost: { usd: 0.21 },
  },
  now: NOW,
  mcp: [
    { server: 'playwright', label: 'playwright', state: 'ok', tools: 22 },
    { server: 'github', label: 'github', state: 'off' },
  ],
  todo: {
    tools: 'task',
    items: [
      { id: '1', subject: 'Write the parser', status: 'completed' },
      { id: '2', subject: 'Run the tests', status: 'in_progress' },
      { id: '3', subject: 'Open the PR', status: 'pending' },
    ],
  },
  tasks: {
    a: { id: 'a', kind: 'agent', type: 'Explore', label: 'list work dir', status: 'running', startedAt: 0 },
    s: { id: 's', kind: 'shell', type: 'shell', label: 'npm test', parent: 'a', status: 'completed', startedAt: 0, endedAt: 5000 },
  },
  versions: { ctui: '0.2.0', claude: '2.1.292', theme: 'Tokyo Night' },
}

type Node = { type?: string; props?: Record<string, unknown>; children?: unknown[] }

// Each run of text with the color it draws in: the nearest Text's `color`, or
// `dim` for `dimColor`, or undefined for the terminal's foreground. Adjacent
// strings in one Text (`↑{ahead}`) are one run.
function runs(node: unknown, color?: string): { text: string; color?: string }[] {
  const { type, props = {}, children = [] } = (node ?? {}) as Node
  const own = type === 'Text' ? ((props.color as string | undefined) ?? (props.dimColor ? 'dim' : color)) : color
  const out: { text: string; color?: string }[] = []
  let text = ''
  const flush = () => {
    if (text.trim()) out.push({ text, color: own })
    text = ''
  }
  for (const child of children) {
    if (typeof child === 'string') text += child
    else {
      flush()
      out.push(...runs(child, own))
    }
  }
  flush()
  return out
}

// Draws the whole Sidebar with every plugin in a test Pane.
async function draw($: Engine, on: On, input: Partial<SidebarInput> = {}, columns = 42) {
  on('ui.render', { component: 'Pane', requestId: 'unit' }, async ($, e) => {
    return sidebar({
      ui: clientsAsTrees($.ui.resolve(e)),
      bodyRows: 60,
      bodyColumns: e.props.bodyColumns,
      plugins,
      data: DATA,
      config: readConfig({}),
      colors: colors(),
      folded: {},
      expanded: {},
      scroll: 0,
      focused: false,
      onControl: () => {},
      ...input,
    }).tree
  })
  const pane = await $.ui.mount({
    plugin: 'test',
    surface: 'terminal',
    component: 'Pane',
    requestId: 'unit',
    props: {
      title: 'Sidebar',
      isFocused: false,
      bodyColumns: columns,
      placement: 'dock',
      scroll: { offset: 0, bodyRows: 60 },
      view: {},
    },
  })
  return { pane, runs: runs(await pane.drawn()) }
}

const colorOf = (all: { text: string; color?: string }[], text: string) =>
  all.filter((run) => run.text.trim() === text).map((run) => run.color)

// #86: text with no color is the terminal's foreground and missed theme switches.
test('every run of text draws in a theme key; fold arrows draw muted', async ($, on) => {
  const { runs: all } = await draw($, on)
  const keys = Object.values(colors())
  expect(all.filter((run) => !keys.includes(run.color ?? ''))).toEqual([])
  expect(colorOf(all, '▼')).toEqual(Array(5).fill('inactive'))
})

test('main text draws with the text key: path, branch, titles, labels, percents, versions', async ($, on) => {
  const { runs: all } = await draw($, on)
  for (const text of ['~/Projects/claude-tui', 'Context:', 'MCP:', 'playwright', '9%', '34%', '2.1.292', '0.2.0, Tokyo Night']) {
    expect(colorOf(all, text), text).toEqual(['text'])
  }
  expect(colorOf(all, 'Run the tests')).toEqual(['text'])
})

// #136: the Devicons glyphs leading the git rows: branch, changeset, lines changed.
const GLYPHS = ['\ue725', '\ue702', '\ue728']

test('the git header: glyphs muted, counts in their roles, lines changed muted', async ($, on) => {
  const { runs: all } = await draw($, on)
  expect(GLYPHS.map((glyph) => colorOf(all, glyph))).toEqual([['inactive'], ['inactive'], ['inactive']])
  expect(colorOf(all, 'develop')).toEqual(['text'])
  expect(['↑1', '↓0', '+2', '!3', '?1', '≡1', '+12', '-4', 'lines changed'].map((t) => colorOf(all, t)[0])).toEqual([
    'text',
    'text',
    'success',
    'warning',
    'inactive',
    'suggestion',
    'success',
    'error',
    'inactive',
  ])
})

test('bars: the empty part faint ─, the percent main; pending todo ○ faint with muted text', async ($, on) => {
  const { runs: all } = await draw($, on)
  // Shorter than a rule between sections, which spans the body.
  const empty = all.filter((run) => /^─+$/.test(run.text) && run.text.length < 38)
  expect(empty.map((run) => run.color)).toEqual(['subtle', 'subtle'])
  expect(colorOf(all, '○')).toEqual(['subtle', 'subtle'])
  expect(colorOf(all, 'Open the PR')).toEqual(['inactive'])
})

test('a rule between every two sections draws faint across the body', async ($, on) => {
  const { runs: all } = await draw($, on)
  expect(colorOf(all, '─'.repeat(38))).toEqual(Array(4).fill('subtle'))
})

test('the double rule under the git header draws faint across the body', async ($, on) => {
  const { runs: all } = await draw($, on)
  expect(colorOf(all, '═'.repeat(38))).toEqual(['subtle'])
})

test('a section header draws its count muted', async ($, on) => {
  const { runs: all } = await draw($, on)
  expect(colorOf(all, '1/2')).toEqual(['inactive'])
})

test('scroll marks draw muted', async ($, on) => {
  const { runs: all } = await draw($, on, { bodyRows: 15, scroll: 2 })
  expect(colorOf(all, '↑ more')).toEqual(['inactive'])
  expect(colorOf(all, '↓ more')).toEqual(['inactive'])
})

test('a capped list draws ▸ N more muted', async ($, on) => {
  const mcp = Array.from({ length: 6 }, (_, i) => ({ server: `s${i}`, label: `s${i}`, state: 'ok' as const, tools: 1 }))
  const { runs: all } = await draw($, on, { data: { ...DATA, mcp } })
  expect(colorOf(all, '▸ 2 more')).toEqual(['inactive'])
})

// The footer is one row where it fits the body width, else two; nothing truncates.
for (const [columns, theme, footer] of [
  [42, 'Tokyo Night', ['claude cli: 2.1.292', 'ctui: 0.2.0, Tokyo Night']],
  [42, 'inherit', ['claude cli: 2.1.292', 'ctui: 0.2.0, inherit']],
  [53, 'Tokyo Night', ['claude cli: 2.1.292 │ ctui: 0.2.0, Tokyo Night']],
  [53, 'inherit', ['claude cli: 2.1.292 │ ctui: 0.2.0, inherit']],
] as const) {
  test(`the versions footer at ${columns} columns under ${theme}: ${footer.length} row(s)`, async ($, on) => {
    const data = { ...DATA, versions: { ctui: '0.2.0', claude: '2.1.292', theme } }
    const { pane, runs: all } = await draw($, on, { data }, columns)
    const rows = await pane.findAll({ type: 'Text', text: /^(claude cli|ctui): \d/ })
    expect(rows.map((row) => row.text)).toEqual([...footer])
    for (const row of rows) expect(row.text.length).toBeLessThanOrEqual(columns - 4)
    expect(['claude cli:', 'ctui:'].map((t) => colorOf(all, t)[0])).toEqual(['inactive', 'inactive'])
    expect(colorOf(all, '│')).toEqual(footer.length === 1 ? ['subtle'] : [])
  })
}

test("a Theme's overrides reach every role", async ($, on) => {
  const theme: Colors = colors({ text: '#d3c6aa', inactive: '#918c7e', subtle: '#475258' })
  // At 53 columns the footer is one row, with its │.
  const { runs: all } = await draw($, on, { colors: theme }, 53)
  expect(colorOf(all, 'Context:')).toEqual(['#d3c6aa'])
  expect(GLYPHS.map((glyph) => colorOf(all, glyph))).toEqual([['#918c7e'], ['#918c7e'], ['#918c7e']])
  expect(colorOf(all, '│')).toEqual(['#475258'])
  expect(colorOf(all, '═'.repeat(49))).toEqual(['#475258'])
  expect(colorOf(all, '▼')).toEqual(Array(5).fill('#918c7e'))
  expect(all.some((run) => ['text', 'inactive', 'subtle'].includes(run.color ?? ''))).toBe(false)
})
