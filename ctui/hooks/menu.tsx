import type { ElementTable, RenderElement, RenderSurface } from 'claude-code'

import type { SidebarId } from '../plugins/plugin'
import type { Menu, MenuLevel as Level } from '../types'
import type { Colors } from '../plugins/colors'
import type { Config } from './config'

// The `/ctui` menu (MEMORY.md "`/ctui` is one instant menu; it survives each settings reload"):
// its model, kept in `$.state` because every write reloads the mod,
// and its pane body. register.tsx handles the picks, the filter and Esc.

export const MENU_START: Menu = { level: 'top', filter: '', picks: {} }

// Where Esc goes from each level; none at the top, where it closes the menu.
export const PARENT: Record<Level, Level | undefined> = { top: undefined, plugins: 'top', plugin: 'plugins', themes: 'top', probe: 'top' }

// The keys of the menu's elements: the `ui.select`, `ui.input` and
// `ui.press` matchers' `element`. A plugin's row is `plugin-<id>`.
export const KEYS = {
  top: 'menu-top',
  themes: 'menu-themes',
  filter: 'menu-filter',
  monthly: 'menu-monthly',
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
export function deniedText(set: Setting, deny: string) {
  const id = /^ctui\.(\w+)_enable$/.exec(set.key)?.[1]
  if (id) return `Can't ${set.value ? 'enable' : 'disable'} ${id}: ${deny}`
  if (set.key === 'ctui.theme') return `Can't switch the Sidebar theme to ${set.value}: ${deny}`
  if (set.key === 'ctui.order') return `Can't save the Sidebar order: ${deny}`
  if (set.key === 'ctui.limits_cost_monthly') return `Can't set the monthly cost: ${deny}`
  const folded = /^ctui\.(\w+)_folded$/.exec(set.key)?.[1]
  if (folded) return `Can't change Start folded for ${folded}: ${deny}`
  return `Can't change ${LABELS[set.key] ?? set.key}: ${deny}`
}

// The plugins' own settings by key, as their rows name them.
const LABELS: Record<string, string> = { 'ctui.todo_tools': 'Task tools', 'ctui.agents_toasts': 'Toasts', 'ctui.limits_cost': 'Cost' }

// One `$.config.set` the menu makes.
export type Setting = { key: string; value: string | boolean | number }

// Who holds `/ctui`, from `$.command.register`'s refusal.
export function takenBy(refusal: string) {
  const plugin = /the plugin (\S+) registered it/.exec(refusal)?.[1]
  if (plugin) return `the ${plugin} plugin`
  if (/it is the user's/.test(refusal)) return 'your own /ctui'
  return /refused: (.+)$/.exec(refusal)?.[1] ?? 'another command'
}

// The Monthly cost field's key: a new one after a refused entry, since a
// field keeps what was typed while its `value` stays the same.
export const monthlyKey = (entry = 0) => `${KEYS.monthly}-${entry}`
export const isMonthlyKey = (key: string) => key.startsWith(`${KEYS.monthly}-`)

// A plugin screen's setting row, `setting-<option>`: its label and value,
// and what Enter writes.
export type SettingRow = { option: string; label: string; value: string; next: string | boolean }
export const settingKey = (option: string) => `setting-${option}`

const STEP = { auto: 'on', on: 'off', off: 'auto' } as const

// The settings a plugin's screen lists: `Start folded` for every section, and
// each plugin's own. Limits' `Monthly cost` is an Input, apart.
export function settingRows(id: SidebarId, config: Config): SettingRow[] {
  const flag = (option: string, label: string, on: boolean) => ({ option, label, value: on ? 'on' : 'off', next: !on })
  const rows: SettingRow[] = [flag(`${id}_folded`, 'Start folded', config[id].folded ?? false)]
  if (id === 'todo') rows.push(flag('todo_tools', 'Task tools', config.todo.tools))
  if (id === 'agents') rows.push(flag('agents_toasts', 'Toasts', config.agents.toasts))
  if (id === 'limits') {
    rows.push({ option: 'limits_cost', label: 'Cost', value: config.limits.cost, next: STEP[config.limits.cost] })
  }
  return rows
}

const LABEL = 14 // a setting's label column

// A section as the Plugins screen lists it.
export type PluginRow = { id: string; title: string; enable: boolean }

export type MenuInput = {
  ui: ElementTable<Exclude<RenderSurface, 'mobile'>> // the surfaces that draw a Select
  menu: Menu
  themes: readonly ThemeName[]
  theme: string // the current `theme` setting
  plugins: readonly PluginRow[] // in the order shown
  settings: readonly SettingRow[] // the open plugin's
  monthly?: number // the saved monthly cost, on Limits' screen
  // PROTOTYPE #199: the Sidebar's look
  colors: Colors
  background?: string
  bodyRows: number
  bodyColumns: number
  debug: string
  placement: 'dock' | 'inline'
  dockColumns: number // 42 or 53, what the dock would get
}


// PROTOTYPE #199 (throwaway): the menu in the Sidebar's look. Variants, cycled by /ctuispike:
//   A  one-glyph `›` Button, then the label as our Text (accent while ringed)
//   B  one-space Button (the ring draws a 1-cell block), label as our Text
//   C  one-space Button, ringed label drawn as an accent bar (inverse Text)
//   D  a full-row Button with our Text drawn over it in an absolute Box
//   E  the engine's elements (Select, label Buttons) inside the new frame
// Row look A was chosen. /ctuispike now cycles the Plugins screen's keys:
//   F1  footer as our Text; x/k/j hotkeys in a hidden Box; the ring is refused onto them
//   F2  footer as our Text; hidden hotkeys left in the ring (invisible stops)
//   F3  the engine's hotkey Buttons in the footer, drawn `x: on/off` (today's)
// Keys F1 was chosen. /ctuispike now cycles the inline width:
//   W1  the body fills the inline frame (the whole screen)
//   W2  the body keeps the dock's width, 42 or 53 columns, at the left
// Inline W1 was chosen. /ctuispike now cycles the inline height:
//   H1  ask for 24 rows; the body fills them, footer pinned to the bottom
//   H2  ask for nothing: the engine's third of the screen (11 rows at 40)
//   H3  ask for 24 rows, but the frame fits the screen's content, footer right under it
// Inline H3 was chosen. /ctuispike now cycles the footer style:
//   T1  key in main, label muted, two spaces apart: `↑↓ move  enter open`
//   T2  the same, parted by a faint ` · `: `↑↓ move · enter open`
//   T3  the hotkey form, all muted: `↑↓: move · enter: open`
export const VARIANTS = ['T1', 'T2', 'T3'] as const
export const HOTKEYS: readonly string[] = [KEYS.toggle, KEYS.up, KEYS.down]
export const ROW = (id: string) => `row-${id}`
export const themeKey = (slug: string) => `theme-${slug}`

type Row = { key: string; label: string; lead?: { text: string; color: string }; right?: string; rightColor?: string }

const FOOTER: Record<Level, [string, string][]> = {
  top: [['↑↓', 'move'], ['enter', 'open'], ['esc', 'close']],
  plugins: [['↑↓', 'move'], ['enter', 'settings'], ['x', 'on/off'], ['k/j', 'move row'], ['esc', 'back']],
  plugin: [['↑↓', 'move'], ['enter', 'change'], ['esc', 'back']],
  themes: [['type', 'filter'], ['↑↓', 'move'], ['enter', 'pick'], ['esc', 'back']],
  probe: [['↑↓', 'scroll?'], ['esc', 'back']],
}

export function menuView(input: MenuInput): RenderElement {
  const { ui, menu, themes, theme, plugins, settings, monthly, colors: c, background, bodyRows } = input
  const { Box, Text, Select, Input, Button } = ui
  const variant: string = 'A'
  const keysMode: string = 'F1'
  const inline = input.placement === 'inline'
  const widthMode: string = 'W1'
  const heightMode: string = 'H3'
  const bodyColumns = inline && widthMode === 'W2' ? input.dockColumns : input.bodyColumns
  const width = bodyColumns - 4
  const opened = plugins.find(({ id }) => id === menu.focus)
  const crumbs = { top: [], plugins: ['Plugins'], plugin: ['Plugins', opened?.title ?? ''], themes: ['Themes'], probe: ['Probe'] }[menu.level]
  const ringed = (key: string) => menu.ring === key

  const row = (r: Row, autoFocus: boolean) => {
    const on = menu.ring ? ringed(r.key) : autoFocus
    const focus = autoFocus ? { autoFocus: true as const } : {}
    const tail = r.right ? <Box flexShrink={0}><Text color={r.rightColor ?? c.muted}>{r.right}</Text></Box> : null
    const lead = r.lead ? <Text color={r.lead.color}>{`${r.lead.text} `}</Text> : null
    if (variant === 'E') {
      const text = `${r.lead ? `${r.lead.text} ` : ''}${r.label}`
      const pad = width - 1 - (r.right?.length ?? 0)
      return <Button key={r.key} plain label={`${text.padEnd(pad)}${r.right ?? ''}`} {...focus} onPress={() => undefined} />
    }
    if (variant === 'D') {
      const text = ` ${r.lead ? `${r.lead.text} ` : ''}${r.label}`
      return (
        <Box height={1} flexShrink={0} width={width}>
          <Button key={r.key} plain label={text.padEnd(width)} {...focus} onPress={() => undefined} />
          <Box position="absolute" top={0} left={0} width={width} height={1} flexDirection="row">
            <Text color={on ? c.accent : c.muted}>{on ? '› ' : '  '}</Text>
            {lead}
            <Text color={on ? c.accent : c.main} bold={on} wrap="truncate-end">
              {r.label.padEnd(width - 2 - (r.lead ? r.lead.text.length + 1 : 0) - (r.right ? r.right.length : 0))}
            </Text>
            {r.right ? <Text color={r.rightColor ?? c.muted}>{r.right}</Text> : null}
          </Box>
        </Box>
      )
    }
    const glyph = variant === 'A' ? '›' : ' '
    const bar = variant === 'C' && on
    return (
      <Box height={1} flexShrink={0} flexDirection="row" columnGap={1}>
        <Button key={r.key} plain dimColor={!on} label={glyph} {...focus} onPress={() => undefined} />
        <Box flexGrow={1} flexDirection="row" columnGap={1}>
          <Box flexGrow={1} flexDirection="row">
            {lead}
            {bar ? (
              <Text color={c.accent} inverse bold wrap="truncate-end">{` ${r.label} `.padEnd(width - 2 - (r.lead ? r.lead.text.length + 1 : 0) - (r.right ? r.right.length + 1 : 0))}</Text>
            ) : (
              <Text color={on ? c.accent : c.main} bold={on} wrap="truncate-end">{r.label}</Text>
            )}
          </Box>
          {tail}
        </Box>
      </Box>
    )
  }
  const rows = (list: Row[], first?: string) => {
    const start = list.find(({ key }) => key === (menu.ring ?? first)) ? (menu.ring ?? first) : list[0]?.key
    return list.map((r) => row(r, r.key === start))
  }

  const body = (): RenderElement[] => {
    if (menu.level === 'top') {
      const current = themes.find(({ slug }) => slug === theme)?.name ?? theme
      if (variant === 'E') {
        return [
          <Select
            key={KEYS.top}
            options={[{ value: 'plugins', label: 'Plugins ›' }, { value: 'themes', label: `Themes › ${current}` }, { value: 'probe', label: 'Probe ›' }]}
            {...(menu.picks.top && { value: menu.picks.top })}
            autoFocus
            onSelect={() => undefined}
          />,
        ]
      }
      return rows(
        [
          { key: ROW('plugins'), label: 'Plugins', right: `${plugins.filter((p) => p.enable).length}/${plugins.length} ›` },
          { key: ROW('themes'), label: 'Themes', right: `${current} ›` },
          { key: ROW('probe'), label: 'Probe (spike)', right: '›' },
        ],
        menu.picks.top && ROW(menu.picks.top),
      )
    }
    if (menu.level === 'plugins') {
      return [
        ...rows(
          plugins.map((p) => ({
            key: rowKey(p.id),
            label: p.title,
            lead: { text: p.enable ? '✓' : '✗', color: p.enable ? c.success : c.muted },
            right: p.enable ? '›' : 'off ›',
          })),
          menu.focus && rowKey(menu.focus),
        ),
        ...(keysMode === 'F3'
          ? []
          : [
              <Box display="none">
                <Button key={KEYS.toggle} label="on/off" hotkey="x" plain onPress={() => undefined} />
                <Button key={KEYS.up} label="up" hotkey="k" plain onPress={() => undefined} />
                <Button key={KEYS.down} label="down" hotkey="j" plain onPress={() => undefined} />
              </Box>,
            ]),
      ]
    }
    if (menu.level === 'plugin') {
      return [
        ...rows(settings.map((s) => ({ key: settingKey(s.option), label: s.label, right: s.value, rightColor: s.value === 'on' ? c.success : c.muted }))),
        ...(monthly === undefined
          ? []
          : [
              <Box height={1} flexShrink={0} paddingLeft={variant === 'E' ? 0 : 2}>
                <Input
                  key={monthlyKey(menu.entry)}
                  label={'Monthly cost'.padEnd(LABEL - 2)}
                  value={String(monthly)}
                  onInput={() => undefined}
                  onSubmit={() => undefined}
                />
              </Box>,
            ]),
      ]
    }
    if (menu.level === 'probe') {
      // Point 3: nothing focusable but one Button, and a tree taller than the body.
      return [
        row({ key: ROW('probe-only'), label: 'the one Button' }, true),
        ...Array.from({ length: 80 }, (_, i) => <Text color={c.muted}>{`probe line ${i + 1}`}</Text>),
      ]
    }
    // Themes: the engine's filter field, then our rows, windowed around the ring.
    const list = themeRows(themes, menu.filter)
    const room = Math.max(bodyRows - 2 - 4 - 2 - 2 - 2, 3) // padding, header, field+gap, footer, more lines
    const at = Math.max(list.findIndex(({ slug }) => ringed(themeKey(slug))), list.findIndex(({ slug }) => slug === theme), 0)
    const from = Math.min(Math.max(at - Math.floor(room / 2), 0), Math.max(list.length - room, 0))
    const shown = list.slice(from, from + room)
    const filter = (
      <Box height={1} flexShrink={0}>
        <Input key={KEYS.filter} label="filter " placeholder="type to filter" value={menu.filter} {...(!menu.ring?.startsWith('theme-') && { autoFocus: true as const })} onInput={() => undefined} onSubmit={() => undefined} />
      </Box>
    )
    if (variant === 'E') {
      return [
        filter,
        list.length ? (
          <Select key={KEYS.themes} options={list.map(({ slug, name }) => ({ value: slug, label: name }))} {...(list.some(({ slug }) => slug === theme) && { value: theme })} onSelect={() => undefined} />
        ) : (
          <Text color={c.faint}>no match</Text>
        ),
      ]
    }
    return [
      filter,
      <Box height={1} flexShrink={0} />,
      <Text color={c.faint}>{from > 0 ? '↑ more' : ' '}</Text>,
      ...(list.length
        ? shown.map(({ slug, name }) => row({ key: themeKey(slug), label: name, ...(slug === theme && { right: '●', rightColor: c.accent }) }, menu.ring === themeKey(slug)))
        : [<Text color={c.faint}>no match</Text>]),
      <Text color={c.faint}>{from + room < list.length ? '↓ more' : ' '}</Text>,
    ]
  }

  const footer = FOOTER[menu.level]
  const hotkey = (key: string, label: string, name: string) => <Button key={name} label={label} hotkey={key} plain dimColor onPress={() => undefined} />
  const footerRow =
    menu.level === 'plugins' && keysMode === 'F3' ? (
      <Box flexDirection="row" flexWrap="wrap">
        <Text color={c.muted}>enter settings · </Text>
        {hotkey('x', 'on/off', KEYS.toggle)}
        <Text color={c.muted}> · </Text>
        {hotkey('k', 'up', KEYS.up)}
        <Text color={c.muted}> · </Text>
        {hotkey('j', 'down', KEYS.down)}
        <Text color={c.muted}> · esc back</Text>
      </Box>
    ) : (
      <Box flexDirection="row" flexWrap="wrap">
        {footer.map(([key, label], i) => (
          <Text color={c.muted}>
            <Text color={c.main}>{`${key}:`}</Text>
            {` ${label}`}
            {i < footer.length - 1 ? <Text color={c.faint}>{' · '}</Text> : ''}
          </Text>
        ))}
      </Box>
    )
  return (
    <Box flexDirection="column" paddingX={2} paddingY={1} width={bodyColumns} {...(menu.level !== 'probe' && !(inline && heightMode === 'H3') && { height: bodyRows })} {...(background && { backgroundColor: background })}>
      <Box height={1} flexShrink={0} flexDirection="row" columnGap={1}>
        <Box flexGrow={1} flexDirection="row">
          <Text color={c.main} bold>Settings</Text>
          {crumbs.map((crumb) => (
            <Text color={c.main} bold>
              <Text color={c.muted}>{' › '}</Text>
              {crumb}
            </Text>
          ))}
        </Box>
        <Box flexShrink={0}>
          <Text color={c.faint}>{''}</Text>
        </Box>
      </Box>
      <Box height={1} flexShrink={0} />
      <Text color={c.faint}>{'═'.repeat(width)}</Text>
      <Box height={1} flexShrink={0} />
      <Box flexDirection="column" flexGrow={inline && heightMode === 'H3' ? 0 : 1} {...(menu.level !== 'probe' && { flexShrink: 1, overflow: 'hidden' as const })}>
        {body()}
      </Box>
      <Text color={c.faint}>{'─'.repeat(width)}</Text>
      {footerRow}
    </Box>
  )
}
