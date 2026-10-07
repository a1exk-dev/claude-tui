import type { SidebarPlugin } from '../plugin'

// The Sidebar footer: installed versions only, no update icon (MEMORY.md).
const plugin: SidebarPlugin = {
  id: 'versions',
  title: 'Versions',
  slot: 'footer',
  needs: ['versions'],
  view: ({ versions }, { Text }, _cfg, _width, c) =>
    versions
      ? [
          <Text color={c.main} wrap="truncate-end">
            <Text color={c.muted}>ctui</Text> {versions.ctui} <Text color={c.faint}>│</Text>{' '}
            <Text color={c.muted}>claude-cli</Text> {versions.claude}
          </Text>,
        ]
      : [],
}

export default plugin
