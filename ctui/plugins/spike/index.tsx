import type { Role } from '../colors'
import type { SidebarPlugin } from '../plugin'

// THROWAWAY SPIKE for #305: the circle set across all four Sidebar sections,
// with the motions and weights the human is choosing between. Delete with `git checkout ctui/plugins ctui/.claude-plugin/plugin.json`
// and `rm -rf ctui/plugins/spike`.

// Each animation's frames and frame time. All are circle-enclosed. A terminal
// draws glyphs and cannot turn one, so a rotation has to be a sequence the
// font already holds at each angle.
const seq = (...codes: number[]) => codes.map((code) => String.fromCodePoint(code))
const MOTIONS = {
  // nf-md-arrow_*_thin_circle_outline, the 8 compass points: an arrow turning
  // clockwise inside a ring.
  rotate8: { frames: seq(0xf1597, 0xf1594, 0xf1598, 0xf1595, 0xf1599, 0xf1596, 0xf159a, 0xf1593), ms: 100 },
  // nf-md-arrow_*_bold_circle, the only 4 the font has filled: the same turn
  // on the filled weight, in 90 degree steps.
  rotate4: { frames: seq(0xf005f, 0xf0056, 0xf0047, 0xf004f), ms: 150 },
  // nf-md-refresh_circle and sync_circle, the font's two circular-arrow
  // discs: the still icon flipping between the two arrow sets it has.
  sync2: { frames: seq(0xf1377, 0xf1378), ms: 300 },
  // nf-md-circle_slice_1..8, the Todo spinner: a disc filling up.
  slice: { frames: seq(...Array.from({ length: 8 }, (_, i) => 0xf0a9e + i)), ms: 100 },
  // nf-md-clock_time_one..twelve: a hand sweeping a clock face.
  clock: { frames: seq(...Array.from({ length: 12 }, (_, i) => 0xf143f + i)), ms: 90 },
}

type Row = { glyph: string | keyof typeof MOTIONS; role: Role; label: string }

// A connecting server's blink: the glyph holds still and its colour steps
// through the theme's text weights, since a terminal cell has no alpha.
type Blink = { frames: string[]; ms: number; colors: (c: Record<Role, string>) => string[] }
const RADIO = '\u{f043e}'
const BLINKS: Record<string, Blink> = {
  blink: { frames: [RADIO], ms: 500, colors: (c) => [c.warning, c.faint] },
  fade: { frames: [RADIO], ms: 220, colors: (c) => [c.warning, c.muted, c.faint, c.muted] },
  core: { frames: [RADIO, '\u{f043d}'], ms: 500, colors: (c) => [c.warning, c.warning] },
  gone: { frames: [RADIO, ' '], ms: 500, colors: (c) => [c.warning, c.warning] },
}

const HEAD = (label: string): Row => ({ glyph: '', role: 'accent', label })

// The set #302 proposed: one circle per state, all four sections.
const CIRCLES: Row[] = [
  HEAD('the chosen set'),
  { glyph: '\u{f0133}', role: 'muted', label: 'todo completed' },
  { glyph: 'slice', role: 'warning', label: 'todo in progress' },
  { glyph: '\u{f0130}', role: 'faint', label: 'todo pending' },
  { glyph: '\u{f05e1}', role: 'success', label: 'mcp ok' },
  { glyph: '\u{f0028}', role: 'warning', label: 'mcp needs auth' },
  { glyph: 'core', role: 'warning', label: 'mcp connecting' },
  { glyph: '\u{f0159}', role: 'error', label: 'mcp down' },
  { glyph: '\u{f0377}', role: 'faint', label: 'mcp off' },
  { glyph: 'slice', role: 'warning', label: 'agents running' },
  { glyph: '\u{f0133}', role: 'success', label: 'agents completed' },
  { glyph: '\u{f0159}', role: 'error', label: 'agents failed' },
  { glyph: '\u{f1978}', role: 'main', label: 'agents workflow kind' },
  { glyph: '\u{f1a27}', role: 'muted', label: 'skills at rest' },
  { glyph: 'slice', role: 'warning', label: 'skills working' },
]

// An agents row that is running, each motion at the row's own colour.
const plugin: SidebarPlugin = {
  id: 'spike',
  title: 'Spike 305',
  slot: 'section',
  needs: [],
  list: true,
  cap: 99,
  view: (_data, { Box, Text, Client }, _cfg, _width, c) =>
    [...CIRCLES].map((row, index) => {
      if (!row.glyph)
        return (
          <Text color={c.accent} wrap="truncate-end">
            {row.label}
          </Text>
        )
      const blink = BLINKS[row.glyph]
      const motion = blink ? { frames: blink.frames, ms: blink.ms, colors: blink.colors(c) } : MOTIONS[row.glyph as keyof typeof MOTIONS]
      // A motion turns on its own surface clock, so the Sidebar doesn't redraw.
      if (motion)
        return (
          <Box flexDirection="row">
            <Box width={1} flexShrink={0}>
              <Client key={`spike-${index}`} module="./spinner.tsx" props={{ ...motion, color: c[row.role] }} />
            </Box>
            <Text color={c.main} wrap="truncate-end">
              {' '}
              {row.label}
            </Text>
          </Box>
        )
      return (
        <Text wrap="truncate-end">
          <Text color={c[row.role]}>{row.glyph}</Text> <Text color={c.main}>{row.label}</Text>
        </Text>
      )
    }),
  count: () => '305',
}

export default plugin
