import type { ConfigRow, ConfigSetInput, On, PaneOpenArgs } from 'claude-code'
import { type Engine, expect, mock, test } from 'claude-code/testing'

import { deniedText, moveId, takenBy } from '../hooks/menu'
import { register } from '../hooks/register'
import type { Menu } from '../types'

// Scenario: the `/ctui` menu (#173) through `$.command.run` and its pane, with
// this test's own `config.set` hook standing in for the engine's writer. A
// write reloads the mod; the test kit doesn't, so a test that needs the new
// option sets it with `options`, and `$.state` carries the menu as a reload does.

const THEME_ROW: ConfigRow = {
  key: 'ctui.theme',
  label: 'Sidebar theme',
  kind: 'choice',
  value: 'inherit',
  options: ['inherit'],
  provider: { plugin: 'ctui', tier: 'user' },
  isLocked: false,
}

// The manifest's `theme` options and each Theme file's `name`, cut down.
const NAMES: Record<string, string> = { everforest: 'Everforest', 'tokyo-night': 'Tokyo Night', catppuccin: 'Catppuccin' }
const OPTIONS = ['inherit', 'catppuccin', 'everforest', 'tokyo-night']

type World = { rows?: ConfigRow[]; deny?: string; register?: string; toasts?: string[] }

// The world beneath the plugin: files, `/config` rows (none under `claude -p`),
// the writer, the command registry, toasts, and the panes opened and closed.
function host(on: On, world: World = {}) {
  const seen = {
    sets: [] as Pick<ConfigSetInput, 'key' | 'value'>[],
    opens: [] as PaneOpenArgs[],
    closes: [] as string[],
    registered: [] as unknown[],
  }
  on('fs.read', (_, e) => {
    const slug = /\/themes\/([\w-]+)\.json$/.exec(e.path)?.[1]
    if (slug) return { value: JSON.stringify({ name: NAMES[slug], base: 'dark', overrides: {} }) }
    return { value: JSON.stringify({ version: '0.0.0', userConfig: { theme: { options: OPTIONS } } }) }
  })
  on('config.list', () => ({ value: world.rows ?? [THEME_ROW] }))
  on('config.set', (_, e) => {
    seen.sets.push({ key: e.key, value: e.value })
    return world.deny === undefined ? { value: e.value } : { deny: world.deny }
  })
  on('command.register', (_, e) => {
    seen.registered.push(e)
    return world.register === undefined ? { value: { command: e.name } } : { deny: world.register }
  })
  on('ui.open', (_, e) => {
    seen.opens.push(e)
    return { value: { isPlaced: true } }
  })
  on('ui.close', (_, e) => {
    seen.closes.push(e.id)
    return { value: undefined }
  })
  on('ui.toast', (_, e) => {
    world.toasts?.push(e.text)
    return { value: undefined }
  })
  on('ui.focus', () => ({}))
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('env.set', () => ({ value: undefined }))
  return seen
}

const start = ($: Engine) => $.session.start({ cwd: '/srv/x', surface: 'terminal', isInteractive: true })

// The person types `/ctui <args>` in a fullscreen terminal.
const run = ($: Engine, args = '') =>
  $.command.run({ command: 'ctui', args, origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 150 } })

const menu = ($: Engine, placement: 'dock' | 'inline' = 'dock') =>
  $.ui.mount({
    plugin: 'ctui',
    surface: 'terminal',
    component: 'Pane',
    requestId: 'ctui',
    props: {
      title: 'Settings',
      isFocused: true,
      bodyColumns: 42,
      placement,
      scroll: { offset: 0, bodyRows: 30 },
      view: {},
    },
  })

type Pane = Awaited<ReturnType<typeof menu>>
type Node = { type?: string; key?: string; props?: Record<string, unknown>; children?: unknown[] }

// What each Text in `node` shows, outermost first: a row's lead, label and value.
const cellsOf = (node: Node): string[] =>
  node.type === 'Text'
    ? [(node.children ?? []).map((child) => (typeof child === 'string' ? child : cellsOf(child as Node).join(''))).join('')]
    : (node.children ?? []).flatMap((child) => (typeof child === 'string' ? [] : cellsOf(child as Node)))

