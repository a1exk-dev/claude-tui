import type { Role } from '../colors'
import type { SidebarPlugin } from '../plugin'

// THROWAWAY SPIKE for #307: the motion is settled (the sweep, in the row's own
// colour, only where something is in progress). This is the several-at-once
// question: the same busy session with every in-progress row moving, then with
// a cap on how many may move. Delete with
// `git checkout ctui/plugins ctui/.claude-plugin/plugin.json` and
// `rm -rf ctui/plugins/spike`.

const seq = (...codes: number[]) => codes.map((code) => String.fromCodePoint(code))

// nf-md-circle_slice_1..8, Todo's sweep: a disc filling up.
const SLICE = seq(...Array.from({ length: 8 }, (_, i) => 0xf0a9e + i))

// One row of the scene: in progress (it sweeps) or at rest (its own glyph).
type Row = { key: string; busy: boolean; glyph: string; role: Role; label: string; right: string }

// A plausible loaded session: a task in progress, two subagents running, four
// MCP servers with calls in flight, and the rows around them at rest. Seven
// rows want to move at once.
const SCENE: Row[] = [
  { key: 'todo-1', busy: true, glyph: '\u{f0130}', role: 'warning', label: 'writing the spec', right: '' },
  { key: 'todo-2', busy: false, glyph: '\u{f0133}', role: 'muted', label: 'pick the glyphs', right: '' },
  { key: 'mcp-1', busy: true, glyph: '\u{f05e1}', role: 'success', label: 'linear', right: 'plugin · 23 tools' },
  { key: 'mcp-2', busy: true, glyph: '\u{f05e1}', role: 'success', label: 'playwright', right: 'user · 31 tools' },
  { key: 'mcp-3', busy: true, glyph: '\u{f0159}', role: 'error', label: 'github', right: 'user · down' },
  { key: 'mcp-4', busy: true, glyph: '\u{f0028}', role: 'warning', label: 'sentry', right: 'user · needs auth' },
  { key: 'mcp-5', busy: false, glyph: '\u{f0377}', role: 'faint', label: 'figma', right: 'user · off' },
  { key: 'agent-1', busy: true, glyph: '\u{f0133}', role: 'warning', label: 'review: bugs', right: 'opus' },
  { key: 'agent-2', busy: true, glyph: '\u{f0133}', role: 'warning', label: 'review: spec', right: 'sonnet' },
  { key: 'agent-3', busy: false, glyph: '\u{f0133}', role: 'success', label: 'research: fonts', right: 'done' },
]

// With a cap of 3, the first three in-progress rows move and the rest hold a
// still glyph, so the Sidebar never has more than three moving marks.
const CAP = 3

const plugin: SidebarPlugin = {
  id: 'spike',
  title: 'Spike 307',
  slot: 'section',
  needs: [],
  list: true,
  cap: 99,
  view: (_data, { Box, Text, Client }, _cfg, _width, c) => {
    const head = (text: string) => (
      <Text color={c.accent} wrap="truncate-end">
        {text}
      </Text>
    )
    const right = (text: string) =>
      text ? (
        <Box flexShrink={0}>
          <Text color={c.muted}>{text}</Text>
        </Box>
      ) : undefined
    const still = (row: Row, key: string) => (
      <Box flexGrow={1} justifyContent="space-between" columnGap={1}>
        <Text color={c.main} wrap="truncate-end">
          <Text color={c[row.role]}>{row.glyph}</Text> {row.label}
        </Text>
        {right(row.right)}
      </Box>
    )
    // Each moving glyph turns on its own surface clock, started when its
    // Client mounts, so the Sidebar doesn't redraw and no two rows share a phase.
    const moving = (row: Row, key: string) => (
      <Box flexGrow={1} justifyContent="space-between" columnGap={1}>
        <Box flexDirection="row">
          <Box width={1} flexShrink={0}>
            <Client key={key} module="./spinner.tsx" props={{ frames: SLICE, ms: 100, color: c[row.role], colors: [c[row.role]] }} />
          </Box>
          <Text color={c.main} wrap="truncate-end">
            {' '}
            {row.label}
          </Text>
        </Box>
        {right(row.right)}
      </Box>
    )
    const scene = (prefix: string, cap: number) => {
      let moved = 0
      return SCENE.map((row) => {
        const move = row.busy && moved < cap
        if (move) moved += 1
        return move ? moving(row, `spike-${prefix}-${row.key}`) : still(row, `spike-${prefix}-${row.key}`)
      })
    }
    return [
      head('1 · every in-progress row moves (7 of 10)'),
      ...scene('all', SCENE.length),
      head(`2 · at most ${CAP} move, the rest hold still`),
      ...scene('cap', CAP),
    ]
  },
  count: () => '307',
}

export default plugin
