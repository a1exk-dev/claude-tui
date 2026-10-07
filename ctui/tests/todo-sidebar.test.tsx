import type { On, ToolInfo } from 'claude-code'
import { type Engine, expect, mock, test } from 'claude-code/testing'

import { colors } from '../plugins/colors'
import todo from '../plugins/todo'
import type { Todo } from '../types'

// The `todo` Sidebar plugin: its view with sample lists, and scenarios through
// register.tsx's hooks: Task tool calls draw rows, no task tools draws a hint,
// and `session.start` sets CLAUDE_CODE_ENABLE_TODO_TOOLS.

const LIST: Todo = {
  tools: 'task',
  items: [
    { id: '1', subject: 'Write the parser', status: 'completed' },
    { id: '2', subject: 'Run the tests', status: 'in_progress', activeForm: 'Running the tests' },
    { id: '3', subject: 'Open the PR', status: 'pending' },
  ],
}

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

// Draws the view's rows in a test Pane.
async function draw($: Engine, on: On, list: Todo, tools = true) {
  on('ui.render', { component: 'Pane', requestId: 'unit' }, async ($, e) => {
    const ui = $.ui.resolve(e)
    return <ui.Box flexDirection="column">{todo.view({ todo: list }, ui, { enable: true, tools }, 36, colors())}</ui.Box>
  })
  return $.ui.mount({ ...PANE, plugin: 'test', requestId: 'unit' })
}

// The text of each todo row.
async function rowsOf(pane: Awaited<ReturnType<typeof draw>>) {
  const texts = await pane.findAll({ type: 'Text', text: /^[✓◐○] / })
  return texts.map((text) => text.text)
}

test('rows in list order: ✓ muted, ◐ with its activeForm, ○ faint with muted text', async ($, on) => {
  const pane = await draw($, on, LIST)
  expect(await rowsOf(pane)).toEqual(['✓ Write the parser', '◐ Running the tests', '○ Open the PR'])
  const glyph = async (text: string) => (await pane.find({ type: 'Text', text: new RegExp(`^${text}$`) }))?.props
  expect((await Promise.all(['✓', '◐', '○'].map(glyph))).map((props) => props?.color)).toEqual([
    'inactive',
    'warning',
    'subtle',
  ])
  expect((await glyph('Write the parser'))?.color).toBe('inactive')
  expect((await glyph('Running the tests'))?.color).toBe('text')
  expect((await glyph('Open the PR'))?.color).toBe('inactive')
})

test('an in-progress item without an activeForm shows its subject', async ($, on) => {
  const pane = await draw($, on, { tools: 'todowrite', items: [{ subject: 'Fix it', status: 'in_progress' }] })
  expect(await rowsOf(pane)).toEqual(['◐ Fix it'])
})

test('the header counts completed over total; folded it adds the item in progress', () => {
  const ui = {} as never
  const cfg = { enable: true, tools: true }
  expect(todo.count?.({ todo: LIST }, ui, cfg, 36, colors())).toBe('1/3')
  expect(todo.summary?.({ todo: LIST }, ui, cfg, 36, colors())).toBe('1/3 · Running the tests')
  const idle = { tools: 'task' as const, items: LIST.items.filter((item) => item.status !== 'in_progress') }
  expect(todo.summary?.({ todo: idle }, ui, cfg, 36, colors())).toBe('1/2')
  expect(todo.count?.({ todo: { tools: 'task', items: [] } }, ui, cfg, 36, colors())).toBe('0/0')
  expect(todo.count?.({ todo: { tools: 'none', items: [] } }, ui, cfg, 36, colors())).toBeUndefined()
  expect(todo.summary?.({ todo: { tools: 'none', items: [] } }, ui, cfg, 36, colors())).toBeUndefined()
})

// Scenario: the Sidebar through register.tsx's hooks.

type Task = { id: string; subject: string; status: 'pending' | 'in_progress' | 'completed' }

