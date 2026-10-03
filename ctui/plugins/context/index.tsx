import type { SidebarPlugin } from '../plugin'

const title = 'Context'

const plugin: SidebarPlugin = {
  id: 'context',
  title,
  needs: [],
  view: (_data, { Text }) => <Text dimColor>{title}</Text>,
}

export default plugin