// The menu's rows whose `›` Button's key starts with `prefix`, as their cells.
const rowsOf = async (pane: Pane, prefix: string) =>
  (await pane.findAll({ type: 'Box' }))
    .filter(({ children }) => {
      const [first] = children as Node[]
      return first?.type === 'Button' && String(first.key ?? first.props?.key).startsWith(prefix)
    })
    .map((row) => cellsOf(row as Node))

// The Theme rows' slugs, in order.
const themesOf = async (pane: Pane) =>
  (await pane.findAll({ type: 'Button' })).flatMap(({ key }) => (key?.startsWith('theme-') ? [key.slice('theme-'.length)] : []))

// The footer: the `key: label` pairs under the `─` rule.
const footerOf = async (pane: Pane) => (await pane.findAll({ type: 'Box', text: /^↑↓: move|^type: filter/ })).at(-1)?.text

// The person's Esc on the focused menu: `closeOnEscape` raises `ui.close`,
// origin `person`. The test kit has no driver for it, so this calls ctui's
// hook as the engine would, with a `$` holding the menu's state, the opens,
// the writes, the ring moves (each with the opens made before it) and a clock
// that runs at once.
type MenuState = Menu
type Focus = { requestId: string; key: string; opensBefore: number }
async function esc(state: { menu?: MenuState }, opens: PaneOpenArgs[], sets: unknown[] = [], focuses: Focus[] = []) {
  let close: ((...args: unknown[]) => unknown) | undefined
  const record = (event: string, matcher: { id?: string }, hook: (...args: unknown[]) => unknown) => {
    if (event === 'ui.close' && matcher.id === 'ctui') close = hook
  }
  register(record as unknown as On, {})
  const work: Promise<unknown>[] = []
  const $ = {
    clock: { after: (_: number, run: () => Promise<unknown>) => void work.push(run()) },
    state: {
      get: async () => ({ value: state.menu }),
      set: async (_: unknown, value: MenuState) => void (state.menu = value),
    },
    ui: {
      open: async (args: PaneOpenArgs) => void opens.push(args),
      focus: async (args: { requestId: string; key: string }) => void focuses.push({ ...args, opensBefore: opens.length }),
    },
    config: {
      set: async (args: { key: string; value: unknown }) => {
        sets.push(args)
        return { value: args.value }
      },
    },
  }
  const answer = await close?.($, { id: 'ctui', origin: { kind: 'person' } }, () => 'closed')
  await Promise.all(work)
  return answer
}

test('session start registers /ctui as an immediate command', async ($, on) => {
  const seen = host(on)
  await start($)
  expect(seen.registered).toEqual([{ name: 'ctui', description: expect.any(String), immediate: true }])
})

const OPEN = { id: 'ctui', title: 'Settings', focus: true, closeOnEscape: true, columns: 42, rows: 24 }

test('/ctui opens the focused menu at its top level, whatever follows it', { options: { theme: 'tokyo-night', todo_enable: false } }, async ($, on) => {
  const seen = host(on)
  expect(await run($, 'themes everforest')).toEqual({})
  expect(seen.opens).toEqual([OPEN])
  const pane = await menu($)
  expect(await pane.find({ type: 'Text', text: /^Settings/ })).toMatchObject({ text: 'Settings', props: { bold: true } })
  expect(await rowsOf(pane, 'row-')).toEqual([
    ['Plugins', '5/6 ›'],
    ['Themes', 'Tokyo Night ›'],
  ])
  // The ring starts on Plugins.
  expect((await pane.find({ type: 'Button', key: 'row-plugins' }))?.props.autoFocus).toBe(true)
  expect(await footerOf(pane)).toBe('↑↓: move · enter: open · esc: close')
  expect(seen.sets).toEqual([])
})

test('docked, the menu fills the body rows; inline it fits its content', async ($, on) => {
  host(on)
  await run($)
  const docked = await menu($)
  expect((await docked.find({ type: 'Box' }))?.props).toMatchObject({ width: 42, height: 30 })
  await docked.unmount()
  expect((await (await menu($, 'inline')).find({ type: 'Box' }))?.props).not.toHaveProperty('height')
})

