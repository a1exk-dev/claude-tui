import { bar, formatDollars, formatPercent, formatReset, formatUsd, level } from '../../hooks/format'
import type { CostChoice } from '../../hooks/config'
import { showsCost } from '../../hooks/month'
import type { Usage } from '../../types'
import type { SidebarData, SidebarPlugin } from '../plugin'

// The cost row opens the section: the cost against `limits_cost_monthly`, the
// way each rate-limit window after it shows its use. Each row is the label,
// the bar and the percent, then a muted line under them: the cost of the
// limit, or when the window resets.
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

// The month's cost the row shows: the ended sessions' total plus the live
// session's. Undefined, the row is hidden: until the first scan, and where
// `auto` hides it on a plan.
const cost = ({ usage, monthCost }: SidebarData, choice: CostChoice | undefined) =>
  monthCost !== undefined && showsCost(usage, choice) ? monthCost + (usage?.cost?.usd ?? 0) : undefined

const plugin: SidebarPlugin = {
  id: 'limits',
  title: 'Limits',
  slot: 'section',
  needs: ['usage', 'now', 'monthCost'],
  view: (data, { Text }, cfg, width, c) => {
    const { usage, now } = data
    if (!usage) return []
    // With no `percent`, the bar stays empty and the percent column blank.
    const meter = (label: string, percent: number | undefined, under: string | undefined) => {
      const shown = formatPercent(percent ?? 0)
      const cells = bar(percent ?? 0, width - LABEL_WIDTH - shown.length)
      return [
        <Text color={c.main}>
          {label.padEnd(LABEL_WIDTH)}
          <Text color={c[level(percent ?? 0)]}>{cells.filled}</Text>
          <Text color={c.faint}>{cells.empty}</Text>
          {percent !== undefined && <Text color={c.main}>{shown}</Text>}
        </Text>,
        ...(under
          ? [
              <Text color={c.muted} wrap="truncate-end">
                {' '.repeat(LABEL_WIDTH)}
                {under}
              </Text>,
            ]
          : []),
      ]
    }
    const usd = cost(data, cfg.cost)
    const limit = cfg.monthly ?? 100
    const costRows =
      usd === undefined
        ? []
        : limit > 0
          ? meter('cost', (usd / limit) * 100, `${formatUsd(usd)} of ${limit}$`)
          : meter('cost', undefined, formatUsd(usd))
    const windows = sorted(usage).flatMap(({ kind, percentUsed, resetsAt }) =>
      meter(
        WINDOWS[kind]?.label ?? kind,
        percentUsed,
        resetsAt && now !== undefined ? formatReset(resetsAt, now) : undefined,
      ),
    )
    const rows = [...costRows, ...windows]
    return rows.length ? rows : [<Text color={c.muted}>no limits reported</Text>]
  },
  // The cost in whole dollars, then each window's percent.
  summary: (data, ui, cfg) => {
    const { usage } = data
    const usd = cost(data, cfg.cost)
    const parts = [
      ...(usd === undefined ? [] : [formatDollars(usd)]),
      ...(usage ? sorted(usage).map(({ kind, percentUsed }) => `${WINDOWS[kind]?.short ?? kind} ${Math.round(percentUsed)}%`) : []),
    ]
    return parts.length ? parts.join(' · ') : undefined
  },
}

export default plugin
