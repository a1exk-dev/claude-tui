import type { ElementTable, RenderElement, RenderSurface } from 'claude-code'

import type { Menu, MenuLevel as Level } from '../types'

// The `/ctui` menu (MEMORY.md "`/ctui` is one instant menu; it survives each settings reload"):
// its model, kept in `$.state` because every write reloads the mod,
// and its pane body. register.tsx handles the picks, the filter and Esc.

export const MENU_START: Menu = { level: 'top', filter: '', picks: {} }

// Where Esc goes from each level; none at the top, where it closes the menu.
export const PARENT: Record<Level, Level | undefined> = { top: undefined, plugins: 'top', plugin: 'plugins', themes: 'top' }

// The keys of the menu's elements: the `ui.select`, `ui.input` and
// `ui.press` matchers' `element`. A plugin's row is `plugin-<id>`.
export const KEYS = {
  top: 'menu-top',
  themes: 'menu-themes',
  filter: 'menu-filter',
  toggle: 'menu-toggle',
  up: 'menu-up',
  down: 'menu-down',
} as const
// A Plugins row's key, and the plugin a key names.
export const rowKey = (id: string) => `plugin-${id}`
export const rowId = (key: string | undefined) => (key?.startsWith('plugin-') ? key.slice('plugin-'.length) : undefined)

// `order` with `id` moved `by` places, held at either end.
export function moveId(order: readonly string[], id: string, by: number): string[] {
  const from = order.indexOf(id)
  const to = Math.min(Math.max(from + by, 0), order.length - 1)
  if (from < 0 || to === from) return [...order]
  const moved = order.filter((held) => held !== id)
  moved.splice(to, 0, id)
  return moved
}

// A Theme: the `theme` setting's slug and its file's `name`, as `/theme` lists it.
export type ThemeName = { slug: string; name: string }

// `inherit` first, then the Themes by name A–Z; the filter matches a name
// anywhere, any case.
export function themeRows(themes: readonly ThemeName[], filter: string): ThemeName[] {
  const named = [...themes].filter(({ slug }) => slug !== 'inherit').sort((a, b) => a.name.localeCompare(b.name))
  const needle = filter.trim().toLowerCase()
  return [{ slug: 'inherit', name: 'inherit' }, ...named].filter(({ name }) => name.toLowerCase().includes(needle))
}

export const NO_CONFIG = "Can't change ctui settings in claude -p. Use /config in an interactive session."

// The toast for a `{ deny }` from `$.config.set`.
export function deniedText(set: { key: string; value: string | boolean }, deny: string) {
  const id = /^ctui\.(\w+)_enable$/.exec(set.key)?.[1]
  if (id) return `Can't ${set.value ? 'enable' : 'disable'} ${id}: ${deny}`
  if (set.key === 'ctui.order') return `Can't save the Sidebar order: ${deny}`
  return `Can't switch the Sidebar theme to ${set.value}: ${deny}`
}

// Who holds `/ctui`, from `$.command.register`'s refusal.
export function takenBy(refusal: string) {
  const plugin = /the plugin (\S+) registered it/.exec(refusal)?.[1]
  if (plugin) return `the ${plugin} plugin`
  if (/it is the user's/.test(refusal)) return 'your own /ctui'
  return /refused: (.+)$/.exec(refusal)?.[1] ?? 'another command'
}

// A section as the Plugins screen lists it.
export type PluginRow = { id: string; title: string; enable: boolean }

export type MenuInput = {
  ui: ElementTable<Exclude<RenderSurface, 'mobile'>> // the surfaces that draw a Select
  menu: Menu
  themes: readonly ThemeName[]
  theme: string // the current `theme` setting
  plugins: readonly PluginRow[] // in the order shown
}

const TITLES: Record<Exclude<Level, 'plugin'>, string> = { top: 'ctui', plugins: 'ctui › Plugins', themes: 'ctui › Themes' }

// The menu pane's body: a dim title over the level's elements.
export function menuView({ ui, menu, themes, theme, plugins }: MenuInput): RenderElement {
  const { Box, Text, Select, Input, Button } = ui
  const focused = plugins.find(({ id }) => id === menu.focus)
  const title = menu.level === 'plugin' ? `ctui › Plugins › ${focused?.title ?? ''}` : TITLES[menu.level]
  const body = () => {
    if (menu.level === 'plugin') return <Text dimColor>Its settings come in a later ctui. Esc goes back.</Text>
    if (menu.level === 'plugins') {
      const width = Math.max(...plugins.map((row) => row.title.length)) + 2
      // A hotkey Button draws `<key>: <label>`; register.tsx's `ui.press` hooks handle each.
      const hotkeyButton = (hotkey: string, label: string, key: string) => (
        <Button key={key} label={label} hotkey={hotkey} plain dimColor onPress={() => undefined} />
      )
      return (
        <Box flexDirection="column">
          {plugins.map((row) => (
            <Button
              key={rowKey(row.id)}
              label={`${row.enable ? '✓' : '✗'} ${row.title.padEnd(width)}›`}
              plain
              {...((menu.focus ?? plugins[0]?.id) === row.id && { autoFocus: true })}
              onPress={() => undefined}
            />
          ))}
          <Box flexDirection="row" marginTop={1}>
            <Text dimColor>enter settings · </Text>
            {hotkeyButton('x', 'on/off', KEYS.toggle)}
            <Text dimColor> · </Text>
            {hotkeyButton('k', 'up', KEYS.up)}
            <Text dimColor> · </Text>
            {hotkeyButton('j', 'down', KEYS.down)}
            <Text dimColor> · esc back</Text>
          </Box>
        </Box>
      )
    }
    if (menu.level === 'themes') {
      const rows = themeRows(themes, menu.filter)
      return (
        <>
          <Input
            key={KEYS.filter}
            label="filter "
            placeholder="type to filter"
            value={menu.filter}
            autoFocus
            // Required; register.tsx's `ui.input` hook handles the typing.
            onInput={() => undefined}
            onSubmit={() => undefined}
          />
          {rows.length ? (
            <Select
              key={KEYS.themes}
              options={rows.map(({ slug, name }) => ({ value: slug, label: name }))}
              {...(rows.some(({ slug }) => slug === theme) && { value: theme })}
              onSelect={() => undefined}
            />
          ) : (
            <Text dimColor>no match</Text>
          )}
        </>
      )
    }
    return (
      <Select
        key={KEYS.top}
        options={[
          { value: 'plugins', label: 'Plugins ›' },
          { value: 'themes', label: 'Themes ›' },
        ]}
        {...(menu.picks.top && { value: menu.picks.top })}
        autoFocus
        onSelect={() => undefined}
      />
    )
  }
  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Text dimColor>{title}</Text>
      {body()}
    </Box>
  )
}
