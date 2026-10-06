import type { McpRow } from '../../types'
import type { SidebarPlugin } from '../plugin'

// Each state's glyph, color and text, in the folded summary's order.
const STATES: Record<McpRow['state'], { glyph: string; color: string; text: (row: McpRow) => string }> = {
  ok: { glyph: '●', color: 'success', text: ({ tools = 0 }) => `${tools} ${tools === 1 ? 'tool' : 'tools'}` },
  auth: { glyph: '!', color: 'warning', text: () => 'needs auth' },
  connecting: { glyph: '◐', color: 'warning', text: () => 'connecting' },
  down: { glyph: '✕', color: 'error', text: () => 'down' },
  off: { glyph: '○', color: 'inactive', text: () => 'off' },
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
  view: ({ mcp = [] }, { Box, Text }) =>
    shown(mcp).map((row) => {
      const { glyph, color, text } = STATES[row.state]
      return (
        <Box flexGrow={1} justifyContent="space-between">
          <Text wrap="truncate-end">
            <Text color={color}>{glyph}</Text> {row.label}
          </Text>
          <Text {...(row.state === 'ok' ? { dimColor: true } : { color })}>{text(row)}</Text>
        </Box>
      )
    }),
  count: ({ mcp = [] }) => `${mcp.filter((row) => row.state === 'ok').length}/${mcp.length}`,
  summary: ({ mcp = [] }, { Text }) => {
    const counts = ORDER.flatMap((state) => {
      const count = mcp.filter((row) => row.state === state).length
      return count ? [{ state, count }] : []
    })
    if (!counts.length) return undefined
    return (
      <Text>
        {counts.map(({ state, count }, index) => (
          <Text color={STATES[state].color}>
            {index ? ' ' : ''}
            {STATES[state].glyph} {count}
          </Text>
        ))}
      </Text>
    )
  },
}

export default plugin
