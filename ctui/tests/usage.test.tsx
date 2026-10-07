import type { On, SessionMeasureInput, SessionUsage } from 'claude-code'
import { type Engine, expect, mock, test } from 'claude-code/testing'

import { colors } from '../plugins/colors'
import context from '../plugins/context'
import limits from '../plugins/limits'
import type { SidebarData, SidebarPlugin } from '../plugins/plugin'
import type { Usage } from '../types'

// The `context` and `limits` Sidebar plugins: unit views with sample usage,
// and a scenario where `session.measure` moves the Sidebar's rows.

const NOW = new Date(2026, 9, 9, 5, 0).getTime() // a Friday, local time
const at = (days: number, hours: number, minutes = 0) =>
  new Date(NOW + ((days * 24 + hours) * 60 + minutes) * 60_000).toISOString()

const FRESH: Usage = { context: { window: 200000 }, rateLimits: [], cost: { usd: 0 } }
const MEASURED: Usage = {
  context: { tokens: 18402, window: 200000, percent: 9 },
  rateLimits: [
    { kind: 'seven_day', percentUsed: 81, resetsAt: at(3, 4) },
    { kind: 'five_hour', percentUsed: 34.4, resetsAt: at(0, 2, 17) },
  ],
  cost: { usd: 0.214 },
}

// A section row is 36 cells wide at the Sidebar's 42 columns.
const WIDTH = 36

// The `limits` settings as `readConfig` regroups them, `limits_cost` on.
const CFG = { enable: true, cost: true }
const NO_COST = { enable: true, cost: false }

// Draws one plugin's view rows in a test Pane, as the Sidebar does.
async function draw($: Engine, on: On, plugin: SidebarPlugin, data: SidebarData, cfg = CFG, width = WIDTH) {
  on('ui.render', { component: 'Pane', requestId: 'unit' }, async ($, e) => {
    const ui = $.ui.resolve(e)
    return <ui.Box flexDirection="column">{plugin.view(data, ui, cfg, width, colors())}</ui.Box>
  })
  return $.ui.mount({
    plugin: 'test',
    surface: 'terminal',
    component: 'Pane',
    requestId: 'unit',
    props: {
      title: 'Sidebar',
      isFocused: false,
      bodyColumns: 42,
      placement: 'dock',
      scroll: { offset: 0, bodyRows: 30 },
      view: {},
    },
  })
}

type Pane = Awaited<ReturnType<typeof draw>>

// A bar row's filled cells, empty cells and percent, with their colors.
async function barOf(pane: Pane, percent: RegExp) {
  const row = await pane.find({ type: 'Text', text: percent })
  const [filled, empty, shown] = (row?.children ?? []).slice(-3) as {
    props: { color?: string }
    children: string[]
  }[]
  return {
    filled: filled?.children.join('').length,
    empty: empty?.children.join('').length,
    colors: [filled?.props.color, empty?.props.color, shown?.props.color],
  }
}

test('context draws the fill bar and tokens, and no cost', async ($, on) => {
  const pane = await draw($, on, context, { usage: MEASURED })
  expect(await barOf(pane, /9%$/)).toEqual({ filled: 3, empty: 28, colors: ['success', 'subtle', 'text'] })
  expect((await pane.find({ type: 'Text', text: '18,402 / 200k tokens' }))?.props.color).toBe('inactive')
  expect(await pane.find({ text: /\$/ })).toBeUndefined()
})

test('before the first response context reads 0%', async ($, on) => {
  const pane = await draw($, on, context, { usage: FRESH })
  expect(await barOf(pane, /0%$/)).toEqual({ filled: 0, empty: 31, colors: ['success', 'subtle', 'text'] })
  expect(await pane.find({ type: 'Text', text: '0 / 200k tokens' })).toBeDefined()
})

for (const [percent, color] of [
  [60, 'warning'],
  [85, 'error'],
] as const) {
  test(`context at ${percent}% fills in ${color}`, async ($, on) => {
    const usage: Usage = { context: { tokens: percent * 2000, window: 200000, percent }, rateLimits: [] }
    const pane = await draw($, on, context, { usage })
    expect((await barOf(pane, new RegExp(`${percent}%$`))).colors).toEqual([color, 'subtle', 'text'])
  })
}

