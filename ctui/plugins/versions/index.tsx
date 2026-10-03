import type { SidebarPlugin } from '../plugin'

const title = 'Versions'

const plugin: SidebarPlugin = {
  id: 'versions',
  title,
  needs: [],
  view: (_data, { Text }) => <Text dimColor>{title}</Text>,
}

export default plugin
