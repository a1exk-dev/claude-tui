import type { ElementTable, On, RenderElement } from 'claude-code'
import { type Engine, expect, test } from 'claude-code/testing'

import { readConfig } from '../hooks/config'
import { scrollWindow, SECTION_GAP, sidebar, type SidebarInput, TITLE_GAP } from '../hooks/sidebar'
import { plugins } from '../plugins'
import { colors } from '../plugins/colors'
import type { SidebarData, SidebarPlugin } from '../plugins/plugin'
import { clientsAsTrees } from './clients'

const header: SidebarPlugin = {
  id: 'git',
  title: 'Git',
  slot: 'header',
  needs: [],
  view: () => ['~/x', '⎇ main'],
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

// The rows as text, with each spacer (an empty Box with a height) as its height.
const T = TITLE_GAP
const G = SECTION_GAP
function layout(tree: RenderElement): (string | number)[] {
  const root = tree as unknown as { children: ({ props: { height?: number }; children?: unknown[] } | null)[] }
  const all = root.children.filter((child) => child !== null)
  return rows(tree).map((row, i) => {
    const { props, children } = all[i]!
    return !children?.length && props.height !== undefined ? props.height : row.text
  })
}
// Their total height, to 2 decimals.
const height = (sizes: (string | number)[]) =>
  Math.round(sizes.reduce<number>((sum, size) => sum + (typeof size === 'number' ? size : 1), 0) * 100) / 100

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
    '⎇ main',
    '',
    '▾ mcp3',
    T,
    'mcp 1',
    'mcp 2',
    'mcp 3',
    '',
    'ctui 0.0.0',
    'claude-cli 2.1.288',
  ])
  // The flexible space before the footer pushes it to the last row.
  expect(rows(tree)[8]?.props).toEqual({ flexGrow: 1 })
  expect(maxScroll).toBe(0)
})

test('a folded section shows its summary; folded sections sit together', async ($, on) => {
  const { tree } = await draw($, on, {
    plugins: [list('mcp', 3), list('todo', 2)],
    folded: { mcp: true },
  })
  expect(layout(tree)).toEqual(['▸ mcpsum 3', '▾ todo2', T, 'todo 1', 'todo 2', ''])
})

// #85: 1/3 row under an expanded title, 1.5 rows after an expanded section.
const three = [list('mcp', 2), list('todo', 1), { ...list('mcp', 1), id: 'agents' as const, title: 'agents' }]

test('expanded sections space 1/3 row under the title and 1.5 rows apart', async ($, on) => {
  const { tree } = await draw($, on, { plugins: three })
  expect(layout(tree)).toEqual(['▾ mcp2', T, 'mcp 1', 'mcp 2', G, '▾ todo1', T, 'todo 1', G, '▾ agents1', T, 'mcp 1', ''])
})

test('folded sections take no spacer; an expanded one keeps its 1.5 rows before a folded one', async ($, on) => {
  const { tree } = await draw($, on, { plugins: three, folded: { mcp: true, agents: true } })
  expect(layout(tree)).toEqual(['▸ mcpsum 2', '▾ todo1', T, 'todo 1', G, '▸ agentssum 1', ''])
})

test('under a selected Theme the root paint covers the spacers', async ($, on) => {
  const { tree } = await draw($, on, { plugins: [list('mcp', 1), list('todo', 1)], background: '#2d353b' })
  expect(tree).toMatchObject({ props: { backgroundColor: '#2d353b' } })
  const root = tree as unknown as { children: ({ props: Record<string, unknown> } | null)[] }
  const spacers = root.children.filter((child) => child && child.props.height !== undefined && child.props.height !== 1)
  expect(spacers.map((spacer) => spacer?.props)).toEqual([
    { height: T, flexShrink: 0 },
    { height: G, flexShrink: 0 },
    { height: T, flexShrink: 0 },
  ])
})

test('a section the person has not toggled folds from <id>_folded', async ($, on) => {
  const config = readConfig({ mcp_folded: true })
  const first = await draw($, on, { plugins: [list('mcp', 3)], config })
  expect(rows(first.tree)[0]?.text).toBe('▸ mcpsum 3')
})

test('a long list caps at 4 rows', async ($, on) => {
  const capped = await draw($, on, { plugins: [list('mcp', 6)] })
  expect(layout(capped.tree)).toEqual(['▾ mcp6', T, 'mcp 1', 'mcp 2', 'mcp 3', 'mcp 4', '▸ 2 more', ''])
})

test('an expanded list shows every row and show less', async ($, on) => {
  const open = await draw($, on, { plugins: [list('mcp', 6)], expanded: { mcp: true } })
  expect(rows(open.tree).map((row) => row.text).slice(-3)).toEqual(['mcp 6', '▾ show less', ''])
})

