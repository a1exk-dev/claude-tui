import type { SidebarId } from '../plugins/plugin'

// What a `/ctui:*` command does (MEMORY.md "`/ctui:*` commands stay quiet on
// success; a bare command opens a picker pane"): write one setting, print one
// line, or open a picker of `options` with `value` selected.
export type Outcome =
  | { text: string }
  | { set: { key: string; value: string | boolean } }
  | { pick: { options: readonly string[]; value?: string } }

export type Toggle = 'enable' | 'disable'

export const NO_CONFIG = "Can't change ctui settings in claude -p. Use /config in an interactive session."

// `/ctui:plugins:enable|disable [plugin]`; `plugins` in registry order.
export function pluginsOutcome(
  action: Toggle,
  args: string,
  plugins: readonly { id: SidebarId; enable: boolean }[],
): Outcome {
  const name = args.trim()
  const on = action === 'enable'
  if (!name) {
    const options = plugins.filter((plugin) => plugin.enable !== on).map((plugin) => plugin.id)
    return options.length ? { pick: { options } } : { text: `All Sidebar plugins are already ${action}d` }
  }
  const plugin = plugins.find((p) => p.id === name)
  if (!plugin) return { text: `Unknown plugin "${name}". Plugins: ${plugins.map((p) => p.id).join(', ')}` }
  if (plugin.enable === on) return { text: `${name} is already ${action}d` }
  return { set: { key: `ctui.${name}_enable`, value: on } }
}

// `/ctui:theme [theme]`: the picker always opens, the current theme selected.
export function themeOutcome(args: string, themes: readonly string[], current: string): Outcome {
  const name = args.trim()
  if (!name) return { pick: { options: themes, value: current } }
  if (!themes.includes(name)) return { text: `Unknown theme "${name}". Themes: ${themes.join(', ')}` }
  if (name === current) return { text: `Sidebar theme is already ${name}` }
  return { set: { key: 'ctui.theme', value: name } }
}

// Gates a write or a picker on the `ctui.theme` `/config` row: `claude -p`
// and the SDK list none, and `$.config.set` throws there.
export const gated = (outcome: Outcome, hasConfig: boolean): Outcome =>
  'text' in outcome || hasConfig ? outcome : { text: NO_CONFIG }

// The line for a `{ deny }` from `$.config.set`.
export function deniedText(set: { key: string; value: string | boolean }, deny: string) {
  const id = /^ctui\.(\w+)_enable$/.exec(set.key)?.[1]
  if (id) return `Can't ${set.value ? 'enable' : 'disable'} ${id}: ${deny}`
  return `Can't switch the Sidebar theme to ${set.value}: ${deny}`
}
