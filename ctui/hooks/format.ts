// Pure formatters for the Sidebar's rows (docs/spec/v0.1.md).

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export type Level = 'success' | 'warning' | 'error'

// The color of a bar and its percent.
export const level = (percent: number): Level => (percent < 60 ? 'success' : percent < 85 ? 'warning' : 'error')

// `18,402`
export const formatTokens = (tokens: number) => tokens.toLocaleString('en-US')

// `200k`, `1M`
export const formatWindow = (tokens: number) =>
  tokens >= 1_000_000 ? `${+(tokens / 1_000_000).toFixed(1)}M` : `${Math.round(tokens / 1000)}k`

// `$0.21`
export const formatUsd = (usd: number) => `$${usd.toFixed(2)}`

// `resets in 2h 17m`; past a day, `resets in 3d 4h, Mon 09:00` in local 24-hour time.
export function formatReset(resetsAt: string, now: number): string {
  const at = new Date(resetsAt)
  const left = Math.max(at.getTime() - now, 0)
  if (left <= DAY) {
    const hours = Math.floor(left / HOUR)
    const minutes = Math.floor((left % HOUR) / MINUTE)
    return `resets in ${hours ? `${hours}h ` : ''}${minutes}m`
  }
  const pad = (n: number) => String(n).padStart(2, '0')
  const clock = `${WEEKDAYS[at.getDay()]} ${pad(at.getHours())}:${pad(at.getMinutes())}`
  return `resets in ${Math.floor(left / DAY)}d ${Math.floor((left % DAY) / HOUR)}h, ${clock}`
}

// A bar of `width` `━` cells for `percent`, split into filled and empty runs.
// Past 100 it is full.
export function bar(percent: number, width: number): { filled: string; empty: string } {
  const cells = Math.max(width, 0)
  const filled = Math.round((cells * Math.min(Math.max(percent, 0), 100)) / 100)
  return { filled: '━'.repeat(filled), empty: '━'.repeat(cells - filled) }
}

// A percent in the 5 columns right of a bar: `  9%`, ` 100%`.
export const formatPercent = (percent: number) => `${Math.round(percent)}%`.padStart(5)
