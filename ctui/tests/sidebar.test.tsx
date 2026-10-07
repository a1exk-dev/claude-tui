import type { ElementTable, On, RenderElement } from 'claude-code'
import { type Engine, expect, test } from 'claude-code/testing'

import type { PressProps } from '../hooks/press'
import { readConfig } from '../hooks/config'
import { scrollWindow, sidebar, type SidebarInput } from '../hooks/sidebar'
import { colors } from '../plugins/colors'
import type { SidebarPlugin } from '../plugins/plugin'

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

// Each child of the Sidebar's root Box is one row (the spacer included), as text.
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

// A test plugin loads no surface module, so each `press.tsx` Client draws as
// the Text that module draws.
function pressAsText(ui: ElementTable): SidebarInput['ui'] {
  if (!('Client' in ui)) throw new Error('the Sidebar draws on the terminal')
  return {
    ...ui,
    Client: ({ props }) => {
      const { label, color } = props as PressProps
      return <ui.Text color={color}>{label}</ui.Text>
    },
  }
}

// Draws `sidebar()` in a test Pane on the terminal surface and returns its root.
async function draw(
  $: Engine,
  on: On,
  input: Partial<Omit<SidebarInput, 'ui'>>,
) {
  let maxScroll = -1
  on('ui.render', { component: 'Pane', requestId: 'unit' }, async ($, e) => {
    const drawn = sidebar({
      ui: pressAsText($.ui.resolve(e)),
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
  expect(rows(tree).map((row) => row.text)).toEqual([
    '~/x',
    '⎇ main',
    '',
    '▾ mcp3',
    'mcp 1',
    'mcp 2',
    'mcp 3',
    '',
    'ctui 0.0.0',
    'claude-cli 2.1.288',
  ])
  // The flexible space before the footer pushes it to the last row.
  expect(rows(tree)[7]?.props).toEqual({ flexGrow: 1 })
  expect(maxScroll).toBe(0)
})

test('a folded section shows its summary; folded sections sit together', async ($, on) => {
  const { tree } = await draw($, on, {
    plugins: [list('mcp', 3), list('todo', 2)],
    folded: { mcp: true },
  })
  expect(rows(tree).map((row) => row.text)).toEqual(['▸ mcpsum 3', '▾ todo2', 'todo 1', 'todo 2', ''])
})

test('a section the person has not toggled folds from <id>_folded', async ($, on) => {
  const config = readConfig({ mcp_folded: true })
  const first = await draw($, on, { plugins: [list('mcp', 3)], config })
  expect(rows(first.tree)[0]?.text).toBe('▸ mcpsum 3')
})

test('a long list caps at 4 rows', async ($, on) => {
  const capped = await draw($, on, { plugins: [list('mcp', 6)] })
  expect(rows(capped.tree).map((row) => row.text)).toEqual(['▾ mcp6', 'mcp 1', 'mcp 2', 'mcp 3', 'mcp 4', '▸ 2 more', ''])
})

test('an expanded list shows every row and show less', async ($, on) => {
  const open = await draw($, on, { plugins: [list('mcp', 6)], expanded: { mcp: true } })
  expect(rows(open.tree).map((row) => row.text).slice(-3)).toEqual(['mcp 6', '▾ show less', ''])
})

test('a list of 4 has no toggle', async ($, on) => {
  const four = await draw($, on, { plugins: [list('mcp', 4)] })
  expect(rows(four.tree).map((row) => row.text)).toEqual(['▾ mcp4', 'mcp 1', 'mcp 2', 'mcp 3', 'mcp 4', ''])
})

test('sections taller than the free rows scroll in a window', async ($, on) => {
  // 12 body rows: 2 padding, 2 header, 1 gap, 1 gap, 2 footer leave 4 for 5 section rows.
  const plugins = [header, list('mcp', 4), footer]
  const top = await draw($, on, { plugins, bodyRows: 12 })
  expect(top.maxScroll).toBe(2)
  expect(rows(top.tree).map((row) => row.text).slice(3, 7)).toEqual(['▾ mcp4', 'mcp 1', 'mcp 2', '↓ more'])
  expect(rows(top.tree).at(-1)?.text).toBe('claude-cli 2.1.288')
})

test('scrolled to the end, only ↑ more shows', async ($, on) => {
  const plugins = [header, list('mcp', 4), footer]
  const end = await draw($, on, { plugins, bodyRows: 12, scroll: 99 })
  expect(rows(end.tree).map((row) => row.text).slice(3, 7)).toEqual(['↑ more', 'mcp 2', 'mcp 3', 'mcp 4'])
})

test('scrollWindow marks hidden rows on both sides', () => {
  const more = (text: string) => text
  const items = ['a', 'b', 'c', 'd', 'e', 'f']
  expect(scrollWindow(items, 6, 3, more)).toEqual({ rows: items, maxScroll: 0 })
  expect(scrollWindow(items, 4, 0, more)).toEqual({ rows: ['a', 'b', 'c', '↓ more'], maxScroll: 3 })
  expect(scrollWindow(items, 4, 1, more).rows).toEqual(['↑ more', 'b', 'c', '↓ more'])
  expect(scrollWindow(items, 4, 3, more).rows).toEqual(['↑ more', 'd', 'e', 'f'])
  expect(scrollWindow(items, 1, 0, more).rows).toEqual(['↓ more'])
  expect(scrollWindow(items, 0, 0, more).rows).toEqual([])
})
