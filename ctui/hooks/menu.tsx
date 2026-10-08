import type { ElementTable, RenderElement, RenderSurface } from 'claude-code'

import type { Menu, MenuLevel as Level } from '../types'

// The `/ctui` menu (MEMORY.md "`/ctui` is one instant menu; it survives each settings reload"):
// its model, kept in `$.state` because every write reloads the mod,
// and its pane body. register.tsx handles the picks, the filter and Esc.

export const MENU_START: Menu = { level: 'top', filter: '', picks: {} }

// Where Esc goes from each level; none at the top, where it closes the menu.
export const PARENT: Record<Level, Level | undefined> = { top: undefined, plugins: 'top', themes: 'top' }

// The keys of the menu's elements: the `ui.select` and `ui.input` matchers' `element`.
export const KEYS = { top: 'menu-top', themes: 'menu-themes', filter: 'menu-filter' } as const

// A Theme: the `theme` setting's slug and its file's `name`, as `/theme` lists it.
export type ThemeName = { slug: string; name: string }

// `inherit` first, then the Themes by name A–Z; the filter matches a name
// anywhere, any case.
export function themeRows(themes: readonly ThemeName[], filter: string): ThemeName[] {
  const named = [...themes].filter(({ slug }) => slug !== 'inherit').sort((a, b) => a.name.localeCompare(b.name))
  const needle = filter.trim().toLowerCase()
  return [{ slug: 'inherit', name: 'inherit' }, ...named].filter(({ name }) => name.toLowerCase().includes(needle))
}

// Who holds `/ctui`, from `$.command.register`'s refusal.
export function takenBy(refusal: string) {
  const plugin = /the plugin (\S+) registered it/.exec(refusal)?.[1]
  if (plugin) return `the ${plugin} plugin`
  if (/it is the user's/.test(refusal)) return 'your own /ctui'
  return /refused: (.+)$/.exec(refusal)?.[1] ?? 'another command'
}

export type MenuInput = {
  ui: ElementTable<Exclude<RenderSurface, 'mobile'>> // the surfaces that draw a Select
  menu: Menu
  themes: readonly ThemeName[]
  theme: string // the current `theme` setting
}

const TITLES: Record<Level, string> = { top: 'ctui', plugins: 'ctui › Plugins', themes: 'ctui › Themes' }

// The menu pane's body: a dim title over the level's elements.
export function menuView({ ui, menu, themes, theme }: MenuInput): RenderElement {
  const { Box, Text, Select, Input } = ui
  const body = () => {
    if (menu.level === 'plugins') return <Text dimColor>Plugin settings come in a later ctui. Esc goes back.</Text>
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
      <Text dimColor>{TITLES[menu.level]}</Text>
      {body()}
    </Box>
  )
}
