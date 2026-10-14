// Pure. The task model's text: task-notification parsing, failure reasons,
// toast texts and the toast queue's order (MEMORY.md "Agent and shell events
// go to toasts, the live list goes to the sidebar").

import type { Task } from '../types'
import { formatElapsed } from './format'

export type TaskNotification = {
  id: string
  status: string // an open word: completed, failed, killed, ...
  summary?: string
  exitCode?: number
}

const tag = (text: string, name: string) => new RegExp(`<${name}>([\\s\\S]*?)</${name}>`).exec(text)?.[1]?.trim()

// The `<task-notification>` block Claude Code writes when a background task
// ends, as checked on 2.1.288 (#13, #14, #15): engine text, not typed API, so
// recheck it on a version bump. Without a task id and a status it's not one.
export function parseTaskNotification(text: string): TaskNotification | undefined {
  const id = tag(text, 'task-id')
  const status = tag(text, 'status')
  if (!id || !status) return undefined
  const summary = tag(text, 'summary')
  const exitCode = summary && /exit code (\d+)/.exec(summary)?.[1]
  return { id, status, ...(summary && { summary }), ...(exitCode && { exitCode: Number(exitCode) }) }
}

const REASONS: Record<string, string> = {
  model_not_found: 'model not found',
  rate_limit: 'rate limited',
  overloaded: 'API overloaded',
  authentication_failed: 'auth failed',
  billing_error: 'billing',
  max_output_tokens: 'output limit',
}

// A `classic.StopFailure` error word as a short phrase (the map decision for #13).
export const failureReason = (error: string) => REASONS[error] ?? error.replaceAll('_', ' ')

// A failed notification's reason: an agent's API error cut at its first
// period, or a shell's exit code.
export function notificationReason(note: TaskNotification): string | undefined {
  const api = note.summary && /API error: ([^.]+)/.exec(note.summary)?.[1]?.trim()
  return api || (note.exitCode !== undefined ? `exit code ${note.exitCode}` : undefined)
}

// One line: a toast draws `\n` as `�`.
const line = (text: string) => text.replace(/\s*\n\s*/g, ' ')

export const firstLine = (text: string) => text.trim().split('\n')[0] ?? ''

export const toastText = {
  started: (task: Task) =>
    line(
      task.kind === 'shell'
        ? `$ ${task.label} started in background`
        : task.kind === 'workflow'
          ? `◆ workflow started: ${task.label}`
          : `◆ ${task.type} started: ${task.label}`,
    ),
  ended: (task: Task) =>
    line(
      task.status === 'completed'
        ? `✓ ${task.type} done · ${task.label} · ${formatElapsed((task.endedAt ?? task.startedAt) - task.startedAt)}`
        : task.status === 'failed'
          ? `✗ ${task.type} failed${task.reason ? `: ${task.reason}` : ''}`
          : `✗ ${task.type} ${task.status}`,
    ),
}

// One toast waiting in the queue; `id` is its task's.
export type Toast = { id: string; end: boolean; text: string }

// Adds a toast: an end goes ahead of the waiting starts and drops its own
// task's waiting start.
export function enqueue(queue: readonly Toast[], toast: Toast): Toast[] {
  if (!toast.end) return [...queue, toast]
  const rest = queue.filter((waiting) => waiting.end || waiting.id !== toast.id)
  const at = rest.findIndex((waiting) => !waiting.end)
  return at < 0 ? [...rest, toast] : [...rest.slice(0, at), toast, ...rest.slice(at)]
}

export const startedToast = (task: Task): Toast => ({ id: task.id, end: false, text: toastText.started(task) })

// Ends a running task and returns its toast. A shell nested under a Workflow
// run raises none, and a run's end removes its shells.
export function endTask(
  tasks: Record<string, Task>,
  task: Task,
  status: string,
  now: number,
  toast: boolean,
): Toast[] {
  const ended: Task = { ...task, status, endedAt: now }
  tasks[task.id] = ended
  if (task.kind === 'workflow') {
    for (const child of Object.values(tasks)) if (child.parent === task.id) delete tasks[child.id]
  }
  const quiet = tasks[task.parent ?? '']?.kind === 'workflow'
  return toast && !quiet ? [{ id: task.id, end: true, text: toastText.ended(ended) }] : []
}

// The list's words that end an agent; any other (`pending`, `waiting` on its
// own background work, `idle`, ...) is live (#246).
const ENDED_STATUSES = new Set(['completed', 'failed', 'killed'])

// Held agents take the list's status when it changes, a live word as running:
// a failed notice can end an agent the list still calls running (#67).
// `completed` isn't final: an agent can run again, but a failure doesn't turn
// into a success. A kill seen here is the person's own from /tasks: no toast.
export function applyAgentList(
  tasks: Record<string, Task>,
  list: readonly { id: string; status: string }[],
  now: number,
): Toast[] {
  const raised: Toast[] = []
  for (const agent of list) {
    const held = tasks[agent.id]
    if (held?.kind !== 'agent' || held.listed === agent.status) continue
    const task: Task = { ...held, listed: agent.status }
    tasks[agent.id] = task
    if (task.status === agent.status) continue
    if (!ENDED_STATUSES.has(agent.status)) {
      if (task.status === 'running') continue
      const { endedAt, reason, ...rest } = task
      tasks[agent.id] = { ...rest, status: 'running' }
    } else if (task.status === 'running') {
      raised.push(...endTask(tasks, task, agent.status, now, agent.status !== 'killed'))
    } else if (task.status !== 'failed') {
      tasks[agent.id] = { ...task, status: agent.status }
    }
  }
  return raised
}

// A notification ends a held shell or Workflow run, and a failed agent. For
// another agent it only gives a failure reason: the agent list is its status.
// A kill (the person's, from /tasks) raises no toast.
export function applyNotification(tasks: Record<string, Task>, note: TaskNotification, now: number): Toast[] {
  const task = tasks[note.id]
  if (!task) return []
  const reason = note.status === 'failed' ? notificationReason(note) : undefined
  if (task.kind === 'agent') {
    const reasoned = reason && !task.reason ? { ...task, reason } : task
    tasks[task.id] = reasoned
    return note.status === 'failed' && task.status === 'running' ? endTask(tasks, reasoned, 'failed', now, true) : []
  }
  if (task.status !== 'running') return []
  const toast = note.status === 'completed' || note.status === 'failed'
  return endTask(tasks, reason ? { ...task, reason } : task, note.status, now, toast)
}

// Ended rows show this long.
export const ENDED_MS = 8000

export function dropEnded(tasks: Record<string, Task>, now: number) {
  for (const task of Object.values(tasks)) {
    if (task.endedAt !== undefined && now - task.endedAt >= ENDED_MS) delete tasks[task.id]
  }
}
