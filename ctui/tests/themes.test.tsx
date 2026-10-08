import type { ConfigRow, On } from 'claude-code'
import { type Engine, expect, mock, test } from 'claude-code/testing'

import { plugins } from '../plugins'

// Scenario: the Sidebar under a Theme (MEMORY.md "Sidebar colors inherit the
// Claude Code theme"). Picking one in `/ctui` reloads the mod with the new
// `theme` option (tests/menu.test.tsx); the Sidebar then draws with that
// Theme's role hexes, read from `ctui/themes/<slug>.json`.

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
  const title = (await drawn.find({ type: 'Text', text: /^ ?Context:$/, in: 'foldrow-context' }))?.props.color
  const root = (await drawn.drawn()) as { props: { backgroundColor?: string } }
  return { drawn, title, background: root.props.backgroundColor }
}

test('with a Theme selected the Sidebar draws its role hexes', { options: { theme: 'everforest' } }, async ($, on) => {
  mock.clock(on)
  files(on)
  const { drawn, title } = await sidebar($)
  expect(title).toBe(EVERFOREST.overrides.text)
  // No Text keeps a role's key name.
  const keys = ['text', 'inactive', 'subtle', 'success', 'warning', 'error', 'suggestion']
  const sections = plugins.filter((plugin) => plugin.slot === 'section')
  const rows = sections.map(({ id }) => drawn.findAll({ type: 'Text', in: `foldrow-${id}` }))
  const texts = [...(await drawn.findAll({ type: 'Text' })), ...(await Promise.all(rows)).flat()]
  const colors = texts.map((text) => text.props.color)
  expect(colors.filter((color) => keys.includes(color as string))).toEqual([])
})

test("with a Theme selected a title row hovers in the Theme's accent", { options: { theme: 'everforest' } }, async ($, on) => {
  mock.clock(on)
  files(on)
  const { drawn } = await sidebar($)
  const hover = { scope: 'foldrow-context', color: EVERFOREST.overrides.suggestion }
  expect(await drawn.drawn({ in: 'foldrow-context' })).toMatchObject({ children: [{ type: 'Text', hover }, { type: 'Box' }] })
  expect(await drawn.drawn({ in: 'fold-context' })).toMatchObject({ type: 'Text', hover })
})

test('under inherit the Sidebar draws with key names', async ($, on) => {
  mock.clock(on)
  files(on)
  expect((await sidebar($)).title).toBe('text')
})

// #134: the rules between sections.
const rules = async (drawn: Awaited<ReturnType<typeof pane>>) =>
  (await drawn.findAll({ type: 'Text', text: '─'.repeat(38) })).map((text) => text.props.color)

test('under inherit the rules between sections draw subtle', async ($, on) => {
  mock.clock(on)
  files(on)
  expect(await rules((await sidebar($)).drawn)).toEqual(Array(4).fill('subtle'))
})

