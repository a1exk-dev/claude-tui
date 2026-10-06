import type { SidebarPlugin } from '../plugin'

// The Sidebar footer: installed versions only, no update icon (MEMORY.md).
const plugin: SidebarPlugin = {
  id: 'versions',
  title: 'Versions',
  slot: 'footer',
  needs: ['versions'],
  view: ({ versions }, { Text }) =>
    versions
      ? [
          <Text wrap="truncate-end">
            <Text dimColor>ctui</Text> {versions.ctui}
          </Text>,
          <Text wrap="truncate-end">
            <Text dimColor>claude-cli</Text> {versions.claude}
          </Text>,
        ]
      : [],
}

export default plugin
