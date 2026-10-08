import { bar, formatDollars, formatPercent, formatReset, formatUsd, level } from '../../hooks/format'
import type { CostChoice } from '../../hooks/config'
import type { Usage } from '../../types'
import type { SidebarPlugin } from '../plugin'

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

// A Claude plan reports a 5-hour or a weekly window; a gateway's `spend_limit`
// alone isn't one.
const onPlan = (usage: Usage) => usage.rateLimits.some(({ kind }) => kind === 'five_hour' || kind === 'seven_day')

// The cost the row shows, or undefined when it's hidden: `auto` hides it on a plan.
const cost = (usage: Usage | undefined, choice: CostChoice = 'auto') =>
  usage?.cost && (choice === 'on' || (choice === 'auto' && !onPlan(usage))) ? usage.cost.usd : undefined

const plugin: SidebarPlugin = {
  id: 'limits',
  title: 'Limits',
  slot: 'section',
  needs: ['usage', 'now'],
  view: ({ usage, now }, { Text }, cfg, width, c) => {
    if (!usage) return []
    // With no `percent`, the bar stays empty and the percent column blank.
    const meter = (label: string, percent: number | undefined, under: string | undefined) => {
      const cells = bar(percent ?? 0, width - LABEL_WIDTH - 5)
      return [
        <Text color={c.main}>
          {label.padEnd(LABEL_WIDTH)}
          <Text color={c[level(percent ?? 0)]}>{cells.filled}</Text>
          <Text color={c.faint}>{cells.empty}</Text>
          {percent !== undefined && <Text color={c.main}>{formatPercent(percent)}</Text>}
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
    const usd = cost(usage, cfg.cost)
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
  summary: ({ usage }, ui, cfg) => {
    const usd = cost(usage, cfg.cost)
    const parts = [
      ...(usd === undefined ? [] : [formatDollars(usd)]),
      ...(usage ? sorted(usage).map(({ kind, percentUsed }) => `${WINDOWS[kind]?.short ?? kind} ${Math.round(percentUsed)}%`) : []),
    ]
    return parts.length ? parts.join(' · ') : undefined
  },
}

export default plugin
