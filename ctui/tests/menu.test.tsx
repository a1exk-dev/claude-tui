import type { ConfigRow, ConfigSetInput, On, PaneOpenArgs } from 'claude-code'
import { type Engine, expect, mock, test } from 'claude-code/testing'

import { takenBy } from '../hooks/menu'
import { register } from '../hooks/register'

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
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('env.set', () => ({ value: undefined }))
  return seen
}

const start = ($: Engine) => $.session.start({ cwd: '/srv/x', surface: 'terminal', isInteractive: true })

// The person types `/ctui <args>` in a fullscreen terminal.
const run = ($: Engine, args = '') =>
  $.command.run({ command: 'ctui', args, origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 150 } })

const menu = ($: Engine) =>
  $.ui.mount({
    plugin: 'ctui',
    surface: 'terminal',
    component: 'Pane',
    requestId: 'ctui',
    props: {
      title: 'ctui',
      isFocused: true,
      bodyColumns: 42,
      placement: 'dock',
      scroll: { offset: 0, bodyRows: 30 },
      view: {},
    },
  })

type Option = { value: string; label?: string }
const optionsOf = async (pane: Awaited<ReturnType<typeof menu>>, key: string) =>
  (await pane.find({ type: 'Select', key }))?.props.options as Option[] | undefined

// The person's Esc on the focused menu: `closeOnEscape` raises `ui.close`,
// origin `person`. The test kit has no driver for it, so this calls ctui's
// hook as the engine would, with a `$` holding the menu's state, the opens
// and a clock that runs at once.
async function esc(state: { menu?: { level: string } }, opens: PaneOpenArgs[]) {
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
      set: async (_: unknown, value: { level: string }) => void (state.menu = value),
    },
    ui: { open: async (args: PaneOpenArgs) => void opens.push(args) },
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

test('/ctui opens the focused menu at its top level, whatever follows it', async ($, on) => {
  const seen = host(on)
  expect(await run($, 'themes everforest')).toEqual({})
  expect(seen.opens).toEqual([{ id: 'ctui', title: 'ctui', focus: true, closeOnEscape: true, columns: 42 }])
  const pane = await menu($)
  expect((await optionsOf(pane, 'menu-top'))?.map((option) => option.label)).toEqual(['Plugins ›', 'Themes ›'])
  expect(seen.sets).toEqual([])
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

test('Themes: inherit, then the Themes by name A–Z, the current one selected', { options: { theme: 'tokyo-night' } }, async ($, on) => {
  host(on)
  await run($)
  const pane = await menu($)
  await pane.select({ key: 'menu-top', value: 'themes' })
  expect(await pane.find({ type: 'Input', key: 'menu-filter' })).toBeDefined()
  expect(await optionsOf(pane, 'menu-themes')).toEqual([
    { value: 'inherit', label: 'inherit' },
    { value: 'catppuccin', label: 'Catppuccin' },
    { value: 'everforest', label: 'Everforest' },
    { value: 'tokyo-night', label: 'Tokyo Night' },
  ])
  expect((await pane.find({ type: 'Select', key: 'menu-themes' }))?.props.value).toBe('tokyo-night')
})

test('the filter narrows the Themes on each keystroke; nothing left reads no match', async ($, on) => {
  host(on)
  await run($)
  const pane = await menu($)
  await pane.select({ key: 'menu-top', value: 'themes' })
  await pane.input({ key: 'menu-filter', text: 'N', kind: 'change' })
  expect((await optionsOf(pane, 'menu-themes'))?.map((option) => option.value)).toEqual(['inherit', 'catppuccin', 'tokyo-night'])
  await pane.input({ key: 'menu-filter', text: 'xyz', kind: 'change' })
  expect(await pane.find({ type: 'Select', key: 'menu-themes' })).toBeUndefined()
  expect(await pane.find({ type: 'Text', text: 'no match' })).toBeDefined()
})

test('a pick writes the theme once; the menu stays on Themes with its filter', async ($, on) => {
  const clock = mock.clock(on)
  const seen = host(on)
  await run($)
  const pane = await menu($)
  await pane.select({ key: 'menu-top', value: 'themes' })
  await pane.input({ key: 'menu-filter', text: 'ever', kind: 'change' })
  await pane.select({ key: 'menu-themes', value: 'everforest' })
  await clock.settle()
  expect(seen.sets).toEqual([{ key: 'ctui.theme', value: 'everforest' }])
  expect(seen.closes).toEqual([])
  // The reload's redraw reads the menu back from $.state.
  await pane.redraw()
  expect((await pane.find({ type: 'Input', key: 'menu-filter' }))?.props.value).toBe('ever')
  expect((await optionsOf(pane, 'menu-themes'))?.map((option) => option.value)).toEqual(['everforest'])
})

test('picking the current Theme writes nothing', async ($, on) => {
  const clock = mock.clock(on)
  const seen = host(on)
  await run($)
  const pane = await menu($)
  await pane.select({ key: 'menu-top', value: 'themes' })
  await pane.select({ key: 'menu-themes', value: 'inherit' })
  await clock.settle()
  expect(seen.sets).toEqual([])
})

test('a refused pick toasts the deny, even with agent toasts off', { options: { agents_toasts: false } }, async ($, on) => {
  const clock = mock.clock(on)
  const toasts: string[] = []
  host(on, { deny: 'locked by policy', toasts })
  await run($)
  const pane = await menu($)
  await pane.select({ key: 'menu-top', value: 'themes' })
  await pane.select({ key: 'menu-themes', value: 'everforest' })
  await clock.settle()
  expect(toasts).toEqual(["Can't switch the Sidebar theme to everforest: locked by policy"])
})

for (const level of ['themes', 'plugins']) {
  test(`Esc in ${level} goes back to the top and takes the keys back; Esc at the top closes`, async () => {
    const state = { menu: { level, filter: '', picks: { top: level } } }
    const opens: PaneOpenArgs[] = []
    expect(await esc(state, opens)).toEqual({ deny: expect.any(String) })
    expect(state.menu).toEqual({ level: 'top', filter: '', picks: { top: level } })
    // The deny hands the keys to the prompt: the menu opens again to take them back.
    expect(opens).toEqual([{ id: 'ctui', title: 'ctui', focus: true, closeOnEscape: true, columns: 42 }])
    expect(await esc(state, opens)).toBe('closed')
  })
}

test('Plugins is a placeholder until its screen lands', async ($, on) => {
  host(on)
  await run($)
  const pane = await menu($)
  await pane.select({ key: 'menu-top', value: 'plugins' })
  expect(await pane.find({ type: 'Select', key: 'menu-top' })).toBeUndefined()
  expect(await pane.find({ type: 'Text', text: /Esc goes back/ })).toBeDefined()
})
