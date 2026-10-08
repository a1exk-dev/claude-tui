import type { ElementTable, On, RenderElement } from 'claude-code'
import { type Engine, expect, test } from 'claude-code/testing'

import { readConfig } from '../hooks/config'
import { scrollWindow, sidebar, type SidebarInput } from '../hooks/sidebar'
import { plugins } from '../plugins'
import { colors } from '../plugins/colors'
import type { SidebarData, SidebarPlugin } from '../plugins/plugin'
import { clientsAsTrees } from './clients'

// The branch row's Devicons glyph, `dev-git_branch` (#136).
const BRANCH = '\ue725'
const header: SidebarPlugin = {
  id: 'git',
  title: 'Git',
  slot: 'header',
  needs: [],
  view: () => ['~/x', `${BRANCH} main`],
}
const footer: SidebarPlugin = {
  id: 'versions',
  title: 'Versions',
  slot: 'footer',
  needs: [],
  view: () => ['ctui 0.0.0', 'claude-cli 2.1.288'],
}
const list = (id: 'mcp' | 'todo', items: number): SidebarPlugin => ({
  id,
  title: id,
  slot: 'section',
  needs: [],
  list: true,
  view: () => Array.from({ length: items }, (_, i) => `${id} ${i + 1}`),
  count: () => `${items}`,
  summary: () => `sum ${items}`,
})

type Row = { text: string; props: Record<string, unknown> }

// Each child of the Sidebar's root Box (the flexible space included), as text.
function rows(tree: RenderElement): Row[] {
  const text = (node: unknown): string => {
    if (typeof node === 'string') return node
    const el = node as { props?: { label?: string }; children?: unknown[] }
    return el.props?.label ?? (el.children ?? []).map(text).join('')
  }
  const root = tree as unknown as { children: unknown[] }
  return root.children
    .filter((child) => child !== null)
    .map((child) => ({ text: text(child), props: (child as { props: Record<string, unknown> }).props }))
}

// The rows as text, with each spacer (an empty Box with a height) as its height:
// 1 row under an expanded title and 1 after an expanded section, before the
// rule under which the next title sits (#134).
const B = 1
// The `─` rule between two sections, the body width at 42 columns.
const R = '─'.repeat(38)
// The `═` double rule under the git header, with a blank row on each side (#135).
const D = '═'.repeat(38)
function layout(tree: RenderElement): (string | number)[] {
  const root = tree as unknown as { children: ({ props: { height?: number }; children?: unknown[] } | null)[] }
  const all = root.children.filter((child) => child !== null)
  return rows(tree).map((row, i) => {
    const { props, children } = all[i]!
    return !children?.length && props.height !== undefined ? props.height : row.text
  })
}
// Their total height in rows.
const height = (sizes: (string | number)[]) =>
  sizes.reduce<number>((sum, size) => sum + (typeof size === 'number' ? size : 1), 0)

// Draws `sidebar()` in a test Pane on the terminal surface and returns its root.
async function draw(
  $: Engine,
  on: On,
  input: Partial<Omit<SidebarInput, 'ui'>>,
) {
  let maxScroll = -1
  on('ui.render', { component: 'Pane', requestId: 'unit' }, async ($, e) => {
    const drawn = sidebar({
      ui: clientsAsTrees($.ui.resolve(e)),
      bodyRows: 30,
      bodyColumns: 42,
      plugins: [header, list('mcp', 3), footer],
      data: {},
      config: readConfig({}),
      colors: colors(),
      folded: {},
      expanded: {},
      scroll: 0,
      focused: false,
      onControl: () => {},
      ...input,
    })
    maxScroll = drawn.maxScroll
    return drawn.tree
  })
  const pane = await $.ui.mount({
    plugin: 'test',
    surface: 'terminal',
    component: 'Pane',
    requestId: 'unit',
    props: {
      title: 'Sidebar',
      isFocused: false,
      bodyColumns: 42,
      placement: 'dock',
      scroll: { offset: 0, bodyRows: input.bodyRows ?? 30 },
      view: {},
    },
  })
  return { tree: await pane.drawn(), maxScroll }
}

