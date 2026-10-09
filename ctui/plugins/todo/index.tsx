import type { Todo, TodoItem } from '../../types'
import type { Role } from '../colors'
import type { SidebarPlugin } from '../plugin'

// A done or waiting item's glyph and its role, and the role of its text.
const STATUSES: Record<Exclude<TodoItem['status'], 'in_progress'>, { glyph: string; role: Role; textRole: Role }> = {
  completed: { glyph: '✓', role: 'muted', textRole: 'muted' },
  pending: { glyph: '⠶', role: 'faint', textRole: 'muted' },
}

// The item in progress's spinner frames, one every `ms` (`spinner.tsx`).
const SPINNER = { frames: ['⠴', '⠦', '⠖', '⠲'], ms: 100 }

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
  cap: 8, // a typical plan shows whole (#209)
  view: ({ todo }, { Box, Text, Client }, cfg, _width, c) => {
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
      // The spinner turns on its own surface, outside the focus ring, so it
      // stays a Client while the Pane is focused.
      if (item.status === 'in_progress')
        return (
          <Box flexDirection="row">
            <Box width={1} flexShrink={0}>
              <Client
                key={`spinner-${item.id ?? index}`}
                module="./spinner.tsx"
                props={{ ...SPINNER, color: c.warning }}
              />
            </Box>
            <Text color={c.main} wrap="truncate-end">
              {' '}
              {textOf(item)}
            </Text>
          </Box>
        )
      const { glyph, role, textRole } = STATUSES[item.status]
      return (
        <Text wrap="truncate-end">
          <Text color={c[role]}>{glyph}</Text> <Text color={c[textRole]}>{textOf(item)}</Text>
        </Text>
      )
    })
  },
  count: ({ todo }) => done(todo),
  summary: ({ todo }) => {
    const count = done(todo)
    const current = todo?.items.find((item) => item.status === 'in_progress')
    return count && current ? `${count} · ${textOf(current)}` : count
  },
}

export default plugin
