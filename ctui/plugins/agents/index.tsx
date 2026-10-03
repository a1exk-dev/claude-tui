import type { SidebarPlugin } from '../plugin'

const title = 'Agents & shells'

const plugin: SidebarPlugin = {
  id: 'agents',
  title,
  needs: [],
  view: (_data, { Text }) => <Text dimColor>{title}</Text>,
}

export default plugin