test('header, sections and the footer on the last row', async ($, on) => {
  const { tree, maxScroll } = await draw($, on, {})
  expect(tree).toMatchObject({ type: 'Box', props: { height: 30, paddingX: 2, paddingY: 1 } })
  expect(layout(tree)).toEqual([
    '~/x',
    `${BRANCH} main`,
    B,
    D,
    B,
    '▼ mcp:3',
    B,
    'mcp 1',
    'mcp 2',
    'mcp 3',
    '',
    'ctui 0.0.0',
    'claude-cli 2.1.288',
  ])
  // The flexible space before the footer pushes it to the last row.
  expect(rows(tree)[10]?.props).toEqual({ flexGrow: 1 })
  expect(maxScroll).toBe(0)
})

test('a folded section shows its summary; folded sections sit together', async ($, on) => {
  const { tree } = await draw($, on, {
    plugins: [list('mcp', 3), list('todo', 2)],
    folded: { mcp: true },
  })
  expect(layout(tree)).toEqual(['▶\uFE0E mcp:sum 3', R, '▼ todo:2', B, 'todo 1', 'todo 2', ''])
})

// #134: a rule between every two sections, 1 row under an expanded title and
// 1 row after an expanded section before the rule.
const three = [list('mcp', 2), list('todo', 1), { ...list('mcp', 1), id: 'agents' as const, title: 'agents' }]

test('expanded sections space 1 row under the title and 1 row before the rule', async ($, on) => {
  const { tree } = await draw($, on, { plugins: three })
  expect(layout(tree)).toEqual(['▼ mcp:2', B, 'mcp 1', 'mcp 2', B, R, '▼ todo:1', B, 'todo 1', B, R, '▼ agents:1', B, 'mcp 1', ''])
})

test('a folded title is followed by the rule; an expanded one keeps its row before a folded one', async ($, on) => {
  const { tree } = await draw($, on, { plugins: three, folded: { mcp: true, agents: true } })
  expect(layout(tree)).toEqual(['▶\uFE0E mcp:sum 2', R, '▼ todo:1', B, 'todo 1', B, R, '▶\uFE0E agents:sum 1', ''])
})

test('folded titles are parted by one rule each and no blank rows', async ($, on) => {
  const { tree } = await draw($, on, { plugins: three, folded: { mcp: true, todo: true, agents: true } })
  expect(layout(tree)).toEqual(['▶\uFE0E mcp:sum 2', R, '▶\uFE0E todo:sum 1', R, '▶\uFE0E agents:sum 1', ''])
})

test('one section, expanded, has no rule', async ($, on) => {
  const { tree } = await draw($, on, {})
  expect(layout(tree).filter((size) => typeof size === 'string' && size.startsWith('─'))).toEqual([])
})

test('one section, folded, has no rule above or below it', async ($, on) => {
  const { tree } = await draw($, on, { folded: { mcp: true } })
  expect(layout(tree)).toEqual(['~/x', `${BRANCH} main`, B, D, B, '▶\uFE0E mcp:sum 3', '', 'ctui 0.0.0', 'claude-cli 2.1.288'])
})

// #135: the double rule shows only when the header and a section both show.
test('no double rule without a header', async ($, on) => {
  const { tree } = await draw($, on, { plugins: [list('mcp', 1), footer] })
  expect(layout(tree)).toEqual(['▼ mcp:1', B, 'mcp 1', '', 'ctui 0.0.0', 'claude-cli 2.1.288'])
})

test('no double rule without sections', async ($, on) => {
  const { tree } = await draw($, on, { plugins: [header, footer] })
  expect(layout(tree)).toEqual(['~/x', `${BRANCH} main`, '', 'ctui 0.0.0', 'claude-cli 2.1.288'])
})

