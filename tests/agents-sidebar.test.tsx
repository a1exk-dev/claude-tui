import type { AgentInfo, On } from 'claude-code'
import { type Engine, expect, mock, test } from 'claude-code/testing'

import agents from '../plugins/agents'
import { colors } from '../plugins/colors'
import type { Task } from '../types'
import { clientsAsTrees } from './clients'

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

// The Sidebar's shared circle vocabulary as `agents` draws it
// (`plugins/marks.tsx`): the sweep's first frame while a row runs, the tick
// when it completed and the cross for every other end.
const SWEEP = '\u{f0a9e}'
const DONE = '\u{f0133}'
const GONE = '\u{f0159}'

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
    const ui = clientsAsTrees($.ui.resolve(e))
    return <ui.Box flexDirection="column">{agents.view({ tasks, now }, ui, { enable: true }, 36, colors())}</ui.Box>
  })
  return $.ui.mount({ ...PANE, plugin: 'test', requestId: 'unit' })
}

const textsOf = async (pane: Awaited<ReturnType<typeof draw>>, text: RegExp) =>
  (await pane.findAll({ type: 'Text', text })).map((found) => found.text)

// Each row's left half — the branch, the state mark, the two spaces after it,
// the name and an ended row's reason — read from the one Box that shrinks.
// The kind and the elapsed time sit in the row's other half and never do.
const rowsOf = async (pane: Awaited<ReturnType<typeof draw>>) =>
  (await pane.findAll({ type: 'Box' })).filter((box) => box.props.minWidth === 0).map((box) => box.text)

// Each row's right half, `<kind> · <elapsed>`.
const kindsOf = async (pane: Awaited<ReturnType<typeof draw>>) => textsOf(pane, / · \d+[smh]/)

test('rows: a sweep, two ended marks, and the kind as a word at the right', async ($, on) => {
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
  // The name takes the bright slot in every row, a subagent's as much as a
  // command's; an ended row's reason follows it, muted.
  expect(await rowsOf(pane)).toEqual([
    `${SWEEP}  audit`,
    `└ ${SWEEP}  sleep 40`,
    `${SWEEP}  review`,
    `${DONE}  list work dir`,
    `${GONE}  list work dir · model not found`,
    `${GONE}  npm test · killed`,
  ])
  // A subagent says its type, a shell and a Workflow run say what they are.
  expect(await kindsOf(pane)).toEqual([
    'general-purpose · 1m 15s',
    'shell · 1m 10s',
    'workflow · 1m 05s',
    'Explore · 21s',
    'Explore · 1s',
    'shell · 5s',
  ])
  const glyph = async (text: string) =>
    (await pane.findAll({ type: 'Text', text: new RegExp(`^${text}$`, 'u') })).map((found) => found.props.color)
  expect(await glyph(SWEEP)).toEqual(['warning', 'warning', 'warning'])
  expect(await glyph(DONE)).toEqual(['success'])
  expect(await glyph(GONE)).toEqual(['error', 'error'])
})

// The row lays out the name and the right-hand slot with a gap, and only the
// name's half shrinks.
test('a long label keeps a gap and the whole kind and elapsed time', async ($, on) => {
  const long = task({ id: 'a1', label: 'list every file in the ctui folder', startedAt: 0 })
  const pane = await draw($, on, { a1: long }, 75_000)
  const boxes = await pane.findAll({ type: 'Box' })
  expect(boxes.find((box) => box.props.justifyContent === 'space-between')?.props.columnGap).toBe(1)
  expect(boxes.find((box) => box.props.flexShrink === 0 && box.text.includes('·'))?.text).toBe('Explore · 1m 15s')
})

test('empty: nothing running, expanded and folded; the header counts running rows', async ($, on) => {
  const pane = await draw($, on, {}, 0)
  expect(await textsOf(pane, /nothing running/)).toEqual(['nothing running'])
  const ui = {} as never
  const cfg = { enable: true }
  const two = { a: task({ id: 'a' }), b: task({ id: 'b' }), c: task({ id: 'c', status: 'completed', endedAt: 1 }) }
  expect(agents.count?.({ tasks: two }, ui, cfg, 36, colors())).toBe('2 running')
  // An empty tree has no terms, so the section still says what it says empty.
  expect(agents.summary?.({ tasks: {} }, ui, cfg, 36, colors())).toBe('nothing running')
})

