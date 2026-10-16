import { formatElapsed } from '../../hooks/format'
import type { Task } from '../../types'
import { frozenSweep, lead, type Mark, MARKS, SWEEP_ROLE, sweeping, tally } from '../marks'
import type { SidebarPlugin } from '../plugin'

// An ended row's mark from the Sidebar's shared circle vocabulary
// (`plugins/marks.tsx`). A row ends `completed`, `failed` or `killed`
// (MEMORY.md "Task ends come from notifications"); every end that is not a
// success draws the one error circle.
const ended = (status: string): Mark => (status === 'completed' ? MARKS.checkbox_marked_circle : MARKS.close_circle)

// Tasks in start order, each followed by the tasks it holds; `depth` counts
// held parents.
function tree(tasks: Record<string, Task>): { task: Task; depth: number }[] {
  const all = Object.values(tasks).sort((a, b) => a.startedAt - b.startedAt)
  const under = (parent: string | undefined, depth: number): { task: Task; depth: number }[] =>
    all
      .filter((task) => (parent === undefined ? !(task.parent && tasks[task.parent]) : task.parent === parent))
      .flatMap((task) => [{ task, depth }, ...under(task.id, depth + 1)])
  return under(undefined, 0)
}

const isRunning = (task: Task) => task.status === 'running'
const isCompleted = (task: Task) => task.status === 'completed'
const running = (tasks: Record<string, Task> = {}) => Object.values(tasks).filter(isRunning).length

// A failure shows its reason; a kill or another engine word shows that word.
const whyOf = (task: Task) =>
  task.status === 'failed' ? task.reason : task.status === 'completed' ? undefined : task.status

// Running subagents, background shells and Workflow runs as a tree, and ended
// rows until the tick drops them (MEMORY.md "Agent and shell events go to
// toasts, the live list goes to the sidebar").
const plugin: SidebarPlugin = {
  id: 'agents',
  title: 'Agents & shells',
  slot: 'section',
  needs: ['tasks', 'now'],
  list: true,
  view: ({ tasks = {}, now }, ui, _cfg, _width, c) => {
    const { Box, Text } = ui
    const rows = tree(tasks)
    if (!rows.length) {
      return [
        <Text color={c.muted} wrap="truncate-end">
          nothing running
        </Text>,
      ]
    }
    return rows.map(({ task, depth }) => {
      const why = whyOf(task)
      // The name at the left, bright and truncating, with an ended row's
      // reason muted after it. A running row leads with the shared sweep
      // (`plugins/marks.tsx`) in place of a still mark.
      const name = isRunning(task)
        ? sweeping(ui, `spinner-${task.id}`, task.label, c, SWEEP_ROLE)
        : [
            <Text color={c.main} wrap="truncate-end">
              {lead(Text, ended(task.status), c)}
              <Text color={c.main}>{task.label}</Text>
              {why ? <Text color={c.muted}> · {why}</Text> : null}
            </Text>,
          ]
      // The kind and the elapsed time muted at the right, in the Box that
      // never shrinks, so a wordy reason gives way before they do. The row's
      // one glyph is spent on state, so what ran is a word here, not a second
      // mark: a subagent says its type, a shell and a Workflow run say what
      // they are.
      return (
        <Box flexGrow={1} justifyContent="space-between" columnGap={1} paddingLeft={depth ? 2 * depth : 0}>
          <Box flexShrink={1} minWidth={0}>
            {depth ? <Text color={c.muted}>└ </Text> : null}
            {name}
          </Box>
          <Box flexShrink={0}>
            <Text color={c.muted}>
              {task.type} · {formatElapsed((task.endedAt ?? now ?? task.startedAt) - task.startedAt)}
            </Text>
          </Box>
        </Box>
      )
    })
  },
  count: ({ tasks }) => `${running(tasks)} running`,
  // Folded, every state the section holds rather than the running ones alone:
  // a tally whose running term is the frozen sweep (a fold line never
  // animates). An empty tree has no terms, so it says what it says empty.
  summary: ({ tasks = {} }, { Text }, _cfg, _width, c) => {
    const all = Object.values(tasks)
    const count = (held: (task: Task) => boolean) => all.filter(held).length
    return (
      tally(
        Text,
        [
          { mark: frozenSweep(SWEEP_ROLE), count: count(isRunning) },
          { mark: MARKS.checkbox_marked_circle, count: count(isCompleted) },
          { mark: MARKS.close_circle, count: count((task) => !isRunning(task) && !isCompleted(task)) },
        ],
        c,
      ) ?? 'nothing running'
    )
  },
}

export default plugin