// #136: the real git header parts the path from the git rows by 1 blank row.
const git = plugins.find((plugin) => plugin.id === 'git')!
const REPO = { branch: 'main', staged: 0, modified: 0, untracked: 0, stashes: 0, added: 0, removed: 0 }

test('in a repo, 1 blank row parts the path from the git rows', async ($, on) => {
  const { tree } = await draw($, on, { plugins: [git, list('mcp', 1)], data: { git: { path: '~/x', repo: REPO } } })
  expect(layout(tree).slice(0, 4)).toEqual(['~/x', '', `${BRANCH} main`, B])
})

test('outside a repo the header is the path alone, with no blank row', async ($, on) => {
  const { tree } = await draw($, on, { plugins: [git, list('mcp', 1)], data: { git: { path: '~/x' } } })
  expect(layout(tree).slice(0, 3)).toEqual(['~/x', B, D])
})

for (const [columns, cells] of [
  [42, 38],
  [53, 49],
] as const) {
  test(`a rule is the body width, ${cells} cells at ${columns} columns`, async ($, on) => {
    const { tree } = await draw($, on, { plugins: three, folded: { mcp: true }, bodyColumns: columns })
    expect(layout(tree)[1]).toBe('─'.repeat(cells))
  })

  test(`the double rule is the body width, ${cells} cells at ${columns} columns`, async ($, on) => {
    const { tree } = await draw($, on, { bodyColumns: columns })
    expect(layout(tree)[3]).toBe('═'.repeat(cells))
  })
}

test('under a selected Theme the root paint covers the spacers', async ($, on) => {
  const { tree } = await draw($, on, { plugins: [list('mcp', 1), list('todo', 1)], background: '#2d353b' })
  expect(tree).toMatchObject({ props: { backgroundColor: '#2d353b' } })
  const root = tree as unknown as { children: ({ props: Record<string, unknown> } | null)[] }
  // Spacers are the empty Boxes with a height; the flexible space has none.
  const spacers = root.children.filter(
    (child) => child?.props.height !== undefined && !(child as { children?: unknown[] }).children?.length,
  )
  expect(spacers.map((spacer) => spacer?.props)).toEqual([
    { height: B, flexShrink: 0 },
    { height: B, flexShrink: 0 },
    { height: B, flexShrink: 0 },
  ])
})

test('a section the person has not toggled folds from <id>_folded', async ($, on) => {
  const config = readConfig({ mcp_folded: true })
  const first = await draw($, on, { plugins: [list('mcp', 3)], config })
  expect(rows(first.tree)[0]?.text).toBe('▶\uFE0E mcp:sum 3')
})

test('a long list caps at 4 rows', async ($, on) => {
  const capped = await draw($, on, { plugins: [list('mcp', 6)] })
  expect(layout(capped.tree)).toEqual(['▼ mcp:6', B, 'mcp 1', 'mcp 2', 'mcp 3', 'mcp 4', '▸ 2 more', ''])
})

test('an expanded list shows every row and show less', async ($, on) => {
  const open = await draw($, on, { plugins: [list('mcp', 6)], expanded: { mcp: true } })
  expect(rows(open.tree).map((row) => row.text).slice(-3)).toEqual(['mcp 6', '▾ show less', ''])
})

test('a list of 4 has no toggle', async ($, on) => {
  const four = await draw($, on, { plugins: [list('mcp', 4)] })
  expect(layout(four.tree)).toEqual(['▼ mcp:4', B, 'mcp 1', 'mcp 2', 'mcp 3', 'mcp 4', ''])
})