test("with a Theme selected the rules draw in the Theme's subtle", { options: { theme: 'everforest' } }, async ($, on) => {
  mock.clock(on)
  files(on)
  expect(await rules((await sidebar($)).drawn)).toEqual(Array(4).fill(EVERFOREST.overrides.subtle))
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

// Scenario: under `inherit` with Omarchy's `custom:omarchy` theme, which sets
// no dock color, the Sidebar paints that theme's glass and follows a switch.

const OFF = Object.fromEntries(
  [...['context', 'limits', 'todo', 'mcp', 'agents'].map((id) => `${id}_enable`), 'agents_toasts'].map((key) => [key, false]),
)

// The always-on git header and versions footer: outside a repo, with a version.
function headerFooter(on: On) {
  on('session.cwd', () => ({ value: '/srv/x' }))
  on('session.version', () => ({ value: { version: '2.1.292' } }))
  on('process.run', () => ({
    value: { exitCode: 128, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false },
  }))
}
const OMARCHY = '/home/a/.claude/themes/omarchy.json'
// Omarchy's generated file, trimmed: `inverseText` is the background, `text` the foreground.
const omarchy = (background: string, foreground: string) =>
  JSON.stringify({ name: 'Omarchy', base: 'dark', overrides: { text: foreground, inverseText: background } })

function claudeHome(on: On, world: { theme: string; file: string; mtimeMs: number }) {
  headerFooter(on)
  mock.env(on, { HOME: '/home/a' })
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('env.set', () => ({ value: undefined }))
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  on('settings.read', () => ({ value: {} }))
  on('config.list', () => ({ value: [{ ...THEME_ROW, key: 'theme', value: world.theme }] }))
  on('fs.stat', (_, e) => {
    if (e.path !== OMARCHY) throw new Error('ENOENT')
    return { value: { kind: 'file', size: world.file.length, mtimeMs: world.mtimeMs, isLink: false } }
  })
  on('fs.read', (_, e) => {
    if (e.path.endsWith('/.claude-plugin/plugin.json')) return { value: '{ "version": "0.0.0" }' }
    if (e.path !== OMARCHY) throw new Error('ENOENT')
    return { value: world.file }
  })
}

test('under inherit a custom /theme without a dock color paints its glass, and follows a switch', { options: OFF }, async ($, on) => {
  const clock = mock.clock(on, { now: 0 })
  const world = { theme: 'custom:omarchy', file: omarchy('#1a1b26', '#a9b1d6'), mtimeMs: 1 }
  claudeHome(on, world)
  await $.session.start({ cwd: '/srv/x', surface: 'terminal', isInteractive: true })
  await clock.settle()
  const drawn = await pane($, 'sidebar')
  const background = async () => ((await drawn.drawn()) as { props: { backgroundColor?: string } }).props.backgroundColor
  expect(await background()).toBe('#232431')

  // An Omarchy switch to Everforest rewrites the file.
  Object.assign(world, { file: omarchy('#2d353b', '#d3c6aa'), mtimeMs: 2 })
  await clock.advance(1000)
  await drawn.redraw()
  expect(await background()).toBe('#373e42')

  // A built-in /theme pick: Claude Code's dock, no paint.
  world.theme = 'dark'
  await clock.advance(1000)
  await drawn.redraw()
  expect(await background()).toBeUndefined()
})

test('after /clear empties $.state, the tick paints the glass again', { options: OFF }, async ($, on) => {
  const clock = mock.clock(on, { now: 0 })
  claudeHome(on, { theme: 'custom:omarchy', file: omarchy('#2d353b', '#d3c6aa'), mtimeMs: 1 })
  const cleared = new Set<string>()
  on('state.get', async ($, e, next) => (cleared.has(e.key) ? { value: { value: undefined, version: 0 } } : next(e)))
  on('state.set', async ($, e, next) => {
    cleared.delete(e.key)
    return next(e)
  })
  await $.session.start({ cwd: '/srv/x', surface: 'terminal', isInteractive: true })
  await clock.settle()
  const drawn = await pane($, 'sidebar')
  const background = async () => ((await drawn.drawn()) as { props: { backgroundColor?: string } }).props.backgroundColor
  cleared.add('glass')
  await drawn.redraw()
  expect(await background()).toBeUndefined()
  await clock.advance(1000)
  await drawn.redraw()
  expect(await background()).toBe('#373e42')
})

test('Claude Code keeps its themes in CLAUDE_CONFIG_DIR when that is set', { options: OFF }, async ($, on) => {
  const clock = mock.clock(on, { now: 0 })
  const file = omarchy('#2d353b', '#d3c6aa')
  headerFooter(on)
  mock.env(on, { HOME: '/home/a', CLAUDE_CONFIG_DIR: '/cfg' })
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('env.set', () => ({ value: undefined }))
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  on('settings.read', () => ({ value: {} }))
  on('config.list', () => ({ value: [{ ...THEME_ROW, key: 'theme', value: 'custom:omarchy' }] }))
  on('fs.stat', (_, e) => {
    if (e.path !== '/cfg/themes/omarchy.json') throw new Error('ENOENT')
    return { value: { kind: 'file', size: file.length, mtimeMs: 1, isLink: false } }
  })
  on('fs.read', () => ({ value: file }))
  await $.session.start({ cwd: '/srv/x', surface: 'terminal', isInteractive: true })
  await clock.settle()
  const root = (await (await pane($, 'sidebar')).drawn()) as { props: { backgroundColor?: string } }
  expect(root.props.backgroundColor).toBe('#373e42')
})