// Folded, the section tallies every state it holds, its running term the
// frozen sweep frame (a fold line never animates), and the word `running` is
// gone from it.
test('folded, the tally counts running, completed and every other end', async ($, on) => {
  let tasks: Record<string, Task> = {}
  on('ui.render', { component: 'Pane', requestId: 'unit' }, async ($, e) => {
    const ui = clientsAsTrees($.ui.resolve(e))
    const right = agents.summary?.({ tasks }, ui, { enable: true }, 36, colors())
    return <ui.Box>{typeof right === 'string' ? <ui.Text>{right}</ui.Text> : right}</ui.Box>
  })
  const pane = await $.ui.mount({ ...PANE, plugin: 'test', requestId: 'unit' })
  const summary = async (next: Record<string, Task>) => {
    tasks = next
    await pane.redraw()
    return (await pane.find({ type: 'Text' }))?.text
  }
  const held = {
    a: task({ id: 'a' }),
    b: task({ id: 'b' }),
    c: task({ id: 'c', status: 'completed', endedAt: 1 }),
    d: task({ id: 'd', status: 'failed', endedAt: 1 }),
    e: task({ id: 'e', status: 'killed', endedAt: 1 }),
  }
  // The frozen frame is circle_slice_6, the part-filled shape no state draws.
  expect(await summary(held)).toBe(`\u{f0aa3}  2  ${DONE}  1  ${GONE}  2`)
  expect(await summary({ a: held.a, c: held.c })).toBe(`\u{f0aa3}  1  ${DONE}  1`)
  expect(await summary({})).toBe('nothing running')
})

// Scenario: the Sidebar and the toasts through register.tsx's hooks.

