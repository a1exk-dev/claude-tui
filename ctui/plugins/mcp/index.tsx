import type { McpRow } from '../../types'
import type { Role } from '../colors'
import { frozenSweep, lead, type Mark, MARKS, SWEEP_ROLE, sweeping, tally } from '../marks'
import type { SidebarPlugin } from '../plugin'

// Each state's mark from the Sidebar's shared circle vocabulary
// (`plugins/marks.tsx`, `docs/spec/sidebar-icons.md`) — a filled disc wants
// you, a ring is steady, a ring with a core is connecting — and the text at
// the right with its role, in the folded summary's order.
type State = { mark: Mark; text: (row: McpRow) => string; textRole: Role }
const STATES: Record<McpRow['state'], State> = {
  ok: {
    mark: MARKS.check_circle_outline,
    text: ({ tools = 0 }) => `${tools} ${tools === 1 ? 'tool' : 'tools'}`,
    textRole: 'muted',
  },
  auth: { mark: MARKS.alert_circle, text: () => 'needs auth', textRole: 'warning' },
  connecting: { mark: MARKS.radiobox_marked, text: () => 'connecting', textRole: 'warning' },
  down: { mark: MARKS.close_circle, text: () => 'down', textRole: 'error' },
  off: { mark: MARKS.minus_circle_outline, text: () => 'off', textRole: 'muted' },
}
const ORDER = Object.keys(STATES) as McpRow['state'][]

// The MCP servers seen with tools this session plus disabled ones, each with its source and state.
const plugin: SidebarPlugin = {
  id: 'mcp',
  title: 'MCP',
  slot: 'section',
  needs: ['mcp'],
  list: true,
  view: ({ mcp = [] }, ui, _cfg, _width, c) => {
    const { Box, Text } = ui
    return mcp.map((row) => {
      const { mark, text, textRole } = STATES[row.state]
      return (
        <Box flexGrow={1} justifyContent="space-between" columnGap={1}>
          {/* The glyph cell is the row's live cell: while a call to the server
              is in flight the sweep replaces the state's mark, in that state's
              own role, and the state text at the right is untouched. */}
          {row.busy ? (
            <Box flexShrink={1} minWidth={0}>
              {sweeping(ui, `spinner-${row.server}`, row.label, c, mark.role)}
            </Box>
          ) : (
            <Text color={c.main} wrap="truncate-end">
              {lead(Text, mark, c)}
              {row.label}
            </Text>
          )}
          <Box flexShrink={0}>
            <Text color={c.muted}>
              {row.source} · <Text color={c[textRole]}>{text(row)}</Text>
            </Text>
          </Box>
        </Box>
      )
    })
  },
  count: ({ mcp = [] }) => `${mcp.filter((row) => row.state === 'ok').length}/${mcp.length}`,
  // Folded, a tally of the connection states in the same order, each mark
  // then its count; a state with no servers is left out, so the terms sum to
  // the listed servers. The busy term leads, drawing the frozen sweep frame
  // (a fold line never animates) and always in `warning` however the busy
  // servers' own states differ: folded, the term claims only that something is
  // working. A busy server leaves its state term, so the terms still sum.
  summary: ({ mcp = [] }, { Text }, _cfg, _width, c) =>
    tally(
      Text,
      [
        { mark: frozenSweep(SWEEP_ROLE), count: mcp.filter((row) => row.busy).length },
        ...ORDER.map((state) => ({ mark: STATES[state].mark, count: mcp.filter((row) => row.state === state).length })),
      ],
      c,
    ),
}

export default plugin
