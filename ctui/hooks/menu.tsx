import type { ElementTable, RenderElement, RenderSurface } from 'claude-code'

import type { SidebarId } from '../plugins/plugin'
import type { Colors } from '../plugins/colors'
import type { Menu, MenuLevel as Level } from '../types'
import type { Config } from './config'

// The `/ctui` menu (MEMORY.md "`/ctui` is one instant menu; it survives each settings reload"):
// its model, kept in `$.state` because every write reloads the mod,
// and its pane body. register.tsx handles the picks, the filter and Esc.

export const MENU_START: Menu = { level: 'top', filter: '', picks: {} }

// Where Esc goes from each level; none at the top, where it closes the menu.
export const PARENT: Record<Level, Level | undefined> = { top: undefined, plugins: 'top', plugin: 'plugins', themes: 'top' }

// The keys of the menu's elements: the `ui.input`, `ui.press` and `ui.focus`
// matchers' `element`. A top row is `row-<level>`, a plugin's row `plugin-<id>`,
// a Theme's row `theme-<slug>`.
export const KEYS = {
  filter: 'menu-filter',
  monthly: 'menu-monthly',
  toggle: 'menu-toggle',
  up: 'menu-up',
  down: 'menu-down',
} as const
// A row's key, and what a key names: a Plugins row's plugin, a top row's
// screen, a Theme row's slug.
const named = (prefix: string, key: string | undefined) => (key?.startsWith(prefix) ? key.slice(prefix.length) : undefined)
export const rowKey = (id: string) => `plugin-${id}`
export const rowId = (key: string | undefined) => named('plugin-', key)
export type TopPick = 'plugins' | 'themes'
export const topKey = (level: TopPick) => `row-${level}`
export const topPick = (key: string) => named('row-', key) as TopPick | undefined
export const themeKey = (slug: string) => `theme-${slug}`
export const themeSlug = (key: string) => named('theme-', key)
// The Plugins screen's hidden hotkeys: the ring never lands on them.
export const HOTKEYS: readonly string[] = [KEYS.toggle, KEYS.up, KEYS.down]

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

const LABEL = 14 // the Monthly cost field's label column

// A section as the Plugins screen lists it.
export type PluginRow = { id: string; title: string; enable: boolean; folded: boolean }

export type MenuInput = {
  ui: ElementTable<Exclude<RenderSurface, 'mobile'>> // the surfaces that draw an Input
  menu: Menu
  themes: readonly ThemeName[]
  theme: string // the current `theme` setting
  plugins: readonly PluginRow[] // in the order shown
  settings: readonly SettingRow[] // the open plugin's
  monthly?: number // the saved monthly cost, on Limits' screen
  colors: Colors // the Sidebar's roles
  background?: string // the Sidebar's
  placement: 'dock' | 'inline'
  bodyRows: number
  bodyColumns: number
}

// The keys each screen's footer names.
const FOOTER: Record<Level, readonly (readonly [string, string])[]> = {
  top: [['↑↓', 'move'], ['enter', 'open'], ['esc', 'close']],
  plugins: [['↑↓', 'move'], ['enter', 'settings'], ['x', 'show/hide'], ['k/j', 'move row'], ['esc', 'back']],
  plugin: [['↑↓', 'move'], ['enter', 'change'], ['esc', 'back']],
  themes: [['type', 'filter'], ['↑↓', 'move'], ['enter', 'pick'], ['esc', 'back']],
}

// The lines a footer wraps to in `width`: each pair, with its ` · `, moves whole.
function footerLines(pairs: readonly (readonly [string, string])[], width: number) {
  let lines = 1
  let used = 0
  pairs.forEach(([key, label], index) => {
    const cells = `${key}: ${label}`.length + (index < pairs.length - 1 ? 3 : 0)
    if (used > 0 && used + cells > width) {
      lines += 1
      used = 0
    }
    used += cells
  })
  return lines
}

// One menu row: a `›` Button that takes the ring, then the row as our own Text.
type Row = { key: string; label: string; lead?: { text: string; color: string }; right?: string; rightColor?: string }

