import type { SidebarPlugin } from '../plugin'

// Rows come in a later slice of docs/spec/v0.1.md.
const plugin: SidebarPlugin = {
  id: 'agents',
  title: 'Agents & shells',
  slot: 'section',
  needs: [],
  list: true,
  view: () => [],
}

export default plugin
