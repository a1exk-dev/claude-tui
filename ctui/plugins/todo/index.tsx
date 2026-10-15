import type { Todo, TodoItem } from '../../types'
import type { Role } from '../colors'
import { frozenSweep, lead, type Mark, MARKS, SWEEP_ROLE, sweeping, tally } from '../marks'
import type { SidebarPlugin } from '../plugin'

// A done or waiting item's mark from the Sidebar's shared circle vocabulary
// (`plugins/marks.tsx`), and the role of its text.
const STATUSES: Record<Exclude<TodoItem['status'], 'in_progress'>, { mark: Mark; textRole: Role }> = {
  completed: { mark: MARKS.checkbox_marked_circle, textRole: 'muted' },
  pending: { mark: MARKS.checkbox_blank_circle_outline, textRole: 'muted' },
}

const textOf = (item: TodoItem) => (item.status === 'in_progress' ? (item.activeForm ?? item.subject) : item.subject)

// The list once it has loaded, is not empty and the session has task tools.
const listed = (todo?: Todo) => (todo && todo.tools !== 'none' && todo.items.length > 0 ? todo.items : undefined)

// `<completed>/<total>`; nothing before the list loads, while it is empty or
// without task tools.
const done = (todo?: Todo) => {
  const items = listed(todo)
  return items && `${items.filter((item) => item.status === 'completed').length}/${items.length}`
}

// Claude's task list in list order (MEMORY.md "The `todo` Sidebar plugin turns
// the task tools on by default"). With no task tools, a hint to turn them on.
const plugin: SidebarPlugin = {
  id: 'todo',
  title: 'Todo',
  slot: 'section',
  needs: ['todo'],
  list: true,
  cap: 8, // a typical plan shows whole (#209)
  view: ({ todo }, ui, cfg, _width, c) => {
    const { Box, Text } = ui
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
    return todo.items.map((item, index) => {
      // The item in progress sweeps, the shared motion lead (`plugins/marks.tsx`).
      if (item.status === 'in_progress')
        return <Box flexDirection="row">{sweeping(ui, `spinner-${item.id ?? index}`, textOf(item), c, SWEEP_ROLE)}</Box>
      const { mark, textRole } = STATUSES[item.status]
      return (
        <Text wrap="truncate-end">
          {lead(Text, mark, c)}
          <Text color={c[textRole]}>{textOf(item)}</Text>
        </Text>
      )
    })
  },
  count: ({ todo }) => done(todo),
  // Folded, how much is done rather than what is happening: a tally of the
  // three states, its in-progress term the frozen sweep (a fold line never
  // animates).
  summary: ({ todo }, { Text }, _cfg, _width, c) => {
    const items = listed(todo)
    if (!items) return undefined
    const count = (status: TodoItem['status']) => items.filter((item) => item.status === status).length
    return tally(
      Text,
      [
        { mark: STATUSES.completed.mark, count: count('completed') },
        { mark: frozenSweep(SWEEP_ROLE), count: count('in_progress') },
        { mark: STATUSES.pending.mark, count: count('pending') },
      ],
      c,
    )
  },
}

export default plugin
