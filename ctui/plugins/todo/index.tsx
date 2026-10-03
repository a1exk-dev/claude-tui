import type { SidebarPlugin } from '../plugin'

const title = 'Todo'

const plugin: SidebarPlugin = {
  id: 'todo',
  title,
  needs: [],
  view: (_data, { Text }) => <Text dimColor>{title}</Text>,
}

export default plugin
