import type { SidebarPlugin } from '../plugin'

// The Sidebar footer: installed versions and the Theme, no update icon
// (MEMORY.md). One row where it fits the body width, else two.
const plugin: SidebarPlugin = {
  id: 'versions',
  title: 'Versions',
  slot: 'footer',
  needs: ['versions'],
  view: ({ versions }, { Text }, _cfg, width, c) => {
    if (!versions) return []
    const { claude, ctui, theme } = versions
    if (`claude cli: ${claude} │ ctui: ${ctui}, ${theme}`.length > width) {
      return [
        <Text color={c.main} wrap="truncate-end">
          <Text color={c.muted}>claude cli:</Text> {claude}
        </Text>,
        <Text color={c.main} wrap="truncate-end">
          <Text color={c.muted}>ctui:</Text> {ctui}, {theme}
        </Text>,
      ]
    }
    return [
      <Text color={c.main} wrap="truncate-end">
        <Text color={c.muted}>claude cli:</Text> {claude} <Text color={c.faint}>│</Text>{' '}
        <Text color={c.muted}>ctui:</Text> {ctui}, {theme}
      </Text>,
    ]
  },
}

export default plugin
