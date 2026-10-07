import { bar, formatPercent, formatReset, level } from '../../hooks/format'
import type { Usage } from '../../types'
import type { SidebarPlugin } from '../plugin'

// Each rate-limit window: label, bar and percent, then when it resets.
const WINDOWS: Record<string, { label: string; short: string }> = {
  five_hour: { label: '5h', short: '5h' },
  seven_day: { label: 'week', short: 'wk' },
  spend_limit: { label: 'spend', short: 'spend' },
}
const LABEL_WIDTH = 6 // `spend` and a space
const order = (kind: string) => {
  const index = Object.keys(WINDOWS).indexOf(kind)
  return index < 0 ? Infinity : index
}
const sorted = (usage: Usage) => [...usage.rateLimits].sort((a, b) => order(a.kind) - order(b.kind))

const plugin: SidebarPlugin = {
  id: 'limits',
  title: 'Limits',
  slot: 'section',
  needs: ['usage', 'now'],
  view: ({ usage, now }, { Text }, _cfg, width, c) => {
    if (!usage) return []
    if (!usage.rateLimits.length) return [<Text color={c.muted}>no limits reported</Text>]
    return sorted(usage).flatMap(({ kind, percentUsed, resetsAt }) => {
      const cells = bar(percentUsed, width - LABEL_WIDTH - 5)
      return [
        <Text color={c.main}>
          {(WINDOWS[kind]?.label ?? kind).padEnd(LABEL_WIDTH)}
          <Text color={c[level(percentUsed)]}>{cells.filled}</Text>
          <Text color={c.faint}>{cells.empty}</Text>
          <Text color={c.main}>{formatPercent(percentUsed)}</Text>
        </Text>,
        ...(resetsAt && now !== undefined
          ? [
              <Text color={c.muted} wrap="truncate-end">
                {' '.repeat(LABEL_WIDTH)}
                {formatReset(resetsAt, now)}
              </Text>,
            ]
          : []),
      ]
    })
  },
  summary: ({ usage }) =>
    usage?.rateLimits.length
      ? sorted(usage)
          .map(({ kind, percentUsed }) => `${WINDOWS[kind]?.short ?? kind} ${Math.round(percentUsed)}%`)
          .join(' · ')
      : undefined,
}

export default plugin
