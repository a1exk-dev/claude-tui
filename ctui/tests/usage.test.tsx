import type { On, SessionMeasureInput, SessionUsage } from 'claude-code'
import { type Engine, expect, mock, test } from 'claude-code/testing'

import { readConfig, type SectionConfig } from '../hooks/config'
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

// The `limits` settings as `readConfig` regroups them: `limits_cost` auto,
// on and off, with the default limit of 100.
const AUTO: SectionConfig = { enable: true, cost: 'auto', monthly: 100 }
const ON: SectionConfig = { ...AUTO, cost: 'on' }
const OFF: SectionConfig = { ...AUTO, cost: 'off' }

// Draws one plugin's view rows in a test Pane, as the Sidebar does.
async function draw($: Engine, on: On, plugin: SidebarPlugin, data: SidebarData, cfg: SectionConfig = AUTO, width = WIDTH) {
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

// The cost row: `cost`, a bar and its percent, then a muted line under them.
async function costRows(pane: Pane) {
  const rows = await pane.findAll({ type: 'Text', text: /^(5h|week|spend|cost| {6}\S)/ })
  const at = rows.findIndex((row) => row.text.startsWith('cost'))
  return { at, row: rows[at], under: rows[at + 1], count: rows.length }
}

for (const [columns, width] of [
  [42, 36],
  [53, 47],
] as const) {
  test(`at ${columns} columns the cost row opens limits, its percent under the others`, async ($, on) => {
    const usage = { ...MEASURED, cost: { usd: 62 } }
    const pane = await draw($, on, limits, { usage, now: NOW }, ON, width)
    const { at, row, under } = await costRows(pane)
    expect(at).toBe(0)
    expect(row?.text).toHaveLength(width)
    expect(row?.text).toMatch(/^cost {2}━+─+ +62%$/)
    expect(await barOf(pane, /^cost/)).toEqual({
      filled: Math.round((width - 11) * 0.62),
      empty: width - 11 - Math.round((width - 11) * 0.62),
      colors: ['warning', 'subtle', 'text'],
    })
    expect(under?.text).toBe(`${' '.repeat(6)}62.00$ of 100$`)
    expect(under?.props.color).toBe('inactive')
  })
}

test('over the limit the cost row fills in error and reads the real percent', async ($, on) => {
  const pane = await draw($, on, limits, { usage: { ...FRESH, cost: { usd: 134 } }, now: NOW })
  expect(await barOf(pane, /^cost/)).toEqual({ filled: 25, empty: 0, colors: ['error', 'subtle', 'text'] })
  expect((await costRows(pane)).row?.text).toMatch(/ 134%$/)
  expect((await costRows(pane)).under?.text.trim()).toBe('134.00$ of 100$')
})

test('a limit with cents reads as given', async ($, on) => {
  const pane = await draw($, on, limits, { usage: { ...FRESH, cost: { usd: 25 } }, now: NOW }, { ...AUTO, monthly: 50.5 })
  expect((await costRows(pane)).under?.text.trim()).toBe('25.00$ of 50.5$')
})

test('with no limit the cost row keeps an empty bar, no percent, and the total under it', async ($, on) => {
  const pane = await draw($, on, limits, { usage: { ...FRESH, cost: { usd: 62 } }, now: NOW }, { ...AUTO, monthly: 0 })
  const { row, under } = await costRows(pane)
  expect(row?.text).toBe(`cost  ${'─'.repeat(WIDTH - 11)}`)
  expect(row?.text).not.toMatch(/%/)
  expect(under?.text.trim()).toBe('62.00$')
  expect(under?.props.color).toBe('inactive')
})

const SPEND: Usage = { ...FRESH, rateLimits: [{ kind: 'spend_limit', percentUsed: 41 }], cost: { usd: 62 } }

for (const [name, usage, cfg, shown] of [
  ['auto on a plan', MEASURED, AUTO, false],
  ['auto with no windows', FRESH, AUTO, true],
  ['auto behind a gateway', SPEND, AUTO, true],
  ['on on a plan', MEASURED, ON, true],
  ['on with no windows', FRESH, ON, true],
  ['on behind a gateway', SPEND, ON, true],
  ['off on a plan', MEASURED, OFF, false],
  ['off with no windows', FRESH, OFF, false],
  ['off behind a gateway', SPEND, OFF, false],
] as const) {
  test(`limits_cost ${name} ${shown ? 'shows' : 'hides'} the cost row`, async ($, on) => {
    const pane = await draw($, on, limits, { usage, now: NOW }, cfg)
    expect((await costRows(pane)).at).toBe(shown ? 0 : -1)
  })
}

test('behind a gateway the cost row sits above spend, each with its own line', async ($, on) => {
  const pane = await draw($, on, limits, { usage: SPEND, now: NOW })
  const rows = await pane.findAll({ type: 'Text', text: /^(spend|cost| {6}\S)/ })
  expect(rows.map((row) => row.text.replace(/━*─+/, ' ━ ').replace(/\s+/g, ' ').trim())).toEqual([
    'cost ━ 62%',
    '62.00$ of 100$',
    'spend ━ 41%',
  ])
})

for (const [name, usage, cfg] of [
  ['no cost reported', { ...FRESH, cost: undefined }, AUTO],
  ['limits_cost off', FRESH, OFF],
] as const) {
  test(`with no windows and ${name} limits says so`, async ($, on) => {
    const pane = await draw($, on, limits, { usage, now: NOW }, cfg)
    const row = await pane.find({ type: 'Text', text: 'no limits reported' })
    expect(row?.props.color).toBe('inactive')
    expect(await pane.find({ text: /^cost/ })).toBeUndefined()
  })
}

test('folded summaries', () => {
  const ui = {} as never
  const summary = (usage: Usage, cfg = AUTO) => limits.summary?.({ usage }, ui, cfg, WIDTH, colors())
  expect(context.summary?.({ usage: MEASURED }, ui, AUTO, WIDTH, colors())).toBe('9%')
  expect(context.summary?.({ usage: FRESH }, ui, AUTO, WIDTH, colors())).toBe('0%')
  // A plan with the cost row hidden folds to its windows alone.
  expect(summary(MEASURED)).toBe('5h 34% · wk 81%')
  // The cost leads in whole dollars, limit or not.
  expect(summary({ ...MEASURED, cost: { usd: 62.4 } }, ON)).toBe('62$ · 5h 34% · wk 81%')
  expect(summary(SPEND)).toBe('62$ · spend 41%')
  expect(summary({ ...FRESH, cost: { usd: 12.3 } })).toBe('12$')
  expect(summary({ ...FRESH, cost: { usd: 134 } })).toBe('134$')
  expect(summary({ ...FRESH, cost: { usd: 62 } }, { ...AUTO, monthly: 0 })).toBe('62$')
  expect(summary(FRESH, OFF)).toBeUndefined()
  // Every case fits the 42-column title row beside `Limits:`.
  const full = MEASURED.rateLimits.map((window) => ({ ...window, percentUsed: 100 }))
  const widest = summary({ ...MEASURED, rateLimits: full, cost: { usd: 1234 } }, ON)
  expect(String(widest).length).toBeLessThanOrEqual(WIDTH - 1 - 'Limits: '.length)
})

test('readConfig reads limits_cost as auto, on or off, and the limit as a number', () => {
  expect(readConfig({}).limits).toMatchObject({ cost: 'auto', monthly: 100 })
  expect(readConfig({ limits_cost: 'on', limits_cost_monthly: 0 }).limits).toMatchObject({ cost: 'on', monthly: 0 })
  expect(readConfig({ limits_cost: 'off', limits_cost_monthly: 250 }).limits).toMatchObject({ cost: 'off', monthly: 250 })
  // A hand-edited empty limit reads as the default.
  expect(readConfig({ limits_cost_monthly: '' }).limits.monthly).toBe(100)
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
  // No windows yet: `auto` shows the cost row.
  expect(await pane.find({ text: /^cost +─+ +0%$/ })).toBeDefined()
  expect(await pane.find({ text: /^ +0\.00\$ of 100\$$/ })).toBeDefined()
  expect(await pane.find({ text: 'no limits reported' })).toBeUndefined()

  const measured: SessionMeasureInput = { ...MEASURED, changed: ['context', 'rateLimits', 'cost'] }
  await $.session.measure(measured)
  await pane.redraw()
  expect(await pane.find({ type: 'Text', text: /^━+─+ +9%$/ })).toBeDefined()
  expect(await pane.find({ text: '18,402 / 200k tokens' })).toBeDefined()
  expect(await pane.find({ text: /^5h +━+─+ +34%$/ })).toBeDefined()
  expect(await pane.find({ text: /resets in 2h 17m$/ })).toBeDefined()
  // The plan's windows arrive: `auto` hides the cost row.
  expect(await pane.find({ text: /^cost/ })).toBeUndefined()

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

test('with Limits cost off in /config, Limits draws no cost row', { options: { limits_cost: 'off' } }, async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  host(on, { startedAt: NOW, ...FRESH })
  await $.session.start({ cwd: '/srv/x', surface: 'terminal', isInteractive: true })
  await clock.settle()
  const pane = await $.ui.mount(SIDEBAR)
  expect(await pane.find({ text: 'no limits reported' })).toBeDefined()
  expect(await pane.find({ text: /^cost|\$/ })).toBeUndefined()
})

test(
  'with Limits cost on and a 50 limit in /config, a plan shows the cost row first, folded too',
  { options: { limits_cost: 'on', limits_cost_monthly: 50 } },
  async ($, on) => {
    const clock = mock.clock(on, { now: NOW })
    host(on, { startedAt: NOW, ...MEASURED, cost: { usd: 31 } })
    await $.session.start({ cwd: '/srv/x', surface: 'terminal', isInteractive: true })
    await clock.settle()
    const pane = await $.ui.mount(SIDEBAR)
    const rows = await pane.findAll({ type: 'Text', text: /^(cost|5h|week)/ })
    expect(rows.map((row) => row.text.split(' ')[0])).toEqual(['cost', '5h', 'week'])
    expect(rows[0]?.text).toMatch(/ 62%$/)
    expect(await pane.find({ text: /^ +31\.00\$ of 50\$$/ })).toBeDefined()
    await pane.pointer({ type: 'down', x: 0, y: 0, button: 'left', in: 'fold-limits' })
    expect(await pane.find({ text: '31$ · 5h 34% · wk 81%', in: 'foldrow-limits' })).toBeDefined()
  },
)

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