test('sections taller than the free rows scroll in a window', async ($, on) => {
  // 14 body rows: 2 padding, 2 header, 3 under it, 1 gap, 2 footer leave 4 for 6 section rows.
  const plugins = [header, list('mcp', 4), footer]
  const top = await draw($, on, { plugins, bodyRows: 14 })
  // From `mcp 2` (stop 2) the rest fits under `↑ more`.
  expect(top.maxScroll).toBe(2)
  // 4 free rows: `↓ more` leaves 3, which hold the title, its spacer and `mcp 1`.
  expect(windowOf(layout(top.tree))).toEqual(['▼ mcp:4', B, 'mcp 1', '↓ more'])
  // The footer stays on the last row: the rows fill the body, the flexible
  // space taking the footer's gap.
  expect(rows(top.tree).at(-1)?.text).toBe('claude-cli 2.1.288')
  expect(height(layout(top.tree))).toBe(14 - 2)
})

test('scrolled to the end, only ↑ more shows', async ($, on) => {
  const plugins = [header, list('mcp', 4), footer]
  const end = await draw($, on, { plugins, bodyRows: 14, scroll: 99 })
  expect(windowOf(layout(end.tree))).toEqual(['↑ more', 'mcp 2', 'mcp 3', 'mcp 4'])
})

for (const scroll of [1, 99]) {
  test(`scrolled to ${scroll}, the header, its double rule and blank rows stay put`, async ($, on) => {
    const { tree } = await draw($, on, { plugins: [header, list('mcp', 4), footer], bodyRows: 14, scroll })
    expect(layout(tree).slice(0, 6)).toEqual(['~/x', `${BRANCH} main`, B, D, B, '↑ more'])
  })
}

// #130: a title's stop holds the blank row and the rule above it.
const two = [header, list('mcp', 2), list('todo', 2), footer]

test('a title at the top keeps its blank row and rule under ↑ more', async ($, on) => {
  // 16 body rows: 2 padding, 2 header, 3 under it, 1 gap, 2 footer leave 6 for 10 section rows.
  const { tree, maxScroll } = await draw($, on, { plugins: two, bodyRows: 16, scroll: 3 })
  expect(maxScroll).toBe(4)
  expect(windowOf(layout(tree))).toEqual(['↑ more', B, R, '▼ todo:2', B, '↓ more'])
})

test('the window never ends on a rule or the blank row before it', async ($, on) => {
  // 6 free rows: `↓ more` leaves 5, which hold mcp (4 rows) but not todo's 4.
  const { tree } = await draw($, on, { plugins: two, bodyRows: 16 })
  expect(windowOf(layout(tree))).toEqual(['▼ mcp:2', B, 'mcp 1', 'mcp 2', '↓ more'])
})

test('scrolled to the end past a rule, only ↑ more shows', async ($, on) => {
  const { tree } = await draw($, on, { plugins: two, bodyRows: 16, scroll: 99 })
  expect(windowOf(layout(tree))).toEqual(['↑ more', 'todo 1', 'todo 2'])
})

// #85's busy data: every section expanded, 7 MCP servers, 8 todos, 2 agents.
const BUSY: SidebarData = {
  git: { path: '~/Projects/claude-tui', repo: { branch: 'develop', ahead: 0, behind: 0, staged: 0, modified: 0, untracked: 0, stashes: 0, added: 0, removed: 0 } },
  usage: {
    context: { tokens: 18402, window: 200000, percent: 9 },
    rateLimits: [
      { kind: 'five_hour', percentUsed: 34, resetsAt: new Date(3_600_000).toISOString() },
      { kind: 'seven_day', percentUsed: 12, resetsAt: new Date(86_400_000).toISOString() },
      { kind: 'spend_limit', percentUsed: 5 },
    ],
  },
  now: 0,
  mcp: Array.from({ length: 7 }, (_, i) => ({ server: `s${i}`, label: `server ${i}`, state: 'ok' as const, tools: 3 })),
  todo: { tools: 'task', items: Array.from({ length: 8 }, (_, i) => ({ id: `${i}`, subject: `task ${i}`, status: 'pending' as const })) },
  tasks: {
    a: { id: 'a', kind: 'agent', type: 'Explore', label: 'map', status: 'running', startedAt: 0 },
    b: { id: 'b', kind: 'agent', type: 'Plan', label: 'plan', status: 'running', startedAt: 1 },
  },
  versions: { ctui: '0.3.0', claude: '2.1.292' },
}

