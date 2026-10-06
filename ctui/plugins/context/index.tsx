import { bar, formatPercent, formatTokens, formatUsd, formatWindow, level } from '../../hooks/format'
import type { SidebarPlugin } from '../plugin'

// The context window's fill: a bar, the tokens over the window, and the session cost.
// Before the first response the fill is absent and reads 0.
const plugin: SidebarPlugin = {
  id: 'context',
  title: 'Context',
  slot: 'section',
  needs: ['usage'],
  view: ({ usage }, { Box, Text }, _cfg, width) => {
    if (!usage) return []
    const { tokens = 0, window, percent = 0 } = usage.context
    const color = level(percent)
    const cells = bar(percent, width - 5)
    return [
      <Text>
        <Text color={color}>{cells.filled}</Text>
        <Text color="inactive">{cells.empty}</Text>
        <Text color={color}>{formatPercent(percent)}</Text>
      </Text>,
      <Box flexGrow={1} justifyContent="space-between">
        <Text dimColor wrap="truncate-end">
          {formatTokens(tokens)} / {formatWindow(window)} tokens
        </Text>
        {usage.cost ? <Text dimColor>{formatUsd(usage.cost.usd)}</Text> : null}
      </Box>,
    ]
  },
  summary: ({ usage }) =>
    usage && [`${usage.context.percent ?? 0}%`, ...(usage.cost ? [formatUsd(usage.cost.usd)] : [])].join(' · '),
}

export default plugin
