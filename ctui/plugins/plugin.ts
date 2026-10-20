import type { ElementTable, RenderElement, RenderNode } from 'claude-code'

import type { SectionConfig } from '../hooks/config'
import type { FoldRowProps } from '../hooks/foldrow'
import type { PressProps } from '../hooks/press'
import type { GitSnapshot, McpRow, SkillRow, Task, Todo, Usage, Versions } from '../types'
import type { Colors } from './colors'
import type { SpinnerProps } from '../hooks/spinner'

export type SidebarId = 'git' | 'context' | 'limits' | 'todo' | 'skills' | 'mcp' | 'agents' | 'versions'

// What register.tsx loads for the enabled plugins' `needs`.
export type SidebarData = {
  git?: GitSnapshot
  usage?: Usage
  monthCost?: number // the ended sessions' cost this month, without the live session's
  now?: number
  mcp?: McpRow[]
  todo?: Todo
  skills?: readonly SkillRow[]
  tasks?: Record<string, Task>
  versions?: Versions
}

// The Sidebar's `Client`s, each under its `key`: a fold arrow or list toggle
// (`press.tsx`), a section's title row (`foldrow.tsx`) and a working row's
// sweep (`spinner.tsx`). Each returns a Client placeholder (`clients.ts`)
// that the Sidebar's render hook in register.tsx draws as its `Client`, the only
// place one is written (MEMORY.md "Sidebar plugins are pure; only
// `register.tsx` touches `$`").
export type SidebarClients = {
  press: (key: string, props: PressProps) => RenderElement
  foldRow: (key: string, width: number, props: FoldRowProps) => RenderElement
  sweep: (key: string, props: SpinnerProps) => RenderElement
}

// The Sidebar's elements, from the surfaces that draw a Client, and its Clients.
export type SidebarUi = Pick<ElementTable<'terminal' | 'desktop'>, 'Box' | 'Text' | 'Button'> & SidebarClients

// `width` is the row's width in cells. `colors` holds each role's color.
type Draw<T> = (data: SidebarData, ui: SidebarUi, cfg: SectionConfig, width: number, colors: Colors) => T

// A Sidebar plugin: pure, never receives `$`. register.tsx loads the data
// each plugin `needs` and passes the element table from `$.ui.resolve(e)`.
// Every color is a role from `colors`: a Text with no color draws in the
// terminal's foreground, not the theme's.
// `view` returns one node per row. A `section` gets a header row with a fold
// button: `count` shows at its right while expanded, `summary` while folded.
// A `list` section is capped at `cap` rows, 4 unless it sets its own.
export type SidebarPlugin = {
  id: SidebarId
  title: string
  slot: 'header' | 'section' | 'footer'
  needs: readonly (keyof SidebarData)[]
  list?: true
  cap?: number
  view: Draw<readonly RenderNode[]>
  count?: Draw<RenderNode | undefined>
  summary?: Draw<RenderNode | undefined>
}