test('the ring never lands on the hidden hotkeys', async ($, on) => {
  host(on)
  await openPlugins($)
  for (const element of ['menu-toggle', 'menu-up', 'menu-down']) {
    expect(await $.ui.focus({ component: 'Pane', requestId: 'ctui', plugin: 'ctui', element, origin: { kind: 'person' } })).toEqual({ deny: expect.any(String) })
  }
})

test('under claude -p /ctui prints the fixed line and opens nothing', async ($, on) => {
  const seen = host(on, { rows: [] })
  expect(await run($)).toEqual({
    text: "Can't change ctui settings in claude -p. Use /config in an interactive session.",
  })
  expect(seen.opens).toEqual([])
})

test('a taken /ctui toasts once per session, and the Sidebar still draws', { options: { agents_toasts: false } }, async ($, on) => {
  const clock = mock.clock(on)
  const toasts: string[] = []
  host(on, { register: '"/ctui" refused: the plugin acme registered it already', toasts })
  await start($)
  await start($) // a settings reload runs session.start again
  await clock.settle()
  expect(toasts).toEqual(['/ctui is taken by the acme plugin; change ctui settings in /config'])
  const sidebar = await $.ui.mount({
    plugin: 'ctui',
    surface: 'terminal',
    component: 'Pane',
    requestId: 'sidebar',
    props: { title: 'Sidebar', isFocused: false, bodyColumns: 42, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
  })
  expect(await sidebar.find({ type: 'Client', key: 'foldrow-context' })).toBeDefined()
})

test('who holds /ctui, from the engine’s refusal', () => {
  expect(takenBy('"/ctui" refused: the plugin acme registered it already')).toBe('the acme plugin')
  expect(takenBy('"/ctui" refused: it is the user\'s /ctui')).toBe('your own /ctui')
})

const openThemes = async ($: Engine) => {
  await run($)
  const pane = await menu($)
  await pane.press({ key: 'row-themes' })
  return pane
}

test('Themes: inherit, then the Themes by name A–Z, the current one marked', { options: { theme: 'tokyo-night' } }, async ($, on) => {
  host(on)
  const pane = await openThemes($)
  expect(await pane.find({ type: 'Text', text: /^Settings/ })).toMatchObject({ text: 'Settings › Themes' })
  expect((await pane.find({ type: 'Input', key: 'menu-filter' }))?.props.autoFocus).toBe(true)
  expect(await rowsOf(pane, 'theme-')).toEqual([['inherit'], ['Catppuccin'], ['Everforest'], ['Tokyo Night', '●']])
  expect((await pane.find({ type: 'Text', text: '●' }))?.props.color).toBe('suggestion')
  expect(await footerOf(pane)).toBe('type: filter · ↑↓: move · enter: pick · esc: back')
})

test('the Theme rows scroll with the ring, ↑ more and ↓ more marking what is cut off', async ($, on) => {
  host(on)
  await (await openThemes($)).unmount()
  // 15 body rows leave 2 Theme rows under the frame, the field and the footer.
  const short = await $.ui.mount({
    plugin: 'ctui',
    surface: 'terminal',
    component: 'Pane',
    requestId: 'ctui',
    props: { title: 'Settings', isFocused: true, bodyColumns: 42, placement: 'dock', scroll: { offset: 0, bodyRows: 15 }, view: {} },
  })
  expect(await themesOf(short)).toEqual(['inherit', 'catppuccin'])
  expect(await short.find({ type: 'Text', text: '↓ more' })).toBeDefined()
  await $.ui.focus({ component: 'Pane', requestId: 'ctui', plugin: 'ctui', element: 'theme-tokyo-night', origin: { kind: 'person' } })
  await short.redraw()
  expect(await themesOf(short)).toEqual(['everforest', 'tokyo-night'])
  expect(await short.find({ type: 'Text', text: '↑ more' })).toBeDefined()
  expect(await short.find({ type: 'Text', text: '↓ more' })).toBeUndefined()
  // The ringed row keeps the ring through a redraw.
  expect((await short.find({ type: 'Button', key: 'theme-tokyo-night' }))?.props.autoFocus).toBe(true)
  expect((await short.find({ type: 'Input', key: 'menu-filter' }))?.props.autoFocus).toBeUndefined()
})

test('the Theme window follows the ring above the current Theme', { options: { theme: 'tokyo-night' } }, async ($, on) => {
  host(on)
  await (await openThemes($)).unmount()
  const short = await $.ui.mount({
    plugin: 'ctui',
    surface: 'terminal',
    component: 'Pane',
    requestId: 'ctui',
    props: { title: 'Settings', isFocused: true, bodyColumns: 42, placement: 'dock', scroll: { offset: 0, bodyRows: 15 }, view: {} },
  })
  // It opens on the current Theme, then moves up with the ring.
  expect(await themesOf(short)).toEqual(['everforest', 'tokyo-night'])
  await $.ui.focus({ component: 'Pane', requestId: 'ctui', plugin: 'ctui', element: 'theme-catppuccin', origin: { kind: 'person' } })
  await short.redraw()
  expect(await themesOf(short)).toEqual(['inherit', 'catppuccin'])
})

test('the filter narrows the Themes on each keystroke; nothing left reads no match', async ($, on) => {
  host(on)
  const pane = await openThemes($)
  await pane.input({ key: 'menu-filter', text: 'N', kind: 'change' })
  expect(await themesOf(pane)).toEqual(['inherit', 'catppuccin', 'tokyo-night'])
  await pane.input({ key: 'menu-filter', text: 'xyz', kind: 'change' })
  expect(await themesOf(pane)).toEqual([])
  expect(await pane.find({ type: 'Text', text: 'no match' })).toBeDefined()
})

test('a pick writes the theme once; the menu stays on Themes with its filter', async ($, on) => {
  const clock = mock.clock(on)
  const seen = host(on)
  const pane = await openThemes($)
  await pane.input({ key: 'menu-filter', text: 'ever', kind: 'change' })
  await pane.press({ key: 'theme-everforest' })
  await clock.settle()
  expect(seen.sets).toEqual([{ key: 'ctui.theme', value: 'everforest' }])
  expect(seen.closes).toEqual([])
  // The reload's redraw reads the menu back from $.state.
  await pane.redraw()
  expect((await pane.find({ type: 'Input', key: 'menu-filter' }))?.props.value).toBe('ever')
  expect(await themesOf(pane)).toEqual(['everforest'])
})

test('picking the current Theme writes nothing', async ($, on) => {
  const clock = mock.clock(on)
  const seen = host(on)
  await (await openThemes($)).press({ key: 'theme-inherit' })
  await clock.settle()
  expect(seen.sets).toEqual([])
})

test('a refused pick toasts the deny, even with agent toasts off', { options: { agents_toasts: false } }, async ($, on) => {
  const clock = mock.clock(on)
  const toasts: string[] = []
  host(on, { deny: 'locked by policy', toasts })
  await (await openThemes($)).press({ key: 'theme-everforest' })
  await clock.settle()
  expect(toasts).toEqual(["Can't switch the Sidebar theme to everforest: locked by policy"])
})

for (const level of ['themes', 'plugins'] as const) {
  test(`Esc in ${level} goes back to the top and takes the keys back; Esc at the top closes`, async () => {
    const state: { menu?: MenuState } = { menu: { level, filter: '', picks: { top: level } } }
    const opens: PaneOpenArgs[] = []
    const focuses: Focus[] = []
    expect(await esc(state, opens, [], focuses)).toEqual({ deny: expect.any(String) })
    // The ring goes back to the row just left.
    expect(state.menu).toEqual({ level: 'top', filter: '', picks: { top: level }, ring: `row-${level}` })
    // The deny hands the keys to the prompt: the menu opens again to take them back,
    // then moves the ring, which keeps its index through the open (#238).
    expect(opens).toEqual([OPEN])
    expect(focuses).toEqual([{ requestId: 'ctui', key: `row-${level}`, opensBefore: 1 }])
    expect(await esc(state, opens)).toBe('closed')
  })
}

// The Plugins screen (#176).

const openPlugins = async ($: Engine) => {
  await run($)
  const pane = await menu($)
  await pane.press({ key: 'row-plugins' })
  return pane
}

// The ring on a plugin's row, as the arrows move it.
const focusRow = ($: Engine, id: string) =>
  $.ui.focus({ component: 'Pane', requestId: 'ctui', plugin: 'ctui', element: `plugin-${id}`, origin: { kind: 'person' } })

// The Plugins rows' titles, in order.
const titlesOf = async (pane: Pane) => (await rowsOf(pane, 'plugin-')).map(([, title]) => title)

const EYE = '\u{f06e}  '
const EYE_SLASH = '\u{f070}  '

test('Plugins lists each section in the saved order: an eye when shown, its title, expanded or folded; then the keys', { options: { order: 'mcp', todo_enable: false, limits_folded: true } }, async ($, on) => {
  host(on)
  const pane = await openPlugins($)
  expect(await pane.find({ type: 'Text', text: /^Settings/ })).toMatchObject({ text: 'Settings › Plugins' })
  expect(await rowsOf(pane, 'plugin-')).toEqual([
    [EYE, 'MCP', 'expanded ›'],
    [EYE, 'Context', 'expanded ›'],
    [EYE, 'Limits', 'folded ›'],
    [EYE_SLASH, 'Todo', 'expanded ›'],
    [EYE, 'Skills', 'expanded ›'],
    [EYE, 'Agents & shells', 'expanded ›'],
  ])
  expect((await pane.find({ type: 'Text', text: EYE_SLASH }))?.props.color).toBe('inactive')
  expect(await footerOf(pane)).toBe('↑↓: move · enter: settings · x: show/hide · k/j: move row · esc: back')
  // `x`, `k` and `j` are hotkeys, drawn nowhere.
  expect((await pane.findAll({ type: 'Button' })).map((button) => button.props.hotkey).filter(Boolean)).toEqual(['x', 'k', 'j'])
  expect((await pane.find({ type: 'Box', text: /^show\/hide/ }))?.props.display).toBe('none')
})

test('x turns the focused plugin on or off, saving once', { options: { todo_enable: false } }, async ($, on) => {
  const clock = mock.clock(on)
  const seen = host(on)
  const pane = await openPlugins($)
  await focusRow($, 'todo')
  await pane.press({ key: 'menu-toggle' })
  await clock.settle()
  expect(seen.sets).toEqual([{ key: 'ctui.todo_enable', value: true }])
  expect(seen.closes).toEqual([])
})

test('k/j move the focused row at once, keep the ring on it, and save the order once, a second after the last move', async ($, on) => {
  const clock = mock.clock(on)
  const seen = host(on)
  const pane = await openPlugins($)
  await focusRow($, 'context')
  await pane.press({ key: 'menu-down' })
  await clock.advance(500)
  await pane.press({ key: 'menu-down' })
  await clock.advance(100)
  expect(await titlesOf(pane)).toEqual(['Limits', 'Todo', 'Context', 'Skills', 'MCP', 'Agents & shells'])
  expect(seen.sets).toEqual([])
  await clock.advance(1000)
  expect(seen.sets).toEqual([{ key: 'ctui.order', value: 'limits,todo,context,skills,mcp,agents' }])
  // The moved row keeps the ring: the redraw focuses it.
  expect((await pane.find({ type: 'Button', key: 'plugin-context' }))?.props.autoFocus).toBe(true)
})

test('x with an order waiting writes the order first', async ($, on) => {
  const clock = mock.clock(on)
  const seen = host(on)
  const pane = await openPlugins($)
  await focusRow($, 'mcp')
  await pane.press({ key: 'menu-up' })
  await pane.press({ key: 'menu-toggle' })
  await clock.settle()
  expect(seen.sets).toEqual([
    { key: 'ctui.order', value: 'context,limits,todo,mcp,skills,agents' },
    { key: 'ctui.mcp_enable', value: false },
  ])
  // The timer finds nothing left to write.
  await clock.advance(2000)
  expect(seen.sets).toHaveLength(2)
})

test('Esc on Plugins with an order waiting writes it, then goes back', async () => {
  const state: { menu?: MenuState } = { menu: { level: 'plugins', filter: '', picks: { top: 'plugins' }, pending: ['mcp', 'context'], focus: 'mcp' } }
  const sets: unknown[] = []
  expect(await esc(state, [], sets)).toEqual({ deny: expect.any(String) })
  expect(sets).toEqual([{ key: 'ctui.order', value: 'mcp,context' }])
  expect(state.menu?.level).toBe('top')
  expect(state.menu?.pending).toBeUndefined()
})

test('Enter opens a plugin’s screen, even off; Esc returns to its row', { options: { mcp_enable: false } }, async ($, on) => {
  host(on)
  const pane = await openPlugins($)
  await pane.press({ key: 'plugin-mcp' })
  expect(await pane.find({ type: 'Text', text: /^Settings/ })).toMatchObject({ text: 'Settings › Plugins › MCP' })
  const state: { menu?: MenuState } = { menu: { level: 'plugin', filter: '', picks: { top: 'plugins' }, focus: 'mcp', ring: 'setting-mcp_folded' } }
  const focuses: Focus[] = []
  expect(await esc(state, [], [], focuses)).toEqual({ deny: expect.any(String) })
  expect(state.menu).toMatchObject({ level: 'plugins', focus: 'mcp', ring: 'plugin-mcp' })
  expect(focuses).toEqual([{ requestId: 'ctui', key: 'plugin-mcp', opensBefore: 1 }])
})

// Plugin settings screens (#177).

const openPlugin = async ($: Engine, id: string) => {
  const pane = await openPlugins($)
  await pane.press({ key: `plugin-${id}` })
  return pane
}

const settingsOf = async (pane: Pane) => (await rowsOf(pane, 'setting-')).map((cells) => cells.join('  '))

test('Limits: Start folded, Cost and a Monthly cost field holding the saved value; then the keys', async ($, on) => {
  host(on)
  const pane = await openPlugin($, 'limits')
  expect(await pane.find({ type: 'Text', text: /^Settings/ })).toMatchObject({ text: 'Settings › Plugins › Limits' })
  expect(await settingsOf(pane)).toEqual(['Start folded  off', 'Cost  auto'])
  expect((await pane.find({ type: 'Button', key: 'setting-limits_folded' }))?.props.autoFocus).toBe(true)
  expect((await pane.find({ type: 'Input', key: 'menu-monthly-0' }))?.props.value).toBe('100')
  expect(await footerOf(pane)).toBe('↑↓: move · enter: change · esc: back')
})

test('every plugin gets Start folded; Todo adds Task tools, Agents & shells Toasts', { options: { todo_tools: false } }, async ($, on) => {
  host(on)
  const rowsFor = async (id: string) => {
    const pane = await openPlugin($, id)
    const rows = await settingsOf(pane)
    await pane.unmount()
    return rows
  }
  expect(await rowsFor('mcp')).toEqual(['Start folded  off'])
  expect(await rowsFor('todo')).toEqual(['Start folded  off', 'Task tools  off'])
  expect(await rowsFor('agents')).toEqual(['Start folded  off', 'Toasts  on'])
})

test('Start folded saves the flip, pinning the section’s current fold first', async ($, on) => {
  const clock = mock.clock(on)
  const seen = host(on)
  const folds: unknown[] = []
  on('state.set', async ($, e, next) => {
    if (e.key === 'folded') folds.push(e.value)
    return next(e)
  })
  const pane = await openPlugin($, 'mcp')
  await pane.press({ key: 'setting-mcp_folded' })
  await clock.settle()
  expect(folds).toEqual([{ mcp: false }])
  expect(seen.sets).toEqual([{ key: 'ctui.mcp_folded', value: true }])
})

test('Task tools and Toasts flip', { options: { agents_toasts: false } }, async ($, on) => {
  const clock = mock.clock(on)
  const seen = host(on)
  const todo = await openPlugin($, 'todo')
  await todo.press({ key: 'setting-todo_tools' })
  await todo.unmount()
  await (await openPlugin($, 'agents')).press({ key: 'setting-agents_toasts' })
  await clock.settle()
  expect(seen.sets).toEqual([
    { key: 'ctui.todo_tools', value: false },
    { key: 'ctui.agents_toasts', value: true },
  ])
})

for (const [from, to] of [
  ['auto', 'on'],
  ['on', 'off'],
  ['off', 'auto'],
] as const) {
  test(`Cost steps ${from} to ${to}`, { options: { limits_cost: from } }, async ($, on) => {
    const clock = mock.clock(on)
    const seen = host(on)
    await (await openPlugin($, 'limits')).press({ key: 'setting-limits_cost' })
    await clock.settle()
    expect(seen.sets).toEqual([{ key: 'ctui.limits_cost', value: to }])
  })
}

test('Monthly cost saves a number on Enter, 0 (no limit) included; a blank one toasts', { options: { agents_toasts: false } }, async ($, on) => {
  const clock = mock.clock(on)
  const toasts: string[] = []
  const seen = host(on, { toasts })
  const pane = await openPlugin($, 'limits')
  await pane.input({ key: 'menu-monthly-0', text: ' 250 ' })
  await pane.input({ key: 'menu-monthly-0', text: '0' })
  await pane.input({ key: 'menu-monthly-0', text: '  ' })
  await clock.settle()
  expect(seen.sets).toEqual([
    { key: 'ctui.limits_cost_monthly', value: 250 },
    { key: 'ctui.limits_cost_monthly', value: 0 },
  ])
  expect(toasts).toEqual(['Can\'t set the monthly cost: "  " isn\'t a number'])
})

test('Monthly cost text that isn’t a number toasts and writes nothing; the field keeps the saved value', { options: { agents_toasts: false } }, async ($, on) => {
  const clock = mock.clock(on)
  const toasts: string[] = []
  const seen = host(on, { toasts })
  const pane = await openPlugin($, 'limits')
  await pane.input({ key: 'menu-monthly-0', text: '100abc' })
  await clock.settle()
  expect(seen.sets).toEqual([])
  expect(toasts).toEqual(['Can\'t set the monthly cost: "100abc" isn\'t a number'])
  // A new field, holding the saved value.
  expect((await pane.find({ type: 'Input', key: 'menu-monthly-1' }))?.props.value).toBe('100')
})

test('a Monthly cost the engine denies toasts its reason', { options: { agents_toasts: false } }, async ($, on) => {
  const clock = mock.clock(on)
  const toasts: string[] = []
  host(on, { toasts, deny: 'ctui limits_cost_monthly doesn\'t accept "-5". It takes a number between 0 and ∞.' })
  await (await openPlugin($, 'limits')).input({ key: 'menu-monthly-0', text: '-5' })
  await clock.settle()
  expect(toasts).toEqual(['Can\'t set the monthly cost: ctui limits_cost_monthly doesn\'t accept "-5". It takes a number between 0 and ∞.'])
})

test('a deny’s toast names the change', () => {
  expect(deniedText({ key: 'ctui.mcp_enable', value: false }, 'locked')).toBe("Can't disable mcp: locked")
  expect(deniedText({ key: 'ctui.todo_enable', value: true }, 'locked')).toBe("Can't enable todo: locked")
  expect(deniedText({ key: 'ctui.order', value: 'mcp,context' }, 'locked')).toBe("Can't save the Sidebar order: locked")
  expect(deniedText({ key: 'ctui.theme', value: 'tokyo' }, 'locked')).toBe("Can't switch the Sidebar theme to tokyo: locked")
  expect(deniedText({ key: 'ctui.limits_folded', value: true }, 'locked')).toBe("Can't change Start folded for limits: locked")
  expect(deniedText({ key: 'ctui.limits_cost', value: 'on' }, 'locked')).toBe("Can't change Cost: locked")
})

test('a move holds at either end', () => {
  expect(moveId(['a', 'b', 'c'], 'a', -1)).toEqual(['a', 'b', 'c'])
  expect(moveId(['a', 'b', 'c'], 'a', 1)).toEqual(['b', 'a', 'c'])
  expect(moveId(['a', 'b', 'c'], 'c', 1)).toEqual(['a', 'b', 'c'])
})
