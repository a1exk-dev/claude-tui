import type { SidebarPlugin } from '../plugin'

// Rows come in a later slice of docs/spec/v0.1.md.
const plugin: SidebarPlugin = {
  id: 'limits',
  title: 'Limits',
  slot: 'section',
  needs: [],
  view: () => [],
}

export default plugin
