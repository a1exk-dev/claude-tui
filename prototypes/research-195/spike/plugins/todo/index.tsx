import type { Todo, TodoItem } from '../../types'
import type { Role } from '../colors'
import type { SidebarPlugin } from '../plugin'

// Each status's glyph and its role, and the role of the item's text.
const STATUSES: Record<TodoItem['status'], { glyph: string; role: Role; textRole: Role }> = {
  completed: { glyph: '✓', role: 'muted', textRole: 'muted' },
  in_progress: { glyph: '◐', role: 'warning', textRole: 'main' },
  pending: { glyph: '○', role: 'faint', textRole: 'muted' },
}

const textOf = (item: TodoItem) => (item.status === 'in_progress' ? (item.activeForm ?? item.subject) : item.subject)

// `<completed>/<total>`; nothing before the list loads or without task tools.
const done = (todo?: Todo) =>
  todo && todo.tools !== 'none'
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
  view: ({ todo }, { Text }, cfg, _width, c) => {
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
    return todo.items.map((item) => {
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
