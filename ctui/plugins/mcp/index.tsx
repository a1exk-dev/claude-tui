import type { SidebarPlugin } from '../plugin'

const title = 'MCP'

const plugin: SidebarPlugin = {
  id: 'mcp',
  title,
  needs: [],
  view: (_data, { Text }) => <Text dimColor>{title}</Text>,
}

export default plugin
