import type { McpRow } from '../../types'
import type { Role } from '../colors'
import type { SidebarPlugin } from '../plugin'

// Each state's glyph and its role, and the text at the right and its role, in
// the folded summary's order.
type State = { glyph: string; role: Role; text: (row: McpRow) => string; textRole: Role }
const STATES: Record<McpRow['state'], State> = {
  ok: {
    glyph: '●',
    role: 'success',
    text: ({ tools = 0 }) => `${tools} ${tools === 1 ? 'tool' : 'tools'}`,
    textRole: 'muted',
  },
  auth: { glyph: '!', role: 'warning', text: () => 'needs auth', textRole: 'warning' },
  connecting: { glyph: '◐', role: 'warning', text: () => 'connecting', textRole: 'warning' },
  down: { glyph: '✕', role: 'error', text: () => 'down', textRole: 'error' },
  off: { glyph: '○', role: 'faint', text: () => 'off', textRole: 'muted' },
}
const ORDER = Object.keys(STATES) as McpRow['state'][]

// First-seen order with off rows last.
const shown = (rows: readonly McpRow[]) => [...rows].sort((a, b) => +(a.state === 'off') - +(b.state === 'off'))

// The MCP servers seen with tools this session plus disabled ones, each with its state.
const plugin: SidebarPlugin = {
  id: 'mcp',
  title: 'MCP',
  slot: 'section',
  needs: ['mcp'],
  list: true,
  view: ({ mcp = [] }, { Box, Text }, _cfg, _width, c) =>
    shown(mcp).map((row) => {
      const { glyph, role, text, textRole } = STATES[row.state]
      return (
        <Box flexGrow={1} justifyContent="space-between" columnGap={1}>
          <Text color={c.main} wrap="truncate-end">
            <Text color={c[role]}>{glyph}</Text> {row.label}
          </Text>
          <Box flexShrink={0}>
            <Text color={c[textRole]}>{text(row)}</Text>
          </Box>
        </Box>
      )
    }),
  count: ({ mcp = [] }) => `${mcp.filter((row) => row.state === 'ok').length}/${mcp.length}`,
  summary: ({ mcp = [] }, { Text }, _cfg, _width, c) => {
    const counts = ORDER.flatMap((state) => {
      const count = mcp.filter((row) => row.state === state).length
      return count ? [{ state, count }] : []
    })
    if (!counts.length) return undefined
    return (
      <Text>
        {counts.map(({ state, count }, index) => (
          <Text color={c[STATES[state].role]}>
            {index ? ' ' : ''}
            {STATES[state].glyph} {count}
          </Text>
        ))}
      </Text>
    )
  },
}

export default plugin