test('a list of 4 has no toggle', async ($, on) => {
  const four = await draw($, on, { plugins: [list('mcp', 4)] })
  expect(layout(four.tree)).toEqual(['▾ mcp4', T, 'mcp 1', 'mcp 2', 'mcp 3', 'mcp 4', ''])
})

test('sections taller than the free rows scroll in a window', async ($, on) => {
  // 12 body rows: 2 padding, 2 header, 1 gap, 1 gap, 2 footer leave 4 for 5 1/3 section rows.
  const plugins = [header, list('mcp', 4), footer]
  const top = await draw($, on, { plugins, bodyRows: 12 })
  // From `mcp 2` (stop 2) the rest fits under `↑ more`.
  expect(top.maxScroll).toBe(2)
  // 4 free rows: `↓ more` leaves 3, which hold the title, its spacer and `mcp 1`.
  expect(layout(top.tree).slice(3, 8)).toEqual(['▾ mcp4', T, 'mcp 1', '↓ more', ''])
  expect(rows(top.tree).at(-1)?.text).toBe('claude-cli 2.1.288')
})

test('scrolled to the end, only ↑ more shows', async ($, on) => {
  const plugins = [header, list('mcp', 4), footer]
  const end = await draw($, on, { plugins, bodyRows: 12, scroll: 99 })
  expect(layout(end.tree).slice(3, 8)).toEqual(['↑ more', 'mcp 2', 'mcp 3', 'mcp 4', ''])
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

// The sections window: from after the header's gap to the flexible space before the footer.
const windowOf = (sizes: (string | number)[]) => sizes.slice(sizes.indexOf('') + 1, sizes.lastIndexOf(''))
const busy = ($: Engine, on: On, scroll: number) => draw($, on, { plugins, data: BUSY, bodyRows: 34, scroll })

test("#85's busy data at 34 body rows: 31.67 section rows overflow 26 free rows", async ($, on) => {
  const top = await busy($, on, 0)
  const window = windowOf(layout(top.tree))
  // `↓ more` leaves 25 rows, which hold 24.83: Context, Limits, MCP, and Todo to its third task.
  expect(window.slice(-6)).toEqual(['▾ Todo0/8', T, '○ task 0', '○ task 1', '○ task 2', '↓ more'])
  expect(height(window)).toBe(25.83)
  expect(window.filter((size) => size === T)).toHaveLength(4)
  expect(window.filter((size) => size === G)).toHaveLength(3)
  // One stop per row: from Limits' second row (stop 5) the rest, 24.5 rows,
  // fits under `↑ more`; from its first it is 25.5.
  expect(top.maxScroll).toBe(5)
})

test("#85's busy data scrolled to the end", async ($, on) => {
  const window = windowOf(layout((await busy($, on, 99)).tree))
  expect(window.slice(0, 3)).toEqual(['↑ more', '      resets in 1h 0m', 'week  ━━━──────────────────────  12%'])
  expect(window.at(-1)).toBe('◐ Plan · plan0s')
  expect(height(window)).toBe(25.5)
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

test('scrollWindow sums fractional heights; a title stop carries its spacers', () => {
  const more = (text: string) => text
  // A, its third, a; then the gap, B, its third, b: 6 1/6 rows in 4 stops.
  const stops = [
    { nodes: ['A', 't'], height: 1 + T },
    { nodes: ['a'], height: 1 },
    { nodes: ['g', 'B', 't'], height: G + 1 + T },
    { nodes: ['b'], height: 1 },
  ]
  expect(scrollWindow(stops, 7, 0, more).maxScroll).toBe(0)
  // 6 free: `↓ more` leaves 5, which hold A and a (2 1/3) but not B's 2 5/6 more.
  expect(scrollWindow(stops, 6, 0, more)).toEqual({ rows: ['A', 't', 'a', '↓ more'], maxScroll: 1 })
  // From stop 1 the rest (4 5/6) fits under `↑ more`.
  expect(scrollWindow(stops, 6, 1, more).rows).toEqual(['↑ more', 'a', 'g', 'B', 't', 'b'])
})

test('scrollWindow fits a rest that sums to whole rows despite float error', () => {
  const more = (text: string) => text
  // Four one-row sections, then a folded fifth: from stop 1 the rest is 15 rows,
  // which floats sum to 15.000000000000002.
  const section = (gap: boolean) => [{ nodes: ['title'], height: (gap ? G : 0) + 1 + T }, { nodes: ['row'], height: 1 }]
  const stops = [...section(false), ...section(true), ...section(true), ...section(true), { nodes: ['folded'], height: G + 1 }]
  expect(scrollWindow(stops, 16, 0, more).maxScroll).toBe(1)
})
