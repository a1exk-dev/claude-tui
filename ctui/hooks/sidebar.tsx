import type { ElementTable, RenderElement, RenderNode } from 'claude-code'

import type { Colors } from '../plugins/colors'
import type { SidebarData, SidebarId, SidebarPlugin } from '../plugins/plugin'
import type { Config } from './config'

export const CAP = 4
// Space under an expanded section's title, and after an expanded section
// before the next title, in rows (#85).
export const TITLE_GAP = 1 / 3
export const SECTION_GAP = 1.5

export type SidebarInput = {
  ui: ElementTable<'terminal' | 'desktop'> // the surfaces that draw a Client
  bodyRows: number // the Pane's `scroll.bodyRows`
  bodyColumns: number // the Pane's `bodyColumns`
  plugins: readonly SidebarPlugin[] // enabled, in registry order
  data: SidebarData
  config: Config
  colors: Colors
  background?: string // a selected Theme's glass; none under `inherit`
  folded: Record<string, boolean> // unset reads `<id>_folded`
  expanded: Record<string, boolean>
  scroll: number
  focused: boolean // the Pane's `isFocused`
  onControl: (control: Control) => void
}

// A Sidebar control's key: `fold-<id>` or `more-<id>`. A section's title
// row, `foldrow-<id>`, folds it as its `fold-<id>` arrow does.
export type Control = { kind: 'fold' | 'more'; id: SidebarId }
export const controlKey = ({ kind, id }: Control) => `${kind}-${id}`
export const foldRowKey = (id: SidebarId) => `foldrow-${id}`

// The Sidebar body (MEMORY.md "The Sidebar adapts to the dock's engine
// chrome"): git header, the sections window, flexible space, versions footer
// on the last row. `maxScroll` is the window's last offset, 0 when it fits.
export function sidebar(input: SidebarInput): { tree: RenderElement; maxScroll: number } {
  const { ui, plugins, data, config, colors: c } = input
  // Padding takes 2 columns each side; section rows indent 2 more.
  const width = input.bodyColumns - 4
  const { Box, Text, Button, Client } = ui
  // A fold arrow or a list toggle. At rest a muted `Client`, whose click
  // `register.tsx` answers at `ui.message`. A Client is outside the focus
  // ring, so while the Pane holds the focus it is a dim Button instead.
  // A fold arrow lights with its title row's hover `scope`.
  const control = (key: Control, label: string) =>
    input.focused ? (
      <Button key={controlKey(key)} plain dimColor label={label} onPress={() => input.onControl(key)} />
    ) : (
      <Client
        key={controlKey(key)}
        module="./press.tsx"
        props={{ label, color: c.muted, hover: c.main, ...(key.kind === 'fold' && { scope: foldRowKey(key.id) }) }}
      />
    )
  const row = (node: RenderNode, indent = 0) => (
    <Box height={1} flexShrink={0} paddingLeft={indent}>
      {typeof node === 'string' ? (
        <Text color={c.main} wrap="truncate-end">
          {node}
        </Text>
      ) : (
        node
      )}
    </Box>
  )
  const line = (node: RenderNode, indent = 0): Stop<RenderElement> => ({ nodes: [row(node, indent)], height: 1 })
  // An empty Box: the root's paint covers it.
  const spacer = (height: number) => <Box height={height} flexShrink={0} />
  const rowsOf = (slot: SidebarPlugin['slot']) =>
    plugins.filter((p) => p.slot === slot).flatMap((p) => p.view(data, ui, config[p.id], width, c))

  // One scroll stop per section row. A title carries the gap before it and
  // the space under it, so each scroll step moves one row.
  const sections: Stop<RenderElement>[] = []
  let gap = false
  for (const plugin of plugins.filter((p) => p.slot === 'section')) {
    const cfg = config[plugin.id]
    const folded = input.folded[plugin.id] ?? cfg.folded ?? false
    const right = (folded ? plugin.summary : plugin.count)?.(data, ui, cfg, width, c) ?? null
    // The title and the count or summary are one Client, under the same key
    // in both focus modes; a click anywhere on it folds the section. Its
    // `width` leaves the arrow's cell: `flexGrow` alone laid the region out a
    // cell too wide, into the right padding (checked on 2.1.292).
    const key = foldRowKey(plugin.id)
    const title = (
      <Box height={1} flexShrink={0}>
        {control({ kind: 'fold', id: plugin.id }, folded ? '▸' : '▾')}
        <Client
          key={key}
          module="./foldrow.tsx"
          width={width - 1}
          flexGrow={1}
          props={{ title: plugin.title, right, main: c.main, muted: c.muted, scope: key }}
        />
      </Box>
    )
    sections.push({
      nodes: [...(gap ? [spacer(SECTION_GAP)] : []), title, ...(folded ? [] : [spacer(TITLE_GAP)])],
      height: (gap ? SECTION_GAP : 0) + 1 + (folded ? 0 : TITLE_GAP),
    })
    gap = !folded
    if (folded) continue
    const body = plugin.view(data, ui, cfg, width - 2, c)
    const expanded = input.expanded[plugin.id] ?? false
    const capped = plugin.list && body.length > CAP
    sections.push(...(capped && !expanded ? body.slice(0, CAP) : body).map((node) => line(node, 2)))
    if (capped) {
      const label = expanded ? '▾ show less' : `▸ ${body.length - CAP} more`
      sections.push(line(control({ kind: 'more', id: plugin.id }, label), 2))
    }
  }

  const header = rowsOf('header').map((node) => row(node))
  const footer = rowsOf('footer').map((node) => row(node))
  // Padding takes 2 rows; a blank row parts the header and the footer from the sections.
  const headerGap = header.length > 0 && sections.length > 0
  const free = input.bodyRows - 2 - header.length - footer.length - (headerGap ? 1 : 0) - (footer.length ? 1 : 0)
  const { rows, maxScroll } = scrollWindow(sections, Math.max(free, 0), input.scroll, (text) => (
    <Box height={1} flexShrink={0} justifyContent="flex-end">
      <Text color={c.muted}>{text}</Text>
    </Box>
  ))

  const tree = (
    // One flat color on the root covers every body cell, padding included.
    <Box
      flexDirection="column"
      height={input.bodyRows}
      paddingX={2}
      paddingY={1}
      {...(input.background && { backgroundColor: input.background })}
    >
      {header}
      {headerGap ? row('') : null}
      {rows}
      <Box flexGrow={1} />
      {footer}
    </Box>
  )
  return { tree, maxScroll }
}

