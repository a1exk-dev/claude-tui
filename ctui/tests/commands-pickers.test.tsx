import type { ConfigRow, ConfigSetInput, On, PaneOpenArgs } from 'claude-code'
import { type Engine, expect, mock, test } from 'claude-code/testing'

// Scenario: each `/ctui:*` command through `$.command.run`, with this test's
// own `config.set` hook standing in for the engine's writer (#6), and the
// picker panes they open.

const THEME_ROW: ConfigRow = {
  key: 'ctui.theme',
  label: 'Sidebar theme',
  kind: 'choice',
  value: 'inherit',
  options: ['inherit'],
  provider: { plugin: 'ctui', tier: 'user' },
  isLocked: false,
}

// The world beneath the plugin: the `/config` rows (none under `claude -p`),
// the writer, and the panes opened and closed.
function host(on: On, world: { rows?: ConfigRow[]; deny?: string; toasts?: string[] } = {}) {
  const seen = { sets: [] as Pick<ConfigSetInput, 'key' | 'value'>[], opens: [] as PaneOpenArgs[], closes: [] as string[] }
  on('fs.read', () => ({ value: JSON.stringify({ userConfig: { theme: { options: ['inherit'] } } }) }))
  on('config.list', () => ({ value: world.rows ?? [THEME_ROW] }))
  on('config.set', (_, e) => {
    seen.sets.push({ key: e.key, value: e.value })
    return world.deny === undefined ? { value: e.value } : { deny: world.deny }
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
  return seen
}

// The person types `/ctui:<command> <args>` in a fullscreen terminal.
const run = ($: Engine, command: string, args = '') =>
  $.command.run({
    command: `ctui:${command}`,
    args,
    origin: { kind: 'composer' },
    presentation: { isFullscreen: true, columns: 150 },
  })

const picker = ($: Engine, id: string) =>
  $.ui.mount({
    plugin: 'ctui',
    surface: 'terminal',
    component: 'Pane',
    requestId: id,
    props: {
      title: id,
      isFocused: true,
      bodyColumns: 42,
      placement: 'dock',
      scroll: { offset: 0, bodyRows: 30 },
      view: {},
    },
  })

test('a name that changes the setting writes it and prints nothing', async ($, on) => {
  const seen = host(on)
  expect(await run($, 'plugins:disable', 'mcp')).toEqual({})
  expect(seen.sets).toEqual([{ key: 'ctui.mcp_enable', value: false }])
})

test('enable writes true', { options: { mcp_enable: false } }, async ($, on) => {
  const seen = host(on)
  expect(await run($, 'plugins:enable', 'mcp')).toEqual({})
  expect(seen.sets).toEqual([{ key: 'ctui.mcp_enable', value: true }])
})

test('already set, and unknown names, print one line and write nothing', { options: { mcp_enable: false } }, async ($, on) => {
  const seen = host(on)
  expect((await run($, 'plugins:disable', 'mcp')).text).toBe('mcp is already disabled')
  expect((await run($, 'plugins:enable', 'foo')).text).toBe(
    'Unknown plugin "foo". Plugins: git, context, limits, mcp, todo, agents, versions',
  )
  expect((await run($, 'theme', 'inherit')).text).toBe('Sidebar theme is already inherit')
  expect((await run($, 'theme', 'x')).text).toBe('Unknown theme "x". Themes: inherit')
  expect(seen.sets).toEqual([])
  expect(seen.opens).toEqual([])
})

test('a deny prints its reason', async ($, on) => {
  host(on, { deny: 'locked by policy' })
  expect((await run($, 'plugins:disable', 'mcp')).text).toBe("Can't disable mcp: locked by policy")
})

test('under claude -p (no ctui.theme row) a write or picker prints the fixed line', async ($, on) => {
  const seen = host(on, { rows: [] })
  const line = "Can't change ctui settings in claude -p. Use /config in an interactive session."
  expect((await run($, 'plugins:disable', 'mcp')).text).toBe(line)
  expect((await run($, 'plugins:disable')).text).toBe(line)
  expect((await run($, 'theme')).text).toBe(line)
  // Unknown names still get their own line.
  expect((await run($, 'theme', 'x')).text).toBe('Unknown theme "x". Themes: inherit')
  expect(seen.sets).toEqual([])
  expect(seen.opens).toEqual([])
})

test('bare enable with every plugin on prints a line and opens no pane', async ($, on) => {
  const seen = host(on)
  expect((await run($, 'plugins:enable')).text).toBe('All Sidebar plugins are already enabled')
  expect(seen.opens).toEqual([])
})

test('bare disable opens a focused picker of the enabled plugins; a pick closes it, then writes', { options: { todo_enable: false } }, async ($, on) => {
  const clock = mock.clock(on)
  const seen = host(on)
  expect(await run($, 'plugins:disable')).toEqual({})
  expect(seen.opens).toEqual([
    { id: 'ctui-disable', title: 'Disable a Sidebar plugin', focus: true, closeOnEscape: true, columns: 42 },
  ])
  const pane = await picker($, 'ctui-disable')
  const [select] = await pane.findAll({ type: 'Select' })
  expect(select?.props.options).toEqual(['git', 'context', 'limits', 'mcp', 'agents', 'versions'].map((value) => ({ value })))
  expect(select?.props.autoFocus).toBe(true)
  await pane.select({ key: 'disable', value: 'mcp' })
  await clock.settle()
  expect(seen.closes).toEqual(['ctui-disable'])
  expect(seen.sets).toEqual([{ key: 'ctui.mcp_enable', value: false }])
})

test('bare enable lists the disabled plugins', { options: { mcp_enable: false, agents_enable: false } }, async ($, on) => {
  const clock = mock.clock(on)
  const seen = host(on)
  await run($, 'plugins:enable')
  const pane = await picker($, 'ctui-enable')
  const [select] = await pane.findAll({ type: 'Select' })
  expect(select?.props.options).toEqual([{ value: 'mcp' }, { value: 'agents' }])
  await pane.select({ key: 'enable', value: 'agents' })
  await clock.settle()
  expect(seen.sets).toEqual([{ key: 'ctui.agents_enable', value: true }])
})

test('theme always opens its picker with the current value; picking it closes without a write', async ($, on) => {
  const clock = mock.clock(on)
  const seen = host(on)
  expect(await run($, 'theme')).toEqual({})
  expect(seen.opens.map((open) => open.id)).toEqual(['ctui-theme'])
  const pane = await picker($, 'ctui-theme')
  const [select] = await pane.findAll({ type: 'Select' })
  expect(select?.props.options).toEqual([{ value: 'inherit' }])
  expect(select?.props.value).toBe('inherit')
  await pane.select({ key: 'theme', value: 'inherit' })
  await clock.settle()
  expect(seen.closes).toEqual(['ctui-theme'])
  expect(seen.sets).toEqual([])
})

test('a refused pick toasts the deny, even with agent toasts off', { options: { agents_toasts: false } }, async ($, on) => {
  const clock = mock.clock(on)
  const toasts: string[] = []
  host(on, { deny: 'locked by policy', toasts })
  await run($, 'plugins:disable')
  const pane = await picker($, 'ctui-disable')
  await pane.select({ key: 'disable', value: 'mcp' })
  await clock.settle()
  expect(toasts).toEqual(["Can't disable mcp: locked by policy"])
})

test('the picker opens as wide as the Sidebar: 53 from 160 terminal columns', async ($, on) => {
  const clock = mock.clock(on)
  const seen = host(on)
  // The Sidebar's render reads the terminal's width as transcript + dock + 1.
  const sidebar = await $.ui.mount({
    plugin: 'ctui',
    surface: 'terminal',
    component: 'Pane',
    requestId: 'sidebar',
    props: { title: 'Sidebar', isFocused: false, bodyColumns: 42, placement: 'dock', scroll: { offset: 0, bodyRows: 30 }, view: {} },
    viewport: { columns: 125, rows: 40, isFullscreen: true },
  })
  await clock.settle()
  await sidebar.unmount()
  await run($, 'plugins:disable')
  expect(seen.opens.at(-1)).toEqual(expect.objectContaining({ id: 'ctui-disable', columns: 53 }))
})