// The world beneath the plugin: a session outside any repo, the agent list,
// spawns that answer with an id, and every toast shown.
function host(on: On, world: { agents: AgentInfo[]; toasts: string[]; files?: string[] }) {
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('session.cwd', () => ({ value: '/srv/x' }))
  on('session.version', () => ({ value: { version: '2.1.300' } }))
  on('command.register', (_, e) => ({ value: { command: e.name } }))
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
  on('fs.read', () => ({ value: '{}' }))
  on('env.get', () => ({ value: '1' }))
  on('tool.list', () => ({ value: [] }))
  on('agent.list', () => ({ value: world.agents }))
  // A workflow agent runs as `x9`, and no list names it.
  on('agent.spawn', (_, e) => {
    if (e.workflow) return { model: 'claude-haiku-4-5-20251001', agentId: 'x9' }
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

const spawn = (
  $: Engine,
  description: string,
  subagentType = 'Explore',
  extra: {
    parentAgentId?: string
    name?: string
    isTeammate?: true
    workflow?: { runId: string; agentIndex: number }
  } = {},
) =>
  $.agent.spawn({
    tool_use_id: `toolu_${description}`,
    prompt: description,
    description,
    subagentType,
    provider: { plugin: 'engine', tier: 'core' },
    parentModel: 'claude-opus-5-5',
    background: true,
    fork: false,
    ...extra,
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

// The Agents & shells rows as the Sidebar draws them. A running row's sweep
// is its own `Client`, which a test plugin's surface does not draw, so such a
// row reads as the gap and the name alone (`tests/clients.tsx`).
async function sidebarOf($: Engine) {
  const pane = await $.ui.mount({ ...PANE, plugin: 'ctui', requestId: 'sidebar' })
  return {
    pane,
    rows: async () => {
      await pane.redraw()
      return rowsOf(pane)
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
  const { pane, rows } = await sidebarOf($)
  expect(await rows()).toEqual(['  list work dir'])
  expect(world.toasts).toEqual(['◆ Explore started: list work dir'])
  // The row sweeps on its own surface clock, the sweep module `hooks/spinner.tsx` under
  // this row's own key, so the Sidebar does not redraw for it.
  const sweep = await pane.find({ type: 'Client', key: 'spinner-a1' })
  expect(sweep?.props.module).toBe('hooks/spinner.tsx')
  expect(sweep?.props.props).toEqual({
    frames: Array.from({ length: 8 }, (_, i) => String.fromCodePoint(0xf0a9e + i)),
    ms: 100,
    color: 'warning',
  })

  await clock.advance(3000)
  world.agents[0]!.status = 'completed'
  await clock.advance(1000)
  expect(await rows()).toEqual([`${DONE}  list work dir`])
  expect(world.toasts).toEqual(['◆ Explore started: list work dir', '✓ Explore done · list work dir · 4s'])

  await clock.advance(8000)
  expect(await rows()).toEqual([])
})

test('a nested agent draws under its parent', async ($, on) => {
  const clock = mock.clock(on, { now: 0 })
  host(on, { agents: [], toasts: [] })
  await start($)
  await spawn($, 'audit', 'general-purpose')
  await spawn($, 'scan', 'Explore', { parentAgentId: 'a1' })
  await clock.settle()
  const { rows } = await sidebarOf($)
  expect(await rows()).toEqual(['  audit', '└   scan'])
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
  expect(await rows()).toEqual([`${GONE}  FAIL probe · model not found`])
  await clock.advance(2100)
  expect(world.toasts).toEqual(['◆ general-purpose started: FAIL probe', '✗ general-purpose failed: model not found'])
})

// The dock's narrow case: the name and the reason share the half that
// truncates, and the kind and the elapsed time keep their room whatever the
// left half holds. The column the text lands in is the live check's
// (`agents/glyph-columns`); the shape is this one's.
test('at the 42-column dock a long name and a long reason give way, not the kind and the time', async ($, on) => {
  const clock = mock.clock(on, { now: 0 })
  const world = { agents: [] as AgentInfo[], toasts: [] as string[] }
  host(on, world)
  await start($)
  await spawn($, 'read every plugin view in the ctui folder', 'general-purpose')
  await clock.advance(3000)
  await notify(
    $,
    'a1',
    'failed',
    'Agent failed: Agent terminated early due to an API error: 529 Overloaded, a server-side issue that is usually temporary. Retry later.',
  )
  await clock.advance(1000)
  const { pane, rows } = await sidebarOf($)
  expect(await rows()).toEqual([
    `${GONE}  read every plugin view in the ctui folder · 529 Overloaded, a server-side issue that is usually temporary`,
  ])
  const boxes = await pane.findAll({ type: 'Box' })
  // The left half shrinks to nothing before the right half gives a column,
  // and the name's own Text is the one that truncates.
  const left = boxes.find((box) => box.props.minWidth === 0)
  expect(left?.props.flexShrink).toBe(1)
  const name = await pane.find({ type: 'Text', text: new RegExp(`^${GONE}  read every plugin view`, 'u') })
  expect(name?.props.wrap).toBe('truncate-end')
  expect(boxes.some((box) => box.props.flexShrink === 0 && box.text === 'general-purpose · 3s')).toBe(true)
})

// #67, 2.1.288: during an API 529 the list kept `running` for minutes after
// the failure notice.
test('a failed notice ends an agent the list still calls running, until the list changes', async ($, on) => {
  const clock = mock.clock(on, { now: 0 })
  const world = { agents: [] as AgentInfo[], toasts: [] as string[] }
  host(on, world)
  await start($)
  await spawn($, 'List ctui folder files')
  // Both before the first poll.
  await $.classic.StopFailure({ agent_id: 'a1', error: 'overloaded', last_assistant_message: '' })
  await notify(
    $,
    'a1',
    'failed',
    'Agent "List ctui folder files" failed: Agent terminated early due to an API error: API Error: 529 Overloaded. This is a server-side issue, usually temporary.',
  )
  await clock.advance(3000)
  const { rows } = await sidebarOf($)
  expect(await rows()).toEqual([`${GONE}  List ctui folder files · API overloaded`])
  await clock.advance(2100)
  expect(world.toasts).toEqual(['◆ Explore started: List ctui folder files', '✗ Explore failed: API overloaded'])
  // A later `completed` doesn't make the failure a success.
  world.agents[0]!.status = 'completed'
  await clock.advance(1000)
  expect(await rows()).toEqual([`${GONE}  List ctui folder files · API overloaded`])
  // Woken again (SendMessage), the list says running and the row runs again.
  world.agents[0]!.status = 'running'
  await clock.advance(1000)
  expect(await rows()).toEqual(['  List ctui folder files'])
})

test('a background Bash gives a shell row; its notification ends it with the exit code', async ($, on) => {
  const clock = mock.clock(on, { now: 0 })
  const world = { agents: [] as AgentInfo[], toasts: [] as string[] }
  host(on, world)
  await start($)
  await background($, 'sleep 2; exit 3\necho never')
  await clock.settle()
  const { rows } = await sidebarOf($)
  expect(await rows()).toEqual(['  sleep 2; exit 3'])
  await clock.advance(2000)
  await notify($, 'b-2', 'failed', 'Background command "sleep 2; exit 3" failed with exit code 3')
  await clock.advance(2100)
  expect(await rows()).toEqual([`${GONE}  sleep 2; exit 3 · exit code 3`])
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
  expect(await rows()).toEqual([`${GONE}  sleep 300 · killed`, `${GONE}  sleep 60 · killed`])
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
  expect(await rows()).toEqual(['  nested sleeper', `└ ${DONE}  sleep 5`])
  expect(world.toasts.at(-1)).toBe('✓ shell done · sleep 5 · 5s')
})

// #246, 2.1.292: an agent that ends its turn to wait on its own background
// shell reads `waiting`, then `running` when the shell wakes it.
test('an agent waiting on its own shell keeps its row and the shell under it', async ($, on) => {
  const clock = mock.clock(on, { now: 0 })
  const world = { agents: [] as AgentInfo[], toasts: [] as string[] }
  host(on, world)
  await start($)
  await spawn($, 'bg waiter', 'general-purpose')
  await background($, 'sleep 25', 'a1')
  await clock.advance(6000)
  const toasts = [...world.toasts]
  world.agents[0]!.status = 'waiting'
  await clock.advance(10_000)
  const { rows } = await sidebarOf($)
  expect(await rows()).toEqual(['  bg waiter', '└   sleep 25'])
  expect(world.toasts).toEqual(toasts)

  world.agents[0]!.status = 'running'
  await clock.advance(1000)
  world.agents[0]!.status = 'completed'
  await clock.advance(2100)
  expect((await rows())[0]).toBe(`${DONE}  bg waiter`)
  expect(world.toasts.at(-1)).toBe('✓ general-purpose done · bg waiter · 18s')
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
  expect(await rows()).toEqual(['  list work dir', '  sleep 30'])

  await notify($, 'b-30', 'completed', 'Background command "sleep 30" completed (exit code 0)')
  await clock.advance(4200)
  expect(world.toasts.at(-1)).toBe('✓ shell done · sleep 30 · 2s')
})

// #245, 2.1.292: a workflow agent fires `agent.spawn` with `workflow` set, and
// no list names its id.
test('a Workflow run is one row; a shell of its agent nests under it quietly', async ($, on) => {
  const clock = mock.clock(on, { now: 0 })
  const world = { agents: [] as AgentInfo[], toasts: [] as string[], files: ['/tmp/wf/w1/agent-x9.jsonl'] }
  host(on, world)
  await start($)
  await $.tool.call({ tool: 'Workflow', script: 'export const meta = {}' })
  await spawn($, 'lint', 'workflow-subagent', { workflow: { runId: 'wf_1', agentIndex: 1 } })
  await background($, 'sleep 9', 'x9')
  await background($, 'sleep 7', 'teammate')
  await clock.advance(3000)
  const { rows } = await sidebarOf($)
  expect(await rows()).toEqual(['  review', '└   sleep 9'])

  await notify($, 'w1', 'completed', 'Workflow "review" completed')
  await clock.advance(2100)
  expect(await rows()).toEqual([`${DONE}  review`])
  expect(world.toasts).toEqual(['◆ workflow started: review', '✓ workflow done · review · 3s'])
})

// #244, 2.1.292: a teammate fires `agent.spawn`, and the list names it too. Its
// TaskStop names its task id (the probe's below), not the spawn's `agentId`.
test('a teammate, its shell and its TaskStop get no row and no toast', async ($, on) => {
  const clock = mock.clock(on, { now: 0 })
  const world = { agents: [] as AgentInfo[], toasts: [] as string[] }
  host(on, world)
  await start($)
  const { agentId } = await spawn($, 'reviewer', 'teammate', { name: 'reviewer', isTeammate: true })
  await background($, 'sleep 7', agentId)
  await clock.advance(1000)
  await $.tool.call({ tool: 'TaskStop', task_id: 'tin1b73zq' })
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
  expect(await rows()).toEqual(['  list work dir', '  sleep 5'])
  expect(world.toasts).toEqual([])
})