// The world beneath the plugin: a session outside any repo, the tool list,
// a Task store answering the Task tools, and an environment `$.env.set` writes.
function host(on: On, world: { tools: string[]; tasks: Task[]; env: Record<string, string | undefined> }) {
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('session.cwd', () => ({ value: '/srv/x' }))
  on('session.version', () => ({ value: { version: '2.1.288' } }))
  on('agent.list', () => ({ value: [] }))
  on('session.usage', () => ({
    value: { startedAt: 0, context: { window: 200000 }, rateLimits: [], cost: { usd: 0 } },
  }))
  on('session.messages', () => ({ value: [] }))
  on('process.run', () => ({
    value: { exitCode: 128, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false },
  }))
  on('fs.exists', () => ({ value: false }))
  on('fs.stat', () => {
    throw new Error('ENOENT')
  })
  on('fs.read', () => ({ value: '{ "version": "0.0.0" }' }))
  on('env.get', (_, e) => ({ value: world.env[e.name] }))
  on('env.set', (_, e) => {
    world.env[e.name] = e.value
    return { value: undefined }
  })
  on('tool.list', () => ({
    value: world.tools.map((name): ToolInfo => ({ name, description: '', mcp: false })),
  }))
  on('tool.call', { tool: 'TaskCreate' }, (_, e) => {
    const task = { id: String(world.tasks.length + 1), subject: e.subject, status: 'pending' as const }
    world.tasks.push(task)
    return { result: { task: { id: task.id, subject: task.subject } } }
  })
  on('tool.call', { tool: 'TaskUpdate' }, (_, e) => {
    const task = world.tasks.find((t) => t.id === e.taskId)
    if (task && e.status && e.status !== 'deleted') task.status = e.status
    return { result: { success: true, taskId: e.taskId, updatedFields: ['status'] } }
  })
  on('tool.call', { tool: 'TaskList' }, () => {
    if (!world.tools.includes('TaskList')) throw new Error('no tool named "TaskList" in this session')
    return { result: { tasks: world.tasks.map((task) => ({ ...task, blockedBy: [] })) } }
  })
}

const start = ($: Engine) => $.session.start({ cwd: '/srv/x', surface: 'terminal', isInteractive: true })

// The Todo section's rows: its count and every row under it.
async function sidebarOf($: Engine) {
  const pane = await $.ui.mount({ ...PANE, plugin: 'ctui', requestId: 'sidebar' })
  return {
    pane,
    rows: async () => rowsOf(pane),
    text: async (text: string | RegExp) => (await pane.find({ type: 'Text', text }))?.text,
  }
}

test('TaskCreate and TaskUpdate draw rows, with activeForm from the inputs', async ($, on) => {
  const clock = mock.clock(on, { now: 0 })
  const world = { tools: ['TaskCreate', 'TaskList', 'TaskUpdate'], tasks: [], env: {} }
  host(on, world)
  await start($)
  await clock.settle()
  const { pane, rows, text } = await sidebarOf($)
  expect(await rows()).toEqual([])
  expect(await text('0/0')).toBe('0/0')

  await $.tool.call({ tool: 'TaskCreate', subject: 'alpha', description: 'a', activeForm: 'Doing alpha' })
  await $.tool.call({ tool: 'TaskCreate', subject: 'beta', description: 'b' })
  await $.tool.call({ tool: 'TaskUpdate', taskId: '1', status: 'in_progress' })
  await clock.settle()
  await pane.redraw()
  expect(await rows()).toEqual(['◐ Doing alpha', '○ beta'])

  await $.tool.call({ tool: 'TaskUpdate', taskId: '1', status: 'completed' })
  await $.tool.call({ tool: 'TaskUpdate', taskId: '2', status: 'in_progress', activeForm: 'Doing beta' })
  await clock.settle()
  await pane.redraw()
  expect(await rows()).toEqual(['✓ alpha', '◐ Doing beta'])
  expect(await text('1/2')).toBe('1/2')

  await pane.press({ key: 'fold-todo' })
  expect(await text(/^1\/2 · /)).toBe('1/2 · Doing beta')
})

test('a list held before session.start draws at once, as after --resume or a reload', async ($, on) => {
  const clock = mock.clock(on, { now: 0 })
  const tasks: Task[] = [
    { id: '1', subject: 'alpha', status: 'completed' },
    { id: '2', subject: 'beta', status: 'pending' },
  ]
  host(on, { tools: ['TaskList'], tasks, env: {} })
  await start($)
  await clock.settle()
  const { rows } = await sidebarOf($)
  expect(await rows()).toEqual(['✓ alpha', '○ beta'])
})

