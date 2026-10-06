import { formatElapsed } from '../../hooks/format'
import type { Task } from '../../types'
import type { SidebarPlugin } from '../plugin'

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

const running = (tasks: Record<string, Task> = {}) =>
  Object.values(tasks).filter((task) => task.status === 'running').length

// Running subagents, background shells and Workflow runs as a tree, and ended
// rows until the tick drops them (MEMORY.md "Agent and shell events go to
// toasts, the live list goes to the sidebar").
const plugin: SidebarPlugin = {
  id: 'agents',
  title: 'Agents & shells',
  slot: 'section',
  needs: ['tasks', 'now'],
  list: true,
  view: ({ tasks = {}, now }, { Box, Text }) => {
    const rows = tree(tasks)
    if (!rows.length) {
      return [
        <Text dimColor wrap="truncate-end">
          nothing running
        </Text>,
      ]
    }
    return rows.map(({ task, depth }) => {
      const ended = task.status !== 'running'
      const [glyph, color] = !ended ? ['◐', 'warning'] : task.status === 'completed' ? ['✓', 'success'] : ['✗', 'error']
      // A failure shows its reason; a kill or another engine word shows that word.
      const why = task.status === 'failed' ? task.reason : task.status === 'completed' ? undefined : task.status
      const name =
        task.kind === 'shell' ? (
          `$ ${task.label}`
        ) : task.kind === 'workflow' ? (
          `⚙ ${task.label} workflow`
        ) : (
          <Text>
            {task.type}
            <Text dimColor> · {task.label}</Text>
          </Text>
        )
      return (
        <Box flexGrow={1} justifyContent="space-between" paddingLeft={depth ? 2 * depth : 0}>
          <Text wrap="truncate-end">
            {depth ? <Text dimColor>└ </Text> : null}
            <Text color={color}>{glyph}</Text> {name}
            {ended && why ? <Text dimColor> · {why}</Text> : null}
          </Text>
          <Text dimColor>{formatElapsed((task.endedAt ?? now ?? task.startedAt) - task.startedAt)}</Text>
        </Box>
      )
    })
  },
  count: ({ tasks }) => `${running(tasks)} running`,
  summary: ({ tasks }, { Text }) => {
    const n = running(tasks)
    if (!n) return 'nothing running'
    return (
      <Text dimColor>
        <Text color="warning">◐</Text> {n} running
      </Text>
    )
  },
}

export default plugin
