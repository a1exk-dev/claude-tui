import type { ConfigRow, ConfigSetInput, On } from 'claude-code'
import { type Engine, expect, mock, test } from 'claude-code/testing'

// Scenario: picking a Theme in `/ctui:theme` (MEMORY.md "Sidebar colors
// inherit the Claude Code theme"). A write reloads the mod with the new
// `theme` option; the Sidebar then draws with that Theme's role hexes, read
// from `ctui/themes/<slug>.json`.
// The test kit doesn't reload after a write, so the write and the draw under
// the new option are separate tests.

// The manifest's `theme` options and Everforest's role keys, cut down from
// `ctui/.claude-plugin/plugin.json` and `ctui/themes/everforest.json`.
const OPTIONS = ['inherit', 'catppuccin', 'everforest', 'white']
const EVERFOREST = {
  name: 'Everforest',
  base: 'dark',
  overrides: {
    claude: '#7fbbb3',
    text: '#d3c6aa',
    inactive: '#918c7e',
    subtle: '#4f585e',
    success: '#a7c080',
    warning: '#e09d7f',
    error: '#e67e80',
    suggestion: '#7fbbb3',
    composerSidebarBackground: '#363d41',
  },
}

const THEME_ROW: ConfigRow = {
  key: 'ctui.theme',
  label: 'Sidebar theme',
  kind: 'choice',
  value: 'inherit',
  options: ['inherit'],
  provider: { plugin: 'ctui', tier: 'user' },
  isLocked: false,
}

// The plugin's files, as `$.fs.read` answers them.
function files(on: On) {
  on('fs.read', (_, e) => {
    if (e.path.endsWith('/.claude-plugin/plugin.json')) {
      return { value: JSON.stringify({ userConfig: { theme: { options: OPTIONS } } }) }
    }
    if (e.path.endsWith('/themes/everforest.json')) return { value: JSON.stringify(EVERFOREST) }
    return { deny: `no file ${e.path}` }
  })
}

// The `/config` rows (none under `claude -p`), the writer, the panes, and the files.
function host(on: On, rows: ConfigRow[] = [THEME_ROW]) {
  files(on)
  const sets: Pick<ConfigSetInput, 'key' | 'value'>[] = []
  on('config.list', () => ({ value: rows }))
  on('config.set', (_, e) => {
    sets.push({ key: e.key, value: e.value })
    return { value: e.value }
  })
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.close', () => ({ value: undefined }))
  return sets
}

const run = ($: Engine, args = '') =>
  $.command.run({
    command: 'ctui:theme',
    args,
    origin: { kind: 'composer' },
    presentation: { isFullscreen: true, columns: 150 },
  })

const pane = ($: Engine, requestId: string) =>
  $.ui.mount({
    plugin: 'ctui',
    surface: 'terminal',
    component: 'Pane',
    requestId,
    props: {
      title: requestId,
      isFocused: false,
      bodyColumns: 42,
      placement: 'dock',
      scroll: { offset: 0, bodyRows: 40 },
      view: {},
    },
  })

// The Sidebar, the color of its `Context` title, and its root's background.
async function sidebar($: Engine) {
  const drawn = await pane($, 'sidebar')
  const title = (await drawn.find({ type: 'Text', text: /^ ?Context$/ }))?.props.color
  const root = (await drawn.drawn()) as { props: { backgroundColor?: string } }
  return { drawn, title, background: root.props.backgroundColor }
}

test('a typed slug writes the theme and prints nothing', async ($, on) => {
  const sets = host(on)
  expect(await run($, 'everforest')).toEqual({})
  expect(sets).toEqual([{ key: 'ctui.theme', value: 'everforest' }])
})

test('a pick in the picker writes the theme', async ($, on) => {
  const clock = mock.clock(on)
  const sets = host(on)
  await run($)
  const picker = await pane($, 'ctui-theme')
  const [select] = await picker.findAll({ type: 'Select' })
  const options = (select?.props.options as { value: string }[]).map((option) => option.value)
  expect(options).toEqual(OPTIONS)
  expect(select?.props.value).toBe('inherit')
  await picker.select({ key: 'theme', value: 'everforest' })
  await clock.settle()
  expect(sets).toEqual([{ key: 'ctui.theme', value: 'everforest' }])
})

test('the picker selects the current Theme', { options: { theme: 'everforest' } }, async ($, on) => {
  host(on)
  await run($)
  const [select] = await (await pane($, 'ctui-theme')).findAll({ type: 'Select' })
  expect(select?.props.value).toBe('everforest')
})

test('with a Theme selected the Sidebar draws its role hexes', { options: { theme: 'everforest' } }, async ($, on) => {
  mock.clock(on)
  files(on)
  const { drawn, title } = await sidebar($)
  expect(title).toBe(EVERFOREST.overrides.text)
  // No Text keeps a role's key name.
  const keys = ['text', 'inactive', 'subtle', 'success', 'warning', 'error', 'suggestion']
  const colors = (await drawn.findAll({ type: 'Text' })).map((text) => text.props.color)
  expect(colors.filter((color) => keys.includes(color as string))).toEqual([])
})

test('under inherit the Sidebar draws with key names', async ($, on) => {
  mock.clock(on)
  files(on)
  expect((await sidebar($)).title).toBe('text')
})

test("with a Theme selected the Sidebar's root paints the Theme's glass", { options: { theme: 'everforest' } }, async ($, on) => {
  mock.clock(on)
  files(on)
  expect((await sidebar($)).background).toBe(EVERFOREST.overrides.composerSidebarBackground)
})

test('under inherit the Sidebar paints no background', async ($, on) => {
  mock.clock(on)
  files(on)
  expect((await sidebar($)).background).toBeUndefined()
})

test('an unknown slug lists the options', async ($, on) => {
  host(on)
  const { text } = await run($, 'x')
  expect(text).toBe('Unknown theme "x". Themes: inherit, catppuccin, everforest, white')
})

test('under claude -p a slug writes nothing', async ($, on) => {
  const sets = host(on, [])
  expect((await run($, 'everforest')).text).toBe(
    "Can't change ctui settings in claude -p. Use /config in an interactive session.",
  )
  expect(sets).toEqual([])
})
