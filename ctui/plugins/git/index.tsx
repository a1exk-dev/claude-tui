import type { SidebarPlugin } from '../plugin'

const title = 'Git'

const plugin: SidebarPlugin = {
  id: 'git',
  title,
  needs: [],
  view: (_data, { Text }) => <Text dimColor>{title}</Text>,
}

export default plugin
