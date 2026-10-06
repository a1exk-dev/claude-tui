import type { AgentInfo, On } from 'claude-code'
import { type Engine, expect, mock, test } from 'claude-code/testing'

import agents from '../plugins/agents'
import type { Task } from '../types'

// The `agents` Sidebar plugin and the toasts: the view with sample tasks, and
// scenarios through register.tsx's hooks, from spawns and background shells
// to their ends, kills, /clear and Workflow runs.

const PANE = {
  surface: 'terminal',
  component: 'Pane',
  props: {
    title: 'Sidebar',
    isFocused: false,
    bodyColumns: 42,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

const ROW = /^(└ )?[◐✓✗] /

const task = (fields: Partial<Task> & Pick<Task, 'id'>): Task => ({
  kind: 'agent',
  type: 'Explore',
  label: 'list work dir',
  status: 'running',
  startedAt: 0,
  ...fields,
})

// Draws the view's rows in a test Pane.
async function draw($: Engine, on: On, tasks: Record<string, Task>, now: number) {
  on('ui.render', { component: 'Pane', requestId: 'unit' }, async ($, e) => {
    const ui = $.ui.resolve(e)
    return <ui.Box flexDirection="column">{agents.view({ tasks, now }, ui, { enable: true }, 36)}</ui.Box>
  })
  return $.ui.mount({ ...PANE, plugin: 'test', requestId: 'unit' })
}

const textsOf = async (pane: Awaited<ReturnType<typeof draw>>, text: RegExp) =>
  (await pane.findAll({ type: 'Text', text })).map((found) => found.text)

test('rows: running, nested, shell, workflow and ended, each with its elapsed time', async ($, on) => {
  const tasks = Object.fromEntries(
    [
      task({ id: 'a1', type: 'general-purpose', label: 'audit', startedAt: 0 }),
      task({ id: 'b1', kind: 'shell', type: 'shell', label: 'sleep 40', parent: 'a1', startedAt: 5000 }),
      task({ id: 'w1', kind: 'workflow', type: 'workflow', label: 'review', startedAt: 10_000 }),
      task({ id: 'a2', status: 'completed', startedAt: 20_000, endedAt: 41_000 }),
      task({ id: 'a3', status: 'failed', reason: 'model not found', startedAt: 30_000, endedAt: 31_000 }),
      task({
        id: 'b2',
        kind: 'shell',
        type: 'shell',
        label: 'npm test',
        status: 'killed',
        startedAt: 40_000,
        endedAt: 45_000,
      }),
    ].map((t) => [t.id, t]),
  )
  const pane = await draw($, on, tasks, 75_000)
  expect(await textsOf(pane, ROW)).toEqual([
    '◐ general-purpose · audit',
    '└ ◐ $ sleep 40',
    '◐ ⚙ review workflow',
    '✓ Explore · list work dir',
    '✗ Explore · list work dir · model not found',
    '✗ $ npm test · killed',
  ])
  expect(await textsOf(pane, /^\d+[smh]/)).toEqual(['1m 15s', '1m 10s', '1m 05s', '21s', '1s', '5s'])
  const glyph = async (text: string) =>
    (await pane.findAll({ type: 'Text', text: new RegExp(`^${text}$`) })).map((found) => found.props.color)
  expect(await glyph('◐')).toEqual(['warning', 'warning', 'warning'])
  expect(await glyph('✓')).toEqual(['success'])
  expect(await glyph('✗')).toEqual(['error', 'error'])
})

test('empty: nothing running; the header counts running rows, folded with ◐', async ($, on) => {
  const pane = await draw($, on, {}, 0)
  expect(await textsOf(pane, /nothing running/)).toEqual(['nothing running'])
  const ui = {} as never
  const cfg = { enable: true }
  const two = { a: task({ id: 'a' }), b: task({ id: 'b' }), c: task({ id: 'c', status: 'completed', endedAt: 1 }) }
  expect(agents.count?.({ tasks: two }, ui, cfg, 36)).toBe('2 running')
  expect(agents.summary?.({ tasks: {} }, ui, cfg, 36)).toBe('nothing running')
})

// Scenario: the Sidebar and the toasts through register.tsx's hooks.

// The world beneath the plugin: a session outside any repo, the agent list,
// spawns that answer with an id, and every toast shown.
function host(on: On, world: { agents: AgentInfo[]; toasts: string[]; files?: string[] }) {
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('session.cwd', () => ({ value: '/srv/x' }))
  on('session.version', () => ({ value: { version: '2.1.288' } }))
  on('session.usage', () => ({
    value: { startedAt: 0, context: { window: 200000 }, rateLimits: [], cost: { usd: 0 } },
  }))
  on('process.run', () => ({
    value: { exitCode: 128, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false },
  }))
  on('fs.exists', () => ({ value: false }))
  on('fs.stat', (_, e) => {
    if (!world.files?.includes(e.path)) throw new Error('ENOENT')
    return { value: { kind: 'file' as const, size: 1, mtimeMs: 1, isLink: false } }
  })
  on('fs.read', () => ({ value: '{ "version": "0.0.0" }' }))
  on('env.get', () => ({ value: '1' }))
  on('tool.list', () => ({ value: [] }))
  on('agent.list', () => ({ value: world.agents }))
  on('agent.spawn', (_, e) => {
    const id = `a${world.agents.length + 1}`
    world.agents.push({ id, description: e.description, type: e.subagentType, status: 'running' })
    return { model: 'claude-haiku-4-5-20251001', agentId: id }
  })
  // `sleep 30` runs as `b-30`.
  on('tool.call', { tool: 'Bash' }, (_, e) => {
    const backgroundTaskId = `b-${e.command.split(' ')[1]?.replace(/\W/g, '')}`
    return { result: { stdout: '', stderr: '', interrupted: false, backgroundTaskId } }
  })
  on('tool.call', { tool: 'TaskStop' }, (_, e) => ({
    result: { message: 'Successfully stopped task', task_id: e.task_id ?? '', task_type: 'local_bash' },
  }))
  on('tool.call', { tool: 'Workflow' }, () => ({
    result: { status: 'async_launched', taskId: 'w1', workflowName: 'review', transcriptDir: '/tmp/wf/w1' },
  }))
  on('prompt.submit', (_, e) => ({ text: e.text }))
  on('session.end', (_, e) => ({ sessionId: e.sessionId }))
  on('classic.StopFailure', () => ({}))
  on('ui.toast', (_, e) => {
    world.toasts.push(e.text)
    return { value: undefined }
  })
}

const start = ($: Engine) => $.session.start({ cwd: '/srv/x', surface: 'terminal', isInteractive: true })

const spawn = ($: Engine, description: string, subagentType = 'Explore', parentAgentId?: string) =>
  $.agent.spawn({
    tool_use_id: `toolu_${description}`,
    prompt: description,
    description,
    subagentType,
    provider: { plugin: 'engine', tier: 'core' },
    parentModel: 'claude-opus-5-5',
    background: true,
    fork: false,
    ...(parentAgentId && { parentAgentId }),
  })

const notify = ($: Engine, id: string, status: string, summary: string) =>
  $.prompt.submit({
    text: [
      '<task-notification>',
      `<task-id>${id}</task-id>`,
      `<status>${status}</status>`,
      `<summary>${summary}</summary>`,
      '</task-notification>',
    ].join('\n'),
    wait: false,
    origin: { kind: 'task-notification' },
  })

const background = ($: Engine, command: string, agentId?: string) =>
  $.tool.call({ tool: 'Bash', command, run_in_background: true, ...(agentId && { agentId }) })

// The Agents & shells rows as the Sidebar draws them.
async function sidebarOf($: Engine) {
  const pane = await $.ui.mount({ ...PANE, plugin: 'ctui', requestId: 'sidebar' })
  return {
    pane,
    rows: async () => {
      await pane.redraw()
      return textsOf(pane, ROW)
    },
  }
}

test('agent.spawn gives a row and a start toast; the list turning completed gives done', async ($, on) => {
  const clock = mock.clock(on, { now: 0 })
  const world = { agents: [] as AgentInfo[], toasts: [] as string[] }
  host(on, world)
  await start($)
  await spawn($, 'list work dir')
  await clock.settle()
  const { rows } = await sidebarOf($)
  expect(await rows()).toEqual(['◐ Explore · list work dir'])
  expect(world.toasts).toEqual(['◆ Explore started: list work dir'])

  await clock.advance(3000)
  world.agents[0]!.status = 'completed'
  await clock.advance(1000)
  expect(await rows()).toEqual(['✓ Explore · list work dir'])
  expect(world.toasts).toEqual(['◆ Explore started: list work dir', '✓ Explore done · list work dir · 4s'])

  await clock.advance(8000)
  expect(await rows()).toEqual([])
})

test('a nested agent draws under its parent', async ($, on) => {
  const clock = mock.clock(on, { now: 0 })
  host(on, { agents: [], toasts: [] })
  await start($)
  await spawn($, 'audit', 'general-purpose')
  await spawn($, 'scan', 'Explore', 'a1')
  await clock.settle()
  const { rows } = await sidebarOf($)
  expect(await rows()).toEqual(['◐ general-purpose · audit', '└ ◐ Explore · scan'])
})

test('classic.StopFailure gives the failure reason', async ($, on) => {
  const clock = mock.clock(on, { now: 0 })
  const world = { agents: [] as AgentInfo[], toasts: [] as string[] }
  host(on, world)
  await start($)
  await spawn($, 'FAIL probe', 'general-purpose')
  await $.classic.StopFailure({ agent_id: 'a1', error: 'model_not_found', last_assistant_message: 'There is an issue' })
  world.agents[0]!.status = 'failed'
  await clock.advance(1000)
  const { rows } = await sidebarOf($)
  expect(await rows()).toEqual(['✗ general-purpose · FAIL probe · model not found'])
  await clock.advance(2100)
  expect(world.toasts).toEqual(['◆ general-purpose started: FAIL probe', '✗ general-purpose failed: model not found'])
})

test('a background Bash gives a shell row; its notification ends it with the exit code', async ($, on) => {
  const clock = mock.clock(on, { now: 0 })
  const world = { agents: [] as AgentInfo[], toasts: [] as string[] }
  host(on, world)
  await start($)
  await background($, 'sleep 2; exit 3\necho never')
  await clock.settle()
  const { rows } = await sidebarOf($)
  expect(await rows()).toEqual(['◐ $ sleep 2; exit 3'])
  await clock.advance(2000)
  await notify($, 'b-2', 'failed', 'Background command "sleep 2; exit 3" failed with exit code 3')
  await clock.advance(2100)
  expect(await rows()).toEqual(['✗ $ sleep 2; exit 3 · exit code 3'])
  expect(world.toasts).toEqual(['$ sleep 2; exit 3 started in background', '✗ shell failed: exit code 3'])
})

test('a queued_command kill gives killed and no toast; a TaskStop gives killed with a toast', async ($, on) => {
  const clock = mock.clock(on, { now: 0 })
  const world = { agents: [] as AgentInfo[], toasts: [] as string[] }
  host(on, world)
  await start($)
  await background($, 'sleep 300')
  await background($, 'sleep 60')
  await clock.advance(5000)
  const text = `<system-reminder>\n[SYSTEM NOTIFICATION - NOT USER INPUT]\n<task-notification>\n<task-id>b-300</task-id>\n<status>killed</status>\n<summary>Task "sleep 300" was stopped by the user</summary>\n</task-notification>\n</system-reminder>`
  // On 2.1.288 the test kit can't keep a row: nothing answers `session.append`
  // beneath the plugins, and a test's answer is skipped. ctui's hook reads the
  // row before `next(e)`, so the call's rejection comes after it.
  await $.session
    .append({
      message: { type: 'attachment', name: 'queued_command', content: [{ type: 'text', text }] },
      door: 'delivery',
      origin: { kind: 'engine' },
      uuid: 'u1',
    })
    .catch(() => undefined)
  await $.tool.call({ tool: 'TaskStop', task_id: 'b-60' })
  await clock.advance(2100)
  const { rows } = await sidebarOf($)
  expect(await rows()).toEqual(['✗ $ sleep 300 · killed', '✗ $ sleep 60 · killed'])
  expect(world.toasts).toEqual([
    '$ sleep 300 started in background',
    '$ sleep 60 started in background',
    '✗ shell killed',
  ])
})

test("a subagent's shell ends through the row delivered into that subagent's loop", async ($, on) => {
  const clock = mock.clock(on, { now: 0 })
  const world = { agents: [] as AgentInfo[], toasts: [] as string[] }
  host(on, world)
  await start($)
  await spawn($, 'nested sleeper', 'general-purpose')
  await background($, 'sleep 5', 'a1')
  await clock.advance(5000)
  const text = [
    '<task-notification>',
    '<task-id>b-5</task-id>',
    '<status>completed</status>',
    '<summary>Background command "sleep 5" completed (exit code 0)</summary>',
    '</task-notification>',
  ].join('\n')
  // The test kit can't keep a row (see the queued_command test).
  await $.session
    .append({
      message: { type: 'user', content: [{ type: 'text', text }] },
      door: 'prompt',
      origin: { kind: 'task-notification' },
      uuid: 'u2',
      agentId: 'a1',
    })
    .catch(() => undefined)
  await clock.settle()
  const { rows } = await sidebarOf($)
  expect(await rows()).toEqual(['◐ general-purpose · nested sleeper', '└ ✓ $ sleep 5'])
  expect(world.toasts.at(-1)).toBe('✓ shell done · sleep 5 · 5s')
})

// `tasks` beneath the plugin, so a test can empty it as /clear does.
function tasksState(on: On) {
  const box: { value?: Record<string, Task> } = {}
  on('state.get', async ($, e, next) => (e.key === 'tasks' ? { value: { value: box.value, version: 0 } } : next(e)))
  on('state.set', async ($, e, next) => {
    if (e.key === 'tasks') box.value = e.value as Record<string, Task>
    return next(e)
  })
  return box
}

test('/clear carries running work into the new session, and its end still reports', async ($, on) => {
  const clock = mock.clock(on, { now: 0 })
  const world = { agents: [] as AgentInfo[], toasts: [] as string[] }
  host(on, world)
  const state = tasksState(on)
  await start($)
  await spawn($, 'list work dir')
  await background($, 'sleep 30')
  world.agents.push({ id: 'old', description: 'gone', type: 'Explore', status: 'completed' })
  await clock.advance(1000)
  await $.session.end({ reason: 'clear', sessionId: 's1', resume: { id: 's1' } })
  state.value = undefined
  await clock.advance(1000)
  const { rows } = await sidebarOf($)
  expect(await rows()).toEqual(['◐ Explore · list work dir', '◐ $ sleep 30'])

  await notify($, 'b-30', 'completed', 'Background command "sleep 30" completed (exit code 0)')
  await clock.advance(4200)
  expect(world.toasts.at(-1)).toBe('✓ shell done · sleep 30 · 2s')
})

test('a Workflow run is one row; a shell of its agent nests under it quietly', async ($, on) => {
  const clock = mock.clock(on, { now: 0 })
  const world = { agents: [] as AgentInfo[], toasts: [] as string[], files: ['/tmp/wf/w1/agent-x9.jsonl'] }
  host(on, world)
  await start($)
  await $.tool.call({ tool: 'Workflow', script: 'export const meta = {}' })
  await background($, 'sleep 9', 'x9')
  await background($, 'sleep 7', 'teammate')
  await clock.advance(3000)
  const { rows } = await sidebarOf($)
  expect(await rows()).toEqual(['◐ ⚙ review workflow', '└ ◐ $ sleep 9'])

  await notify($, 'w1', 'completed', 'Workflow "review" completed')
  await clock.advance(2100)
  expect(await rows()).toEqual(['✓ ⚙ review workflow'])
  expect(world.toasts).toEqual(['◆ workflow started: review', '✓ workflow done · review · 3s'])
})

test('a teammate in the agent list gets no row and no toast', async ($, on) => {
  const clock = mock.clock(on, { now: 0 })
  const world = { agents: [] as AgentInfo[], toasts: [] as string[] }
  host(on, world)
  world.agents.push({ id: 't1', description: 'reviewer', type: 'teammate', status: 'running', name: 'reviewer' })
  await start($)
  await clock.advance(3000)
  const { rows } = await sidebarOf($)
  expect(await rows()).toEqual([])
  expect(world.toasts).toEqual([])
})

test('toasts come 2100 ms apart, an end ahead of waiting starts', async ($, on) => {
  const clock = mock.clock(on, { now: 0 })
  const world = { agents: [] as AgentInfo[], toasts: [] as string[] }
  host(on, world)
  await start($)
  await spawn($, 'one')
  await spawn($, 'two')
  await spawn($, 'three')
  await clock.settle()
  expect(world.toasts).toEqual(['◆ Explore started: one'])
  world.agents[0]!.status = 'completed'
  await clock.advance(2000)
  expect(world.toasts).toHaveLength(1)
  await clock.advance(100)
  expect(world.toasts).toEqual(['◆ Explore started: one', '✓ Explore done · one · 1s'])
  await clock.advance(2100)
  expect(world.toasts.at(-1)).toBe('◆ Explore started: two')
})

const NO_TOASTS = { options: { agents_toasts: false } }

test('agents_toasts off enqueues nothing, and the rows still draw', NO_TOASTS, async ($, on) => {
  const clock = mock.clock(on, { now: 0 })
  const world = { agents: [] as AgentInfo[], toasts: [] as string[] }
  host(on, world)
  await start($)
  await spawn($, 'list work dir')
  await background($, 'sleep 5')
  await clock.advance(5000)
  const { rows } = await sidebarOf($)
  expect(await rows()).toEqual(['◐ Explore · list work dir', '◐ $ sleep 5'])
  expect(world.toasts).toEqual([])
})
