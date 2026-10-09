import type { ElementTable } from 'claude-code'

import type { Todo, TodoItem } from '../../types'
import type { Role } from '../colors'
import type { SidebarPlugin } from '../plugin'

// Each status's glyph and its role, and the role of the item's text.
const STATUSES: Record<TodoItem['status'], { glyph: string; role: Role; textRole: Role }> = {
  completed: { glyph: '✓', role: 'muted', textRole: 'muted' },
  in_progress: { glyph: '◐', role: 'warning', textRole: 'main' },
  pending: { glyph: '○', role: 'faint', textRole: 'muted' },
}

// PROTOTYPE (prototype/todo-spinner): a sample list around the A2 spinner.
const A2 = { frames: ['⠴', '⠦', '⠖', '⠲'], ms: 100 }
const SAMPLE: { status: TodoItem['status']; text: string }[] = [
  { status: 'completed', text: 'Draft the spinner module' },
  { status: 'in_progress', text: 'Running tests' },
  { status: 'pending', text: 'Run the live checks' },
  { status: 'pending', text: 'Open the pull request' },
]
// Candidate roles for the spinner, one sample list each, waiting tasks in P1.
const WAITING = '⠶'
const SPIN_ROLES: { label: string; role: Role }[] = [
  { label: 'C0 warning (now)', role: 'warning' },
  { label: 'C1 accent', role: 'accent' },
  { label: 'C2 main', role: 'main' },
  { label: 'C3 muted', role: 'muted' },
  { label: 'C4 success', role: 'success' },
]

const textOf = (item: TodoItem) => (item.status === 'in_progress' ? (item.activeForm ?? item.subject) : item.subject)

// `<completed>/<total>`; nothing before the list loads, while it is empty or
// without task tools.
const done = (todo?: Todo) =>
  todo && todo.tools !== 'none' && todo.items.length > 0
    ? `${todo.items.filter((item) => item.status === 'completed').length}/${todo.items.length}`
    : undefined

// Claude's task list in list order (MEMORY.md "The `todo` Sidebar plugin turns
// the task tools on by default"). With no task tools, a hint to turn them on.
const plugin: SidebarPlugin = {
  id: 'todo',
  title: 'Todo',
  slot: 'section',
  needs: ['todo'],
  list: true,
  cap: 40, // PROTOTYPE: room for the sample lists; 8 for real (#209)
  view: ({ todo }, ui, cfg, _width, c) => {
    const { Box, Text, Client } = ui as ElementTable<'terminal'>
    // PROTOTYPE: the spinners draw whatever the list holds.
    const demo = SPIN_ROLES.flatMap(({ label, role: spinRole }) => [
      <Text color={c.faint} wrap="truncate-end">
        {label}
      </Text>,
      ...SAMPLE.map(({ status, text }) => {
        const { glyph, role, textRole } = STATUSES[status]
        return status === 'in_progress' ? (
          <Box flexDirection="row">
            <Box width={1} flexShrink={0}>
              <Client key={`spinner-${label}`} module="./spinner.tsx" props={{ ...A2, color: c[spinRole] }} />
            </Box>
            <Text color={c[textRole]} wrap="truncate-end">
              {' '}
              {text}
            </Text>
          </Box>
        ) : (
          <Text wrap="truncate-end">
            <Text color={c[role]}>{status === 'pending' ? WAITING : glyph}</Text>{' '}
            <Text color={c[textRole]}>{text}</Text>
          </Text>
        )
      }),
    ])
    const rows = () => {
      if (!todo) return []
      if (todo.tools === 'none') {
        const hints = cfg.tools
          ? ['no task tools in this session']
          : ['no task tools on this model', 'turn on ctui Task tools in /config']
        return hints.map((hint) => (
          <Text color={c.muted} wrap="truncate-end">
            {hint}
          </Text>
        ))
      }
      if (!todo.items.length)
        return [
          <Text color={c.muted} wrap="truncate-end">
            no tasks yet
          </Text>,
        ]
      return todo.items.map((item) => {
        const { glyph, role, textRole } = STATUSES[item.status]
        return (
          <Text wrap="truncate-end">
            <Text color={c[role]}>{glyph}</Text> <Text color={c[textRole]}>{textOf(item)}</Text>
          </Text>
        )
      })
    }
    return [...demo, ...rows()]
  },
  count: ({ todo }) => done(todo),
  summary: ({ todo }) => {
    const count = done(todo)
    const current = todo?.items.find((item) => item.status === 'in_progress')
    return count && current ? `${count} · ${textOf(current)}` : count
  },
}

export default plugin
