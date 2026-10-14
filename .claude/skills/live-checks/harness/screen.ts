// Reads the parsed screen: text, background runs, per-cell colors. The only place that knows the cell grid.
import type { IBufferCell, Terminal } from '@xterm/headless'

/** `#rrggbb` for a truecolor cell, `idx<n>` for a palette one, `default` for the terminal's own. */
const color = (cell: IBufferCell, which: 'fg' | 'bg'): string => {
  if (which === 'fg' ? cell.isFgDefault() : cell.isBgDefault()) return 'default'
  const value = which === 'fg' ? cell.getFgColor() : cell.getBgColor()
  if (which === 'fg' ? cell.isFgRGB() : cell.isBgRGB()) return `#${value.toString(16).padStart(6, '0')}`
  return `idx${value}`
}

const bit = (value: boolean | number): string => (value ? '1' : '0')

const cellAt = (term: Terminal, y: number, x: number): IBufferCell | undefined =>
  term.buffer.active.getLine(term.buffer.active.viewportY + y)?.getCell(x)

/** One cell's drawing attributes, the form every check reads a theme role off. */
const attrs = (cell: IBufferCell | undefined): string =>
  cell
    ? `fg=${color(cell, 'fg')} bg=${color(cell, 'bg')} b=${bit(cell.isBold())} u=${bit(cell.isUnderline())}`
    : 'fg=default bg=default b=0 u=0'

interface Run {
  key: string
  from: number
  to: number
  text: string
}

/** One row coalesced into runs of equal `key`, each carrying its columns and its text. */
const rowRuns = (term: Terminal, y: number, key: (cell: IBufferCell | undefined) => string): Run[] => {
  const runs: Run[] = []
  for (let x = 0; x < term.cols; x++) {
    const cell = cellAt(term, y, x)
    const next = key(cell)
    const chars = cell?.getChars() || ' '
    const last = runs.at(-1)
    if (last && last.key === next) {
      last.to = x
      last.text += chars
    } else runs.push({ key: next, from: x, to: x, text: chars })
  }
  return runs
}

/** One screen row as text, right-trimmed. A cell the engine left empty reads as a space, as the column grid does. */
export const rowText = (term: Terminal, y: number): string => {
  let text = ''
  for (let x = 0; x < term.cols; x++) text += cellAt(term, y, x)?.getChars() || ' '
  return text.trimEnd()
}

const numbered = (y: number, text: string): string => `${String(y).padStart(3)} ${text}`

/** Every row, numbered. */
export const dump = (term: Terminal): string[] =>
  Array.from({ length: term.rows }, (_, y) => numbered(y, rowText(term, y)))

/** Every row as its runs of background color, `<color>:<first>-<last>` per run — the paint checks read this. */
export const dumpbg = (term: Terminal): string[] =>
  Array.from({ length: term.rows }, (_, y) =>
    numbered(
      y,
      rowRuns(term, y, (cell) => (cell ? color(cell, 'bg') : 'default'))
        .map((run) => `${run.key}:${run.from}-${run.to}`)
        .join(' '),
    ),
  )

/** The rows holding `needle`, numbered. */
export const grep = (term: Terminal, needle: string): string[] =>
  dump(term).filter((row) => row.slice(4).includes(needle))

/** Per-cell colors over a column range of one row: `(y,x) 'c' fg=… bg=… b=<bold> u=<underline>`. */
export const cells = (term: Terminal, y: number, from: number, to: number): string[] => {
  const out: string[] = []
  for (let x = from; x <= to; x++) {
    const cell = cellAt(term, y, x)
    if (!cell) continue
    out.push(`  (${y},${x}) ${JSON.stringify(cell.getChars() || ' ')} ${attrs(cell)}`)
  }
  return out
}

/** One row as its runs of fg/bg/bold, with the run's text — how a theme role is read off a row. */
export const runs = (term: Terminal, y: number): string[] =>
  rowRuns(term, y, attrs)
    .filter((run) => run.text.trim())
    .map((run) => `  ${run.key} ${JSON.stringify(run.text)}`)