// The menu pane's body, in the Sidebar's look: a breadcrumb over a `═` rule,
// the level's rows, and the keys that work on it under a `─` rule, pinned
// to the bottom when docked.
export function menuView(input: MenuInput): RenderElement {
  const { ui, menu, themes, theme, plugins, settings, monthly, colors: c, background, bodyRows, bodyColumns } = input
  const { Box, Text, Input, Button } = ui
  const docked = input.placement === 'dock'
  const width = bodyColumns - 4
  const footer = FOOTER[menu.level]
  const opened = plugins.find(({ id }) => id === menu.focus)
  const crumbs = { top: [], plugins: ['Plugins'], plugin: ['Plugins', opened?.title ?? ''], themes: ['Themes'] }[menu.level]

  const row = ({ key, label, lead, right, rightColor }: Row, ringed: boolean) => (
    <Box height={1} flexShrink={0} flexDirection="row" columnGap={1}>
      {/* register.tsx's `ui.press` hook acts on each row. */}
      <Button key={key} plain dimColor={!ringed} label="›" {...(ringed && { autoFocus: true })} onPress={() => undefined} />
      <Box flexGrow={1} flexDirection="row" columnGap={1}>
        <Box flexGrow={1} flexDirection="row">
          {lead && <Text color={lead.color}>{`${lead.text}  `}</Text>}
          <Text color={ringed ? c.accent : c.main} bold={ringed} wrap="truncate-end">
            {label}
          </Text>
        </Box>
        {right && (
          <Box flexShrink={0}>
            <Text color={rightColor ?? c.muted}>{right}</Text>
          </Box>
        )}
      </Box>
    </Box>
  )
  // The ring sits on `menu.ring` when the list holds it, else on `start`, else on the first row.
  const rows = (list: readonly Row[], start?: string) => {
    const has = (key?: string) => list.some((r) => r.key === key)
    const ringed = has(menu.ring) ? menu.ring : has(start) ? start : list[0]?.key
    return list.map((r) => row(r, r.key === ringed))
  }

  const body = (): RenderElement[] => {
    if (menu.level === 'plugins') {
      return [
        ...rows(
          plugins.map(({ id, title, enable, folded }) => ({
            key: rowKey(id),
            label: title,
            // Nerd Font eye and eye-slash. The terminal draws each two cells wide over
            // the one the engine counts: the first space takes the overflow, the second parts it from the title.
            lead: enable ? { text: '\u{f06e}', color: c.success } : { text: '\u{f070}', color: c.muted },
            right: folded ? 'folded ›' : 'expanded ›',
          })),
          menu.focus && rowKey(menu.focus),
        ),
        // `x`, `k` and `j`: register.tsx's `ui.focus` hook keeps the ring off them.
        <Box display="none">
          <Button key={KEYS.toggle} label="show/hide" hotkey="x" plain onPress={() => undefined} />
          <Button key={KEYS.up} label="up" hotkey="k" plain onPress={() => undefined} />
          <Button key={KEYS.down} label="down" hotkey="j" plain onPress={() => undefined} />
        </Box>,
      ]
    }
    if (menu.level === 'plugin') {
      const field = monthly !== undefined && monthlyKey(menu.entry)
      const list = settings.map((s) => ({ key: settingKey(s.option), label: s.label, right: s.value, rightColor: s.value === 'on' ? c.success : c.muted }))
      return [
        ...(field && menu.ring === field ? list.map((r) => row(r, false)) : rows(list)),
        ...(field
          ? [
              <Box height={1} flexShrink={0} paddingLeft={2}>
                <Input
                  key={field}
                  // The field draws `<label>: `, so its value lines up with the rows'.
                  label={'Monthly cost'.padEnd(LABEL - 2)}
                  value={String(monthly)}
                  {...(menu.ring === field && { autoFocus: true })}
                  // Required; register.tsx's `ui.input` hook saves on Enter.
                  onInput={() => undefined}
                  onSubmit={() => undefined}
                />
              </Box>,
            ]
          : []),
      ]
    }
    if (menu.level === 'themes') {
      const list = themeRows(themes, menu.filter)
      // The body rows left for Theme rows: padding, breadcrumb and rule, the
      // field and its blank row, the two `more` rows, and the footer.
      const room = Math.max(bodyRows - 2 - 4 - 2 - 2 - 1 - footerLines(footer, width), 1)
      const ringed = list.findIndex(({ slug }) => themeKey(slug) === menu.ring)
      // The window centres on the ringed row, else on the current Theme.
      const at = ringed >= 0 ? ringed : Math.max(list.findIndex(({ slug }) => slug === theme), 0)
      const from = Math.min(Math.max(at - Math.floor(room / 2), 0), Math.max(list.length - room, 0))
      const shown = list.slice(from, from + room)
      return [
        <Box height={1} flexShrink={0}>
          <Input
            key={KEYS.filter}
            label="filter "
            placeholder="type to filter"
            value={menu.filter}
            {...(ringed < 0 && { autoFocus: true })}
            // Required; register.tsx's `ui.input` hook handles the typing.
            onInput={() => undefined}
            onSubmit={() => undefined}
          />
        </Box>,
        <Box height={1} flexShrink={0} />,
        ...(list.length
          ? [
              <Text color={c.faint}>{from > 0 ? '↑ more' : ' '}</Text>,
              ...shown.map(({ slug, name }) =>
                row({ key: themeKey(slug), label: name, ...(slug === theme && { right: '●', rightColor: c.accent }) }, ringed >= 0 && themeKey(slug) === menu.ring),
              ),
              <Text color={c.faint}>{from + room < list.length ? '↓ more' : ' '}</Text>,
            ]
          : [<Text color={c.faint}>no match</Text>]),
      ]
    }
    const current = themes.find(({ slug }) => slug === theme)?.name ?? theme
    return rows(
      [
        { key: topKey('plugins'), label: 'Plugins', right: `${plugins.filter(({ enable }) => enable).length}/${plugins.length} ›` },
        { key: topKey('themes'), label: 'Themes', right: `${current} ›` },
      ],
      menu.picks.top && topKey(menu.picks.top as TopPick),
    )
  }

  return (
    <Box
      flexDirection="column"
      paddingX={2}
      paddingY={1}
      width={bodyColumns}
      {...(docked && { height: bodyRows })}
      {...(background && { backgroundColor: background })}
    >
      <Text color={c.main} bold wrap="truncate-end">
        Settings
        {crumbs.map((crumb) => (
          <Text>
            <Text color={c.muted}>{' › '}</Text>
            {crumb}
          </Text>
        ))}
      </Text>
      <Box height={1} flexShrink={0} />
      <Text color={c.faint}>{'═'.repeat(width)}</Text>
      <Box height={1} flexShrink={0} />
      <Box flexDirection="column" flexShrink={1} overflow="hidden">
        {body()}
      </Box>
      {docked && <Box flexGrow={1} />}
      <Text color={c.faint}>{'─'.repeat(width)}</Text>
      <Box flexDirection="row" flexWrap="wrap">
        {footer.map(([key, label], index) => (
          <Text color={c.muted}>
            <Text color={c.main}>{`${key}:`}</Text>
            {` ${label}`}
            {index < footer.length - 1 && <Text color={c.faint}>{' · '}</Text>}
          </Text>
        ))}
      </Box>
    </Box>
  )
}
