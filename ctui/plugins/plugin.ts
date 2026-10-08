import type { ElementTable, RenderNode } from 'claude-code'

import type { SectionConfig } from '../hooks/config'
import type { GitSnapshot, McpRow, Task, Todo, Usage, Versions } from '../types'
import type { Colors } from './colors'

export type SidebarId = 'git' | 'context' | 'limits' | 'mcp' | 'todo' | 'agents' | 'versions'

// What register.tsx loads for the enabled plugins' `needs`.
export type SidebarData = {
  git?: GitSnapshot
  usage?: Usage
  monthCost?: number // the ended sessions' cost this month, without the live session's
  now?: number
  mcp?: McpRow[]
  todo?: Todo
  tasks?: Record<string, Task>
  versions?: Versions
}

// `width` is the row's width in cells. `colors` holds each role's color.
type Draw<T> = (data: SidebarData, ui: ElementTable, cfg: SectionConfig, width: number, colors: Colors) => T

// A Sidebar plugin: pure, never receives `$`. register.tsx loads the data
// each plugin `needs` and passes the element table from `$.ui.resolve(e)`.
// Every color is a role from `colors`: a Text with no color draws in the
// terminal's foreground, not the theme's.
// `view` returns one node per row. A `section` gets a header row with a fold
// button: `count` shows at its right while expanded, `summary` while folded.
// A `list` section is capped at 4 rows.
export type SidebarPlugin = {
  id: SidebarId
  title: string
  slot: 'header' | 'section' | 'footer'
  needs: readonly (keyof SidebarData)[]
  list?: true
  view: Draw<readonly RenderNode[]>
  count?: Draw<RenderNode | undefined>
  summary?: Draw<RenderNode | undefined>
}
