// Pure formatters for the Sidebar's rows (docs/spec/v0.1.md).

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export type Level = 'success' | 'warning' | 'error'

// The role of a bar's fill.
export const level = (percent: number): Level => (percent < 60 ? 'success' : percent < 85 ? 'warning' : 'error')

// `18,402`
export const formatTokens = (tokens: number) => tokens.toLocaleString('en-US')

// `200k`, `1M`
export const formatWindow = (tokens: number) =>
  tokens >= 1_000_000 ? `${+(tokens / 1_000_000).toFixed(1)}M` : `${Math.round(tokens / 1000)}k`

// `0.21$`: the sign after the digits, as everywhere in the Limits section.
export const formatUsd = (usd: number) => `${usd.toFixed(2)}$`

// `62$`, in whole dollars.
export const formatDollars = (usd: number) => `${Math.round(usd)}$`

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

// A bar of `width` cells for `percent`: filled `━`, empty `─`. Past 100 it is full.
export function bar(percent: number, width: number): { filled: string; empty: string } {
  const cells = Math.max(width, 0)
  const filled = Math.round((cells * Math.min(Math.max(percent, 0), 100)) / 100)
  return { filled: '━'.repeat(filled), empty: '─'.repeat(cells - filled) }
}

// A percent right of a bar, at least 5 columns and always one space from it:
// `   9%`, ` 100%`, ` 1133%`. The bar takes what is left of the row.
export const formatPercent = (percent: number) => ` ${Math.round(percent)}%`.padStart(5)

// `21s`, `1m 15s`, `15m 03s`, `1h 02m`.
export function formatElapsed(ms: number): string {
  const seconds = Math.floor(Math.max(ms, 0) / 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${pad(seconds % 60)}s`
  return `${Math.floor(seconds / 3600)}h ${pad(Math.floor((seconds % 3600) / 60))}m`
}

// MEMORY.md "The turn footer": the mode as Claude Code's pill names it.
const MODES: Record<string, string> = {
  default: 'manual mode',
  acceptEdits: 'accept edits',
  plan: 'plan mode',
  bypassPermissions: 'bypass permissions',
  auto: 'auto mode',
  dontAsk: "don't ask",
}

export const modeLabel = (mode: string) => MODES[mode] ?? mode

// MEMORY.md "The line under the prompt": `claude-opus-5-5 · high effort`, or
// the model alone when it takes no effort (`null`) or none is known.
export const promptLabel = (model: string, effort: string | null | undefined) =>
  effort ? `${model} · ${effort} effort` : model

// The widest pill, `⏵⏵ bypass permissions on`.
const PILL = 24

// The label fits the line beside the pill and the hint, from `columns` wide.
export const fitsPromptLine = (hint: string, label: string, columns: number) =>
  2 + PILL + 1 + hint.length + 2 + label.length <= columns

type Settings = Readonly<Record<string, unknown>>

// `modelSettings[<model>].effortLevel`: the level `/effort` saved for the model.
export const modelEffort = (settings: Settings, model: string): unknown =>
  (settings.modelSettings as Record<string, { effortLevel?: unknown }> | undefined)?.[model]?.effortLevel

// The effort a model starts a session with: its own saved level, else the global one.
export function savedEffort(settings: Settings, model: string): string | undefined {
  const level = modelEffort(settings, model) ?? settings.effortLevel
  return typeof level === 'string' ? level : undefined
}
