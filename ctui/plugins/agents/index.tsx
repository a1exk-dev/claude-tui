import { formatElapsed } from '../../hooks/format'
import type { Task } from '../../types'
import type { Role } from '../colors'
import { GAP, lead, type Mark, MARKS, SWEEP, tally, working } from '../marks'
import type { SidebarPlugin } from '../plugin'

// An ended row's mark from the Sidebar's shared circle vocabulary
// (`plugins/marks.tsx`). A row ends `completed`, `failed` or `killed`
// (MEMORY.md "Task ends come from notifications"); every end that is not a
// success draws the one error circle.
const ended = (status: string): Mark => (status === 'completed' ? MARKS.checkbox_marked_circle : MARKS.close_circle)

// A running row sweeps in `warning`, its own role, one frame every `SWEEP.ms`
// (`todo/spinner.tsx`); folded, that term freezes at the same role.
const RUNNING: Role = 'warning'

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

// What ran, as one muted word at the right: a subagent says its type, a shell
// and a Workflow run say what they are. The row's one glyph is spent on state
// (`docs/spec/sidebar-icons.md`, "`agents`: no kind glyph at all"), so the
// kind is a word rather than a second mark.
const kindOf = (task: Task) => (task.kind === 'agent' ? task.type : task.kind)

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
  view: ({ tasks = {}, now }, { Box, Text, Client }, _cfg, _width, c) => {
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
      // reason muted after it. A running row's glyph is the sweep, which
      // turns on its own surface, outside the focus ring, so it stays a
      // Client while the Pane is focused: it draws the glyph's cell, and the
      // gap after it leads the text, as `lead` writes it elsewhere.
      const name = isRunning(task)
        ? [
            <Box width={1} flexShrink={0}>
              <Client
                key={`spinner-${task.id}`}
                module="../todo/spinner.tsx"
                props={{ ...SWEEP, color: c[RUNNING] }}
              />
            </Box>,
            <Text color={c.main} wrap="truncate-end">
              {GAP}
              {task.label}
            </Text>,
          ]
        : [
            <Text wrap="truncate-end">
              {lead(Text, ended(task.status), c)}
              <Text color={c.main}>{task.label}</Text>
              {why ? <Text color={c.muted}> · {why}</Text> : null}
            </Text>,
          ]
      // The kind and the elapsed time muted at the right, in the Box that
      // never shrinks, so a wordy reason gives way before they do.
      return (
        <Box flexGrow={1} justifyContent="space-between" columnGap={1} paddingLeft={depth ? 2 * depth : 0}>
          <Box flexShrink={1} minWidth={0}>
            {depth ? <Text color={c.muted}>└ </Text> : null}
            {name}
          </Box>
          <Box flexShrink={0}>
            <Text color={c.muted}>
              {kindOf(task)} · {formatElapsed((task.endedAt ?? now ?? task.startedAt) - task.startedAt)}
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
          { mark: working(RUNNING), count: count(isRunning) },
          { mark: MARKS.checkbox_marked_circle, count: count(isCompleted) },
          { mark: MARKS.close_circle, count: count((task) => !isRunning(task) && !isCompleted(task)) },
        ],
        c,
      ) ?? 'nothing running'
    )
  },
}

export default plugin
