import type { ElementTable, RenderNode } from 'claude-code'

// A Sidebar plugin: pure, never receives `$`. register.tsx loads the data
// each plugin `needs` and passes the element table from `$.ui.resolve(e)`.
export type SidebarPlugin = {
  id: string
  title: string
  needs: readonly string[]
  view: (data: unknown, ui: ElementTable, cfg: unknown) => RenderNode
}
