import { bar, formatPercent, formatTokens, formatWindow, level } from '../../hooks/format'
import type { SidebarPlugin } from '../plugin'

// The context window's fill: a bar and the tokens over the window.
// Before the first response the fill is absent and reads 0.
const plugin: SidebarPlugin = {
  id: 'context',
  title: 'Context',
  slot: 'section',
  needs: ['usage'],
  view: ({ usage }, { Text }, _cfg, width, c) => {
    if (!usage) return []
    const { tokens = 0, window, percent = 0 } = usage.context
    const shown = formatPercent(percent)
    const cells = bar(percent, width - shown.length)
    return [
      <Text>
        <Text color={c[level(percent)]}>{cells.filled}</Text>
        <Text color={c.faint}>{cells.empty}</Text>
        <Text color={c.main}>{shown}</Text>
      </Text>,
      <Text color={c.muted} wrap="truncate-end">
        {formatTokens(tokens)} / {formatWindow(window)} tokens
      </Text>,
    ]
  },
  summary: ({ usage }) => usage && `${usage.context.percent ?? 0}%`,
}

export default plugin
