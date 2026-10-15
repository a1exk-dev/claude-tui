import type { RenderElement, RenderNode } from 'claude-code'

import type { Colors, Role } from './colors'
import type { SidebarUi } from './plugin'

// The Sidebar's shared circle vocabulary (`docs/spec/sidebar-icons.md`): one
// rounded Material Design mark per state, drawn from the person's JetBrains
// Mono Nerd Font. A mark carries its codepoint *and* its colour role together,
// so a mark two sections draw cannot take two colours. Each section maps its
// own states onto these marks; none of that mapping lives here.
export type Mark = { glyph: string; role: Role }

// Every static mark in the spec's table, by its `nf-md-` name.
export const MARKS = {
  checkbox_marked_circle: { glyph: '\u{f0133}', role: 'success' },
  checkbox_blank_circle_outline: { glyph: '\u{f0130}', role: 'faint' },
  check_circle_outline: { glyph: '\u{f05e1}', role: 'success' },
  alert_circle: { glyph: '\u{f0028}', role: 'warning' },
  radiobox_marked: { glyph: '\u{f043e}', role: 'warning' },
  close_circle: { glyph: '\u{f0159}', role: 'error' },
  minus_circle_outline: { glyph: '\u{f0377}', role: 'faint' },
  asterisk_circle_outline: { glyph: '\u{f1a27}', role: 'muted' },
} as const satisfies Record<string, Mark>

// The working row's sweep, nf-md-circle_slice_1 to 8 (a circle filling up),
// one frame every `ms`. Motion is the one exception to "one glyph, one
// colour": the sweep takes its row's own role, so it carries none here.
export const SWEEP = { frames: Array.from({ length: 8 }, (_, i) => String.fromCodePoint(0xf0a9e + i)), ms: 100 }

// The frozen sweep frame a fold line's working term draws, nf-md-circle_slice_6
// (MEMORY.md: a fold line never animates). Part-filled is the shape no static
// state uses, so it reads as "working" wherever it appears; its role is the
// section's own call.
export const working = (role: Role): Mark => ({ glyph: SWEEP.frames[5]!, role })

// Two spaces follow every row glyph: the engine counts the glyph as one cell,
// the terminal draws it two cells wide, so the first space takes the overflow
// and the second shows as the gap (MEMORY.md "A Nerd Font icon takes two
// spaces after it").
export const GAP = '  '

// A row's lead: its mark in the mark's role, then the gap. The caller's `Text`
// follows with the row's own text.
export const lead = (Text: SidebarUi['Text'], { glyph, role }: Mark, c: Colors): RenderNode[] => [
  <Text color={c[role]}>{glyph}</Text>,
  GAP,
]

// One term of a fold line's tally: a state's mark and how many rows are in it.
export type Term = { mark: Mark; count: number }

// A fold line's tally: each term's mark, two spaces, its count, two spaces
// between terms, every term in its mark's own role. Terms with no rows are
// left out, so the terms still sum to the section's count; nothing to tally
// draws nothing, and the section says what it says when empty.
export const tally = (Text: SidebarUi['Text'], terms: readonly Term[], c: Colors): RenderElement | undefined => {
  const drawn = terms.filter((term) => term.count > 0)
  if (!drawn.length) return undefined
  return (
    <Text>
      {drawn.flatMap(({ mark, count }, index) => [
        ...(index ? [GAP] : []),
        <Text color={c[mark.role]}>
          {mark.glyph}
          {GAP}
          {count}
        </Text>,
      ])}
    </Text>
  )
}
