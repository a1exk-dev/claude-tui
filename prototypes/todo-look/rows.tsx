// PROTOTYPE — throwaway (map "ctui 0.5.0 Todo list", ticket "How should the
// Todo section look?"). Question 1: how should a task row look?
// Four row styles drawn stacked in the Todo section over one fixed sample
// list, each under a label, so they compare side by side. Installed by copying
// over ctui/plugins/todo/index.tsx; undo with `git checkout ctui/plugins/todo/index.tsx`.
import type { RenderNode } from 'claude-code'

import type { TodoItem } from '../../types'
import type { Colors } from '../colors'
import type { SidebarPlugin } from '../plugin'

const SAMPLE: TodoItem[] = [
  { subject: 'Add power function', status: 'completed' },
  { subject: 'Add modulo function', status: 'completed' },
  { subject: 'Write tests for power and modulo', activeForm: 'Writing tests for power and modulo', status: 'in_progress' },
  { subject: 'Update README', status: 'pending' },
  { subject: 'Run the full test suite', status: 'pending' },
]

const textOf = (item: TodoItem) => (item.status === 'in_progress' ? (item.activeForm ?? item.subject) : item.subject)

type Row = (item: TodoItem, Text: any, c: Colors) => RenderNode

// A — today (0.4): ✓ / ◐ / ○, only the current row's text in full color.
const A: Row = (item, Text, c) => {
  const s = {
    completed: ['✓', c.muted, c.muted],
    in_progress: ['◐', c.warning, c.main],
    pending: ['○', c.faint, c.muted],
  }[item.status]
  return (
    <Text wrap="truncate-end">
      <Text color={s[1]}>{s[0]}</Text> <Text color={s[2]}>{textOf(item)}</Text>
    </Text>
  )
}

// B — OpenCode: [✓] / [•] / [ ], the current row orange, every other row muted.
const B: Row = (item, Text, c) => {
  const glyph = { completed: '✓', in_progress: '•', pending: ' ' }[item.status]
  const color = item.status === 'in_progress' ? c.warning : c.muted
  return (
    <Text wrap="truncate-end" color={color}>
      [{glyph}] {textOf(item)}
    </Text>
  )
}

// C — Claude Code's own list: ✔ struck through, ■ bold, ◻ plain.
const C: Row = (item, Text, c) => {
  if (item.status === 'completed')
    return (
      <Text wrap="truncate-end">
        <Text color={c.faint}>✔</Text>{' '}
        <Text color={c.faint} strikethrough>
          {textOf(item)}
        </Text>
      </Text>
    )
  if (item.status === 'in_progress')
    return (
      <Text wrap="truncate-end">
        <Text color={c.warning}>■</Text>{' '}
        <Text color={c.main} bold>
          {textOf(item)}
        </Text>
      </Text>
    )
  return (
    <Text wrap="truncate-end">
      <Text color={c.muted}>◻</Text> <Text color={c.main}>{textOf(item)}</Text>
    </Text>
  )
}

// D — no glyphs, color only: done struck and faint, current bold orange, pending plain.
const D: Row = (item, Text, c) => {
  if (item.status === 'completed')
    return (
      <Text wrap="truncate-end" color={c.faint} strikethrough>
        {textOf(item)}
      </Text>
    )
  if (item.status === 'in_progress')
    return (
      <Text wrap="truncate-end" color={c.warning} bold>
        {textOf(item)}
      </Text>
    )
  return (
    <Text wrap="truncate-end" color={c.main}>
      {textOf(item)}
    </Text>
  )
}

const VARIANTS: [string, Row][] = [
  ['A · today (0.4)', A],
  ['B · OpenCode', B],
  ['C · Claude Code’s list', C],
  ['D · no glyphs', D],
]

const plugin: SidebarPlugin = {
  id: 'todo',
  title: 'Todo',
  slot: 'section',
  needs: ['todo'],
  view: (_data, { Text }, _cfg, _width, c) =>
    VARIANTS.flatMap(([label, row], i) => [
      ...(i ? [<Text> </Text>] : []),
      <Text color={c.accent} bold>
        {label}
      </Text>,
      ...SAMPLE.map((item) => row(item, Text, c)),
    ]),
  count: () => '2/5',
  summary: () => '2/5 · Writing tests for power and modulo',
}

export default plugin
