import type { Todo, TodoItem } from '../../types'
import type { SidebarPlugin } from '../plugin'

const STATUSES: Record<TodoItem['status'], { glyph: string; color: string }> = {
  completed: { glyph: '✓', color: 'inactive' },
  in_progress: { glyph: '◐', color: 'warning' },
  pending: { glyph: '○', color: 'inactive' },
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
  view: ({ todo }, { Text }, cfg) => {
    if (!todo) return []
    if (todo.tools === 'none') {
      const hints = cfg.tools
        ? ['no task tools in this session']
        : ['no task tools on this model', 'turn on ctui Task tools in /config']
      return hints.map((hint) => (
        <Text dimColor wrap="truncate-end">
          {hint}
        </Text>
      ))
    }
    return todo.items.map((item) => {
      const { glyph, color } = STATUSES[item.status]
      return (
        <Text wrap="truncate-end">
          <Text color={color}>{glyph}</Text>{' '}
          <Text {...(item.status === 'completed' && { dimColor: true })}>{textOf(item)}</Text>
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
