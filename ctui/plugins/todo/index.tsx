import type { ElementTable } from 'claude-code'

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

// PROTOTYPE (prototype/todo-icons): Nerd Font icon sets, one sample list each.
const ARCS = ['\uee06', '\uee07', '\uee08', '\uee09', '\uee0a', '\uee0b']
const SLICES = ['\u{f0a9e}', '\u{f0a9f}', '\u{f0aa0}', '\u{f0aa1}', '\u{f0aa2}', '\u{f0aa3}', '\u{f0aa4}', '\u{f0aa5}']
const SETS: { label: string; done: string; waiting: string; frames: string[]; ms: number }[] = [
  { label: 'N1 Font Awesome', done: '\uf00c', waiting: '\uf10c', frames: ARCS, ms: 100 },
  { label: 'N2 Material circles', done: '\u{f0133}', waiting: '\u{f0130}', frames: SLICES, ms: 100 },
  { label: 'N3 Codicons', done: '\ueba4', waiting: '\uebb5', frames: ARCS, ms: 100 },
]
const SAMPLE: { status: TodoItem['status']; text: string }[] = [
  { status: 'completed', text: 'Read the spec' },
  { status: 'in_progress', text: 'Writing tests' },
  { status: 'pending', text: 'Run the live checks' },
  { status: 'pending', text: 'Open the pull request' },
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
    // PROTOTYPE: the sets draw whatever the list holds.
    // Your real tasks when there are any, else the sample list.
    const items = todo && todo.tools !== 'none' && todo.items.length
      ? todo.items.map((item) => ({ status: item.status, text: textOf(item) }))
      : SAMPLE
    if (SETS.length) return SETS.flatMap((set) => [
      <Text color={c.faint} wrap="truncate-end">
        {set.label}
      </Text>,
      ...items.map(({ status, text }) =>
        status === 'in_progress' ? (
          <Box flexDirection="row">
            <Box width={1} flexShrink={0}>
              <Client
                key={`spinner-${set.label}`}
                module="./spinner.tsx"
                props={{ frames: set.frames, ms: set.ms, color: c.warning }}
              />
            </Box>
            <Text color={c.main} wrap="truncate-end">
              {' '}
              {text}
            </Text>
          </Box>
        ) : (
          <Text wrap="truncate-end">
            <Text color={status === 'completed' ? c.muted : c.faint}>
              {status === 'completed' ? set.done : set.waiting}
            </Text>{' '}
            <Text color={c.muted}>{text}</Text>
          </Text>
        ),
      ),
    ])
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