// A scroll stop of the sections window: its nodes and their height in rows,
// a row's 1 plus any spacers' fractions.
export type Stop<T> = { nodes: readonly T[]; height: number }

// Slices `stops` to `free` rows from stop `offset`, summing their heights,
// with `↑ more` / `↓ more` rows (1 row each) where stops are hidden. At the
// last offset only `↑ more` shows.
export function scrollWindow<T>(
  stops: readonly Stop<T>[],
  free: number,
  offset: number,
  more: (text: string) => T,
): { rows: T[]; maxScroll: number } {
  // Spacer fractions sum with float error: 14 rows can add up to 14.000000000000002.
  const fits = (height: number, room: number) => height <= room + 1e-9
  const heightFrom = (start: number) => stops.slice(start).reduce((sum, stop) => sum + stop.height, 0)
  const nodes = (from: readonly Stop<T>[]) => from.flatMap((stop) => stop.nodes)
  if (fits(heightFrom(0), free)) return { rows: nodes(stops), maxScroll: 0 }
  if (free < 2) return { rows: free ? [more('↓ more')] : [], maxScroll: 0 }
  // The last offset: the first whose rest fits under `↑ more`.
  let maxScroll = stops.length
  while (maxScroll > 1 && fits(heightFrom(maxScroll - 1), free - 1)) maxScroll--
  const start = Math.min(Math.max(offset, 0), maxScroll)
  // The index of the first stop past `room` rows from `start`.
  const fitEnd = (room: number) => {
    let index = start
    let used = 0
    for (const stop of stops.slice(start)) {
      if (!fits(used + stop.height, room)) break
      used += stop.height
      index++
    }
    return index
  }
  const room = free - (start > 0 ? 1 : 0)
  const below = fitEnd(room) < stops.length
  return {
    rows: [
      ...(start > 0 ? [more('↑ more')] : []),
      ...nodes(stops.slice(start, fitEnd(below ? room - 1 : room))),
      ...(below ? [more('↓ more')] : []),
    ],
    maxScroll,
  }
}