test('limits draw each window in order with its reset', async ($, on) => {
  const pane = await draw($, on, limits, { usage: MEASURED, now: NOW })
  const rows = await pane.findAll({ type: 'Text', text: /^(5h|week|spend|\s+resets)/ })
  expect(rows.map((row) => row.text.trim().replace(/━*─+/, ' ━ ').replace(/\s+/g, ' '))).toEqual([
    '5h ━ 34%',
    'resets in 2h 17m',
    'week ━ 81%',
    'resets in 3d 4h, Mon 09:00',
  ])
  // The label column takes 6 cells; the bar the rest less the percent's 5.
  expect(await barOf(pane, /^5h/)).toEqual({ filled: 9, empty: 16, colors: ['success', 'subtle', 'text'] })
  expect((await barOf(pane, /^week/)).colors).toEqual(['warning', 'subtle', 'text'])
  expect(rows[0]?.props.color).toBe('text')
  expect(rows[1]?.props.color).toBe('inactive')
  expect(rows[1]?.text).toMatch(/^ {6}resets/)
})

test('a spend limit past 100 draws a full bar in error; no reset time, no reset row', async ($, on) => {
  const usage: Usage = { context: FRESH.context, rateLimits: [{ kind: 'spend_limit', percentUsed: 112 }] }
  const pane = await draw($, on, limits, { usage, now: NOW })
  expect(await barOf(pane, /112%$/)).toEqual({ filled: 25, empty: 0, colors: ['error', 'subtle', 'text'] })
  expect(await pane.find({ text: /resets/ })).toBeUndefined()
})

// The cost row: `cost` in the label column, the value right-aligned with the percents.
async function costRow(pane: Pane) {
  const row = await pane.find({ type: 'Text', text: /^cost/ })
  const value = (row?.children ?? []).at(-1) as { props: { color?: string }; children: string[] } | undefined
  return { text: row?.text, colors: [row?.props.color, value?.props.color] }
}

for (const [columns, width] of [
  [42, 36],
  [53, 47],
] as const) {
  test(`at ${columns} columns the cost row ends limits, its value under the percents`, async ($, on) => {
    const pane = await draw($, on, limits, { usage: MEASURED, now: NOW }, CFG, width)
    const rows = await pane.findAll({ type: 'Text', text: /^(5h|week|cost|\s+resets)/ })
    expect(rows.at(-1)?.text).toMatch(/^cost/)
    expect(await costRow(pane)).toEqual({
      text: 'cost'.padEnd(width - 5) + '$0.21',
      colors: ['text', 'inactive'],
    })
    expect((await pane.find({ type: 'Text', text: /34%$/ }))?.text).toHaveLength(width)
  })
}

test('with no windows the cost row alone replaces no limits reported', async ($, on) => {
  const pane = await draw($, on, limits, { usage: FRESH, now: NOW })
  expect((await costRow(pane)).text).toBe('cost'.padEnd(WIDTH - 5) + '$0.00')
  expect(await pane.find({ text: 'no limits reported' })).toBeUndefined()
})

for (const [name, usage, cfg] of [
  ['no cost reported', { ...FRESH, cost: undefined }, CFG],
  ['limits_cost off', FRESH, NO_COST],
] as const) {
  test(`with no windows and ${name} limits says so`, async ($, on) => {
    const pane = await draw($, on, limits, { usage, now: NOW }, cfg)
    const row = await pane.find({ type: 'Text', text: 'no limits reported' })
    expect(row?.props.color).toBe('inactive')
    expect(await pane.find({ text: /^cost/ })).toBeUndefined()
  })
}

test('with limits_cost off the windows show without a cost row', async ($, on) => {
  const pane = await draw($, on, limits, { usage: MEASURED, now: NOW }, NO_COST)
  expect(await pane.find({ text: /^5h/ })).toBeDefined()
  expect(await pane.find({ text: /^cost|\$/ })).toBeUndefined()
})

test('folded summaries', () => {
  const ui = {} as never
  expect(context.summary?.({ usage: MEASURED }, ui, CFG, WIDTH, colors())).toBe('9%')
  expect(context.summary?.({ usage: FRESH }, ui, CFG, WIDTH, colors())).toBe('0%')
  expect(limits.summary?.({ usage: MEASURED }, ui, CFG, WIDTH, colors())).toBe('5h 34% · wk 81%')
  expect(limits.summary?.({ usage: FRESH }, ui, CFG, WIDTH, colors())).toBeUndefined()
})

// Scenario: the Sidebar through register.tsx's hooks.

