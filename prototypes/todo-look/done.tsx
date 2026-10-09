// PROTOTYPE — throwaway (map "ctui 0.5.0 Todo list", ticket "How should the
// Todo section look?"). Question 2: where do done tasks go?
// Row style A (today's) was chosen in question 1. Four treatments of done
// rows drawn stacked over one fixed sample list, each under a label.
import type { RenderNode } from 'claude-code'

import type { TodoItem } from '../../types'
import type { Colors } from '../colors'
import type { SidebarPlugin } from '../plugin'

const SAMPLE: TodoItem[] = [
  { subject: 'Read the calculator module', status: 'completed' },
  { subject: 'Add power function', status: 'completed' },
  { subject: 'Add modulo function', status: 'completed' },
  { subject: 'Write tests for power and modulo', activeForm: 'Writing tests for power and modulo', status: 'in_progress' },
  { subject: 'Update README', status: 'pending' },
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

const done = SAMPLE.filter((item) => item.status === 'completed')
const open = SAMPLE.filter((item) => item.status !== 'completed')

type Variant = (Text: any, c: Colors) => RenderNode[]

// A — today: every row in Claude's order.
const A: Variant = (Text, c) => SAMPLE.map((item) => row(item, Text, c))

// B — done rows sink below the open ones.
const B: Variant = (Text, c) => [...open, ...done].map((item) => row(item, Text, c))

// C — done rows fold into one `✓ N done` row above the open ones.
const C: Variant = (Text, c) => [
  <Text wrap="truncate-end" color={c.muted}>
    ✓ {done.length} done
  </Text>,
  ...open.map((item) => row(item, Text, c)),
]

// D — done rows hidden; only the header count says how many are done.
const D: Variant = (Text, c) => open.map((item) => row(item, Text, c))

const VARIANTS: [string, Variant][] = [
  ['A · keep, Claude’s order (today)', A],
  ['B · done sink to the bottom', B],
  ['C · done fold into one row', C],
  ['D · done hidden', D],
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
  count: () => '3/6',
  summary: () => '3/6 · Writing tests for power and modulo',
}

export default plugin
