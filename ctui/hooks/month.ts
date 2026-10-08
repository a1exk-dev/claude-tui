import type { Usage } from '../types'
import type { CostChoice } from './config'

// The Limits cost row's month total: every session's last `cost-state` in its
// transcript, counted in the local month the transcript was last written.

// A session's total as last read from its transcript, kept in `$.store`.
export type Cached = { usd: number; mtimeMs: number; size: number }

// A main transcript, `<session id>.jsonl`, as `$.fs.list` gives it.
export type Transcript = { session: string; path: string; mtimeMs: number; size: number }

const pad = (n: number) => String(n).padStart(2, '0')

// The local month, `2026-10`.
export function monthOf(ms: number) {
  const date = new Date(ms)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`
}

// Midnight local time on the 1st.
export function monthStart(ms: number) {
  const date = new Date(ms)
  return new Date(date.getFullYear(), date.getMonth(), 1).getTime()
}

// One `$.store` key per session, so concurrent sessions write apart; the
// month in it drops earlier months by name.
export const COST_PREFIX = 'cost:'
export const costKey = (month: string, session: string) => `${COST_PREFIX}${month}:${session}`

// `totalCostUSD` from the last `cost-state` line per `sessionId` in grep's output.
export function lastCosts(stdout: string) {
  const costs: Record<string, number> = {}
  for (const line of stdout.split('\n')) {
    try {
      const { sessionId, totalCostUSD } = JSON.parse(line)
      if (typeof sessionId === 'string' && typeof totalCostUSD === 'number') costs[sessionId] = totalCostUSD
    } catch {
      // Empty, or caught mid-write.
    }
  }
  return costs
}

// The transcripts to grep: new ones, and ones whose size or mtime moved.
export const staleTranscripts = (transcripts: readonly Transcript[], cached: Readonly<Record<string, Cached>>) =>
  transcripts.filter(({ session, mtimeMs, size }) => cached[session]?.mtimeMs !== mtimeMs || cached[session]?.size !== size)

// The ended sessions' total: the current session counts by its live cost instead.
export const monthTotal = (cached: Readonly<Record<string, Cached>>, current: string) =>
  Object.entries(cached).reduce((sum, [session, { usd }]) => (session === current ? sum : sum + usd), 0)

// A Claude plan reports a 5-hour or a weekly window; a gateway's `spend_limit`
// alone isn't one.
const onPlan = (usage: Usage) => usage.rateLimits.some(({ kind }) => kind === 'five_hour' || kind === 'seven_day')

// Whether the cost row shows: `auto` hides it on a plan, and it needs a cost.
export const showsCost = (usage: Usage | undefined, choice: CostChoice = 'auto') =>
  Boolean(usage?.cost && (choice === 'on' || (choice === 'auto' && !onPlan(usage))))
