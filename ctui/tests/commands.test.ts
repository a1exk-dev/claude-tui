import { expect, test } from 'claude-code/testing'

import { deniedText, gated, NO_CONFIG, pluginsOutcome, themeOutcome } from '../hooks/commands'
import { plugins } from '../plugins'

// Every `/ctui:*` outcome in MEMORY.md "`/ctui:*` commands stay quiet on
// success; a bare command opens a picker pane".

const states = (off: string[] = []) => plugins.map(({ id }) => ({ id, enable: !off.includes(id) }))

test('a plugin name that changes the setting writes it', () => {
  expect(pluginsOutcome('disable', 'mcp', states())).toEqual({ set: { key: 'ctui.mcp_enable', value: false } })
  expect(pluginsOutcome('enable', ' mcp ', states(['mcp']))).toEqual({ set: { key: 'ctui.mcp_enable', value: true } })
})

test('a plugin already set, or unknown, gets one line', () => {
  expect(pluginsOutcome('disable', 'mcp', states(['mcp']))).toEqual({ text: 'mcp is already disabled' })
  expect(pluginsOutcome('enable', 'git', states())).toEqual({ text: 'git is already enabled' })
  expect(pluginsOutcome('enable', 'foo', states())).toEqual({
    text: 'Unknown plugin "foo". Plugins: git, context, limits, mcp, todo, agents, versions',
  })
})

test('a bare toggle picks from the plugins it would change, or says none are left', () => {
  expect(pluginsOutcome('disable', '', states(['mcp', 'todo']))).toEqual({
    pick: { options: ['git', 'context', 'limits', 'agents', 'versions'] },
  })
  expect(pluginsOutcome('enable', '', states(['mcp', 'todo']))).toEqual({ pick: { options: ['mcp', 'todo'] } })
  expect(pluginsOutcome('enable', '', states())).toEqual({ text: 'All Sidebar plugins are already enabled' })
  const none = plugins.map(({ id }) => id)
  expect(pluginsOutcome('disable', '', states(none))).toEqual({ text: 'All Sidebar plugins are already disabled' })
})

test('theme: a change writes, the current one or an unknown one gets a line, bare picks', () => {
  const themes = ['inherit', 'tokyo']
  expect(themeOutcome('tokyo', themes, 'inherit')).toEqual({ set: { key: 'ctui.theme', value: 'tokyo' } })
  expect(themeOutcome('inherit', ['inherit'], 'inherit')).toEqual({ text: 'Sidebar theme is already inherit' })
  expect(themeOutcome('x', ['inherit'], 'inherit')).toEqual({ text: 'Unknown theme "x". Themes: inherit' })
  expect(themeOutcome('', ['inherit'], 'inherit')).toEqual({ pick: { options: ['inherit'], value: 'inherit' } })
})

test('a deny names the change and its reason', () => {
  expect(deniedText({ key: 'ctui.mcp_enable', value: false }, 'locked')).toBe("Can't disable mcp: locked")
  expect(deniedText({ key: 'ctui.todo_enable', value: true }, 'locked')).toBe("Can't enable todo: locked")
  expect(deniedText({ key: 'ctui.theme', value: 'tokyo' }, 'locked')).toBe(
    "Can't switch the Sidebar theme to tokyo: locked",
  )
})

test('with no ctui /config row (claude -p) a write or picker becomes the fixed line', () => {
  const set = { set: { key: 'ctui.mcp_enable', value: false } }
  const pick = { pick: { options: ['inherit'], value: 'inherit' } }
  const unknown = { text: 'Unknown theme "x". Themes: inherit' }
  expect(gated(set, false)).toEqual({ text: NO_CONFIG })
  expect(gated(pick, false)).toEqual({ text: NO_CONFIG })
  expect(gated(unknown, false)).toEqual(unknown)
  expect(gated(set, true)).toEqual(set)
  expect(NO_CONFIG).toBe("Can't change ctui settings in claude -p. Use /config in an interactive session.")
})