test('/model to a model with the tools loads the list within a second', async ($, on) => {
  const clock = mock.clock(on, { now: 0 })
  const world = { tools: [] as string[], tasks: [{ id: '1', subject: 'alpha', status: 'pending' as const }], env: {} }
  host(on, world)
  await start($)
  await clock.settle()
  const { pane, rows, text } = await sidebarOf($)
  expect(await text('no task tools in this session')).toBeDefined()
  world.tools = ['TaskList']
  await clock.advance(1000)
  await pane.redraw()
  expect(await rows()).toEqual(['○ alpha'])
  expect(await text('no task tools in this session')).toBeUndefined()
})

test('no task tools with Task tools on: the session has none', async ($, on) => {
  const clock = mock.clock(on, { now: 0 })
  host(on, { tools: ['Bash'], tasks: [], env: {} })
  await start($)
  await clock.settle()
  const { rows, text } = await sidebarOf($)
  expect(await rows()).toEqual([])
  expect(await text('no task tools in this session')).toBeDefined()
})

test('no task tools with Task tools off: turn them on in /config', { options: { todo_tools: false } }, async ($, on) => {
  const clock = mock.clock(on, { now: 0 })
  host(on, { tools: ['Bash'], tasks: [], env: {} })
  await start($)
  await clock.settle()
  const { text } = await sidebarOf($)
  expect(await text('no task tools on this model')).toBeDefined()
  expect(await text('turn on ctui Task tools in /config')).toBeDefined()
})

test('TodoWrite feeds the list when the Task tools are off', async ($, on) => {
  const clock = mock.clock(on, { now: 0 })
  host(on, { tools: ['TodoWrite'], tasks: [], env: {} })
  on('tool.call', { tool: 'TodoWrite' }, (_, e) => ({ result: { oldTodos: [], newTodos: e.todos } }))
  await start($)
  await clock.settle()
  const { pane, rows } = await sidebarOf($)
  await $.tool.call({
    tool: 'TodoWrite',
    todos: [
      { content: 'alpha', status: 'completed', activeForm: 'Doing alpha' },
      { content: 'beta', status: 'in_progress', activeForm: 'Doing beta' },
    ],
  })
  await clock.settle()
  await pane.redraw()
  expect(await rows()).toEqual(['✓ alpha', '◐ Doing beta'])
})

// `todoEnvSet` beneath the plugin, as `$.state` holds it across a reload:
// `ours` is what an earlier load recorded.
function envState(on: On, ours?: boolean) {
  const box = { ours }
  on('state.get', async ($, e, next) =>
    e.key === 'todoEnvSet' ? { value: { value: box.ours, version: 0 } } : next(e),
  )
  on('state.set', async ($, e, next) => {
    if (e.key === 'todoEnvSet') box.ours = e.value as boolean
    return next(e)
  })
  return box
}

const env = (value?: string): Record<string, string | undefined> =>
  value === undefined ? {} : { CLAUDE_CODE_ENABLE_TODO_TOOLS: value }

test('session.start sets CLAUDE_CODE_ENABLE_TODO_TOOLS when it is unset', async ($, on) => {
  const clock = mock.clock(on, { now: 0 })
  const world = { tools: [], tasks: [], env: env() }
  host(on, world)
  const state = envState(on)
  await start($)
  await clock.settle()
  expect(world.env.CLAUDE_CODE_ENABLE_TODO_TOOLS).toBe('1')
  expect(state.ours).toBe(true)
})

test('session.start keeps a value the person set', async ($, on) => {
  const clock = mock.clock(on, { now: 0 })
  const world = { tools: [], tasks: [], env: env('0') }
  host(on, world)
  const state = envState(on)
  await start($)
  await clock.settle()
  expect(world.env.CLAUDE_CODE_ENABLE_TODO_TOOLS).toBe('0')
  expect(state.ours).toBeUndefined()
})

test('Task tools off keeps a value the person set', { options: { todo_tools: false } }, async ($, on) => {
  const clock = mock.clock(on, { now: 0 })
  const world = { tools: [], tasks: [], env: env('1') }
  host(on, world)
  envState(on)
  await start($)
  await clock.settle()
  expect(world.env.CLAUDE_CODE_ENABLE_TODO_TOOLS).toBe('1')
})

test('Task tools off after ctui set the variable unsets it', { options: { todo_tools: false } }, async ($, on) => {
  const clock = mock.clock(on, { now: 0 })
  const world = { tools: [], tasks: [], env: env('1') }
  host(on, world)
  const state = envState(on, true)
  await start($)
  await clock.settle()
  expect(world.env.CLAUDE_CODE_ENABLE_TODO_TOOLS).toBeUndefined()
  expect(state.ours).toBe(false)
})
