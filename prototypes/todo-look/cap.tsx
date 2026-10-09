// PROTOTYPE — throwaway (map "ctui 0.5.0 Todo list", ticket "How should the
// Todo section look?"). Question 3: how is a long list capped?
// Chosen so far: row style A (today's); done rows stay in Claude's order.
// Four caps drawn stacked over one 9-task sample, each under a label. The
// `▸ N more` rows here are static text, not the real toggle.
import type { RenderNode } from 'claude-code'

import type { TodoItem } from '../../types'
import type { Colors } from '../colors'
import type { SidebarPlugin } from '../plugin'

const SAMPLE: TodoItem[] = [
  { subject: 'Read the calculator module', status: 'completed' },
  { subject: 'Add power function', status: 'completed' },
  { subject: 'Add modulo function', status: 'completed' },
  { subject: 'Raise ValueError on modulo by zero', status: 'completed' },
  { subject: 'Write tests for power and modulo', activeForm: 'Writing tests for power and modulo', status: 'in_progress' },
  { subject: 'Add a CLI flag for each operation', status: 'pending' },
  { subject: 'Update README', status: 'pending' },
  { subject: 'Update the changelog', status: 'pending' },
  { subject: 'Run the full test suite', status: 'pending' },
]

const textOf = (item: TodoItem) => (item.status === 'in_progress' ? (item.activeForm ?? item.subject) : item.subject)

const STATUSES = {
  completed: ['✓', 'muted', 'muted'],
  in_progress: ['◐', 'warning', 'main'],
  pending: ['○', 'faint', 'muted'],
} as const

const row = (item: TodoItem, Text: any, c: Colors): RenderNode => {
  const [glyph, role, textRole] = STATUSES[item.status]
  return (
    <Text wrap="truncate-end">
      <Text color={c[role]}>{glyph}</Text> <Text color={c[textRole]}>{textOf(item)}</Text>
    </Text>
  )
}

const more = (n: number, Text: any, c: Colors, label = `▸ ${n} more`) => (
  <Text color={c.muted} wrap="truncate-end">
    {label}
  </Text>
)

type Variant = (Text: any, c: Colors) => RenderNode[]

// A — today: the first 4 rows, then `▸ N more`.
const A: Variant = (Text, c) => [...SAMPLE.slice(0, 4).map((item) => row(item, Text, c)), more(SAMPLE.length - 4, Text, c)]

// B — 4 rows around the current task (1 before, 2 after), with what's hidden
// counted above and below.
const current = SAMPLE.findIndex((item) => item.status === 'in_progress')
const start = Math.max(0, Math.min(current - 1, SAMPLE.length - 4))
const B: Variant = (Text, c) => [
  ...(start ? [more(start, Text, c, `▴ ${start} more`)] : []),
  ...SAMPLE.slice(start, start + 4).map((item) => row(item, Text, c)),
  ...(SAMPLE.length > start + 4 ? [more(SAMPLE.length - start - 4, Text, c)] : []),
]

// C — no cap: every row.
const C: Variant = (Text, c) => SAMPLE.map((item) => row(item, Text, c))

// D — a cap of 8, then `▸ N more`.
const D: Variant = (Text, c) => [...SAMPLE.slice(0, 8).map((item) => row(item, Text, c)), more(SAMPLE.length - 8, Text, c)]

const VARIANTS: [string, Variant][] = [
  ['A · first 4 (today)', A],
  ['B · 4 around the current task', B],
  ['C · no cap', C],
  ['D · first 8', D],
]

const plugin: SidebarPlugin = {
  id: 'todo',
  title: 'Todo',
  slot: 'section',
  needs: ['todo'],
  view: (_data, { Text }, _cfg, _width, c) =>
    VARIANTS.flatMap(([label, variant], i) => [
      ...(i ? [<Text> </Text>] : []),
      <Text color={c.accent} bold>
        {label}
      </Text>,
      ...variant(Text, c),
    ]),
  count: () => '4/9',
  summary: () => '4/9 · Writing tests for power and modulo',
}

export default plugin