// The sections window: from after the double rule's blank row to the flexible space before the footer.
const windowOf = (sizes: (string | number)[]) => sizes.slice(sizes.indexOf(D) + 2, sizes.lastIndexOf(''))
const busy = ($: Engine, on: On, scroll: number) => draw($, on, { plugins, data: BUSY, bodyRows: 34, scroll })

test("#85's busy data at 34 body rows: 37 section rows overflow 23 free rows", async ($, on) => {
  const top = await busy($, on, 0)
  const window = windowOf(layout(top.tree))
  // A 4-row header (path, blank row, branch, counts) leaves 23 free rows.
  // `↓ more` leaves 22, which hold Context, Limits and MCP (22 rows) but
  // not Todo's blank row, rule, title and spacer (4 more).
  expect(window.slice(-4)).toEqual(['● server 23 tools', '● server 33 tools', '▸ 3 more', '↓ more'])
  expect(height(window)).toBe(23)
  expect(window.filter((size) => size === B)).toHaveLength(5)
  expect(window.filter((size) => size === R)).toHaveLength(2)
  // One stop per row: from MCP's first row (stop 10) the rest, 20 rows, fits
  // the 22 under `↑ more`; from MCP's title stop (4 rows) before it is 24.
  expect(top.maxScroll).toBe(10)
})

test("#85's busy data scrolled to the end", async ($, on) => {
  const window = windowOf(layout((await busy($, on, 99)).tree))
  expect(window.slice(0, 2)).toEqual(['↑ more', '● server 03 tools'])
  expect(window.at(-1)).toBe('◐ Plan · plan0s')
  expect(height(window)).toBe(21)
})

test('scrollWindow marks hidden rows on both sides', () => {
  const more = (text: string) => text
  const names = ['a', 'b', 'c', 'd', 'e', 'f']
  const items = names.map((node) => ({ nodes: [node], height: 1 }))
  expect(scrollWindow(items, 6, 3, more)).toEqual({ rows: names, maxScroll: 0 })
  expect(scrollWindow(items, 4, 0, more)).toEqual({ rows: ['a', 'b', 'c', '↓ more'], maxScroll: 3 })
  expect(scrollWindow(items, 4, 1, more).rows).toEqual(['↑ more', 'b', 'c', '↓ more'])
  expect(scrollWindow(items, 4, 3, more).rows).toEqual(['↑ more', 'd', 'e', 'f'])
  expect(scrollWindow(items, 1, 0, more).rows).toEqual(['↓ more'])
  expect(scrollWindow(items, 0, 0, more).rows).toEqual([])
})

test('scrollWindow counts whole rows; a title stop carries its spacers', () => {
  const more = (text: string) => text
  // A, its spacer, a; then the blank row, the rule, B, its spacer, b: 8 rows in 4 stops.
  const stops = [
    { nodes: ['A', 't'], height: 1 + B },
    { nodes: ['a'], height: 1 },
    { nodes: ['g', '─', 'B', 't'], height: B + 1 + 1 + B },
    { nodes: ['b'], height: 1 },
  ]
  expect(scrollWindow(stops, 8, 0, more)).toEqual({ rows: ['A', 't', 'a', 'g', '─', 'B', 't', 'b'], maxScroll: 0 })
  // 7 free: `↓ more` leaves 6, which hold A and a (3 rows) but not B's 4 more.
  expect(scrollWindow(stops, 7, 0, more)).toEqual({ rows: ['A', 't', 'a', '↓ more'], maxScroll: 1 })
  // From stop 1 the rest (6 rows) fills the 6 under `↑ more` exactly.
  expect(scrollWindow(stops, 7, 1, more).rows).toEqual(['↑ more', 'a', 'g', '─', 'B', 't', 'b'])
})