const SIDEBAR = {
  plugin: 'ctui',
  surface: 'terminal',
  component: 'Pane',
  requestId: 'sidebar',
  props: {
    title: 'Sidebar',
    isFocused: false,
    bodyColumns: 42,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

// Answers `$.session.usage()` and the other loaders beneath the plugin.
function host(on: On, usage: SessionUsage) {
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('session.usage', () => ({ value: usage }))
  on('session.cwd', () => ({ value: '/srv/x' }))
  on('env.get', () => ({ value: '/home/a' }))
  on('session.version', () => ({ value: { version: '2.1.288' } }))
  on('agent.list', () => ({ value: [] }))
  on('fs.read', () => ({ value: '{ "version": "0.0.0" }' }))
  on('fs.exists', () => ({ value: false }))
  on('fs.stat', () => {
    throw new Error('ENOENT')
  })
  on('tool.list', () => ({ value: [] }))
  on('process.run', () => ({
    value: { exitCode: 128, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false },
  }))
}

test('session.measure moves the context and limits rows', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  host(on, { startedAt: NOW, ...FRESH })
  on('session.measure', ($, e) => ({ changed: e.changed }))
  await $.session.start({ cwd: '/srv/x', surface: 'terminal', isInteractive: true })
  await clock.settle()

  const pane = await $.ui.mount(SIDEBAR)
  expect(await pane.find({ type: 'Text', text: /^─+ +0%$/ })).toBeDefined()
  expect(await pane.find({ text: '0 / 200k tokens' })).toBeDefined()
  expect(await pane.find({ text: /^cost +\$0\.00$/ })).toBeDefined()
  expect(await pane.find({ text: 'no limits reported' })).toBeUndefined()

  const measured: SessionMeasureInput = { ...MEASURED, changed: ['context', 'rateLimits', 'cost'] }
  await $.session.measure(measured)
  await pane.redraw()
  expect(await pane.find({ type: 'Text', text: /^━+─+ +9%$/ })).toBeDefined()
  expect(await pane.find({ text: '18,402 / 200k tokens' })).toBeDefined()
  expect(await pane.find({ text: /^5h +━+─+ +34%$/ })).toBeDefined()
  expect(await pane.find({ text: /resets in 2h 17m$/ })).toBeDefined()
  expect(await pane.find({ text: /^cost +\$0\.21$/ })).toBeDefined()

  // The reset times count down with the tick, to the second.
  await clock.advance(30_000)
  await pane.redraw()
  expect(await pane.find({ text: /resets in 2h 16m$/ })).toBeDefined()
  await clock.advance(60_000)
  await pane.redraw()
  expect(await pane.find({ text: /resets in 2h 15m$/ })).toBeDefined()

  // Folded, each section reads its summary.
  await pane.pointer({ type: 'down', x: 0, y: 0, button: 'left', in: 'fold-context' })
  await pane.pointer({ type: 'down', x: 0, y: 0, button: 'left', in: 'fold-limits' })
  expect(await pane.find({ text: '9%', in: 'foldrow-context' })).toBeDefined()
  expect(await pane.find({ text: '5h 34% · wk 81%', in: 'foldrow-limits' })).toBeDefined()
  expect(await pane.find({ text: /\$/ })).toBeUndefined()
})

test('with Limits cost off in /config, Limits draws no cost row', { options: { limits_cost: false } }, async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  host(on, { startedAt: NOW, ...MEASURED })
  await $.session.start({ cwd: '/srv/x', surface: 'terminal', isInteractive: true })
  await clock.settle()
  const pane = await $.ui.mount(SIDEBAR)
  expect(await pane.find({ text: /^5h +━+─+ +34%$/ })).toBeDefined()
  expect(await pane.find({ text: /^cost|\$/ })).toBeUndefined()
})

// `/clear` empties `$.state` with no `session.start`; the test empties the
// `usage` and `versions` keys beneath the plugin until the plugin writes them again.
test('after /clear empties $.state, the tick reloads the usage and the versions', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  host(on, { startedAt: NOW, ...MEASURED })
  const cleared = new Set<string>()
  on('state.get', async ($, e, next) => (cleared.has(e.key) ? { value: { value: undefined, version: 0 } } : next(e)))
  on('state.set', async ($, e, next) => {
    cleared.delete(e.key)
    return next(e)
  })
  await $.session.start({ cwd: '/srv/x', surface: 'terminal', isInteractive: true })
  await clock.settle()
  const pane = await $.ui.mount(SIDEBAR)
  expect(await pane.find({ text: '18,402 / 200k tokens' })).toBeDefined()
  expect(await pane.find({ text: 'claude-cli 2.1.288' })).toBeDefined()

  cleared.add('usage').add('versions')
  await pane.redraw()
  expect(await pane.find({ text: /tokens/ })).toBeUndefined()
  expect(await pane.find({ text: /claude-cli/ })).toBeUndefined()
  await clock.advance(1000)
  await pane.redraw()
  expect(await pane.find({ text: 'claude-cli 2.1.288' })).toBeDefined()
  expect(await pane.find({ text: '18,402 / 200k tokens' })).toBeDefined()
})
