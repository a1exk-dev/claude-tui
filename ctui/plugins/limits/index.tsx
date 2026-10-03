import type { SidebarPlugin } from '../plugin'

const title = 'Limits'

const plugin: SidebarPlugin = {
  id: 'limits',
  title,
  needs: [],
  view: (_data, { Text }) => <Text dimColor>{title}</Text>,
}

export default plugin
