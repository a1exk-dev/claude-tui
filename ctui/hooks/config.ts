import type { PluginOptions } from 'claude-code'

import { plugins } from '../plugins'
import type { SidebarId } from '../plugins/plugin'

// One Sidebar plugin's settings: `<id>_enable`, for a foldable one
// `<id>_folded`, for `todo` `todo_tools`, and for `limits` `limits_cost` and
// `limits_cost_monthly`.
export type SectionConfig = { enable: boolean; folded?: boolean; tools?: boolean; cost?: CostChoice; monthly?: number }

// `auto` shows the Limits cost row off a plan; `on` and `off` override that.
export type CostChoice = 'auto' | 'on' | 'off'

export type Config = Record<SidebarId, SectionConfig> & {
  agents: SectionConfig & { toasts: boolean }
  limits: SectionConfig & { cost: CostChoice; monthly: number }
  todo: SectionConfig & { tools: boolean }
  theme: string
}

// Regroups the flat `userConfig` options (MEMORY.md "Plugin settings are flat
// `userConfig` keys").
export function readConfig(options: PluginOptions): Config {
  const sections = {} as Record<SidebarId, SectionConfig>
  for (const { id } of plugins) {
    const folded = options[`${id}_folded`]
    sections[id] = {
      enable: options[`${id}_enable`] !== false,
      ...(typeof folded === 'boolean' && { folded }),
    }
  }
  return {
    ...sections,
    agents: { ...sections.agents, toasts: options.agents_toasts !== false },
    limits: {
      ...sections.limits,
      cost: options.limits_cost === 'on' || options.limits_cost === 'off' ? options.limits_cost : 'auto',
      // A non-number limit, possible only by hand-editing settings.json, reads as the default.
      monthly: typeof options.limits_cost_monthly === 'number' ? options.limits_cost_monthly : 100,
    },
    todo: { ...sections.todo, tools: options.todo_tools !== false },
    theme: typeof options.theme === 'string' ? options.theme : 'inherit',
  }
}
