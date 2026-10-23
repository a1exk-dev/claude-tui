import type { On, ToolInfo } from 'claude-code'
import { type Engine, expect, mock, test } from 'claude-code/testing'

// PROBE (#455), not a kept test: measures what an unhandled rejection from a
// bare `void f($)` call does to ctui's hooks module.

type Task = { id: string; subject: string; status: 'pending' | 'in_progress' | 'completed' }

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

// Everything off but todo; git and versions are always on.
const OPTIONS = {
  options: { context_enable: false, limits_enable: false, skills_enable: false, mcp_enable: false, agents_enable: false },
}

type World = {
  tasks: Task[]
  env: Record<string, string | undefined>
  // Which ctui state keys the world refuses.
  denied: Set<string>
  // Every state.set the world saw, in order: `key` and whether it was denied.
  sets: { key: string; denied: boolean }[]
  toasts: string[]
  logs: string[]
}

function host(on: On, world: World) {
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('session.cwd', () => ({ value: '/srv/x' }))
  on('session.version', () => ({ value: { version: '2.1.300' } }))
  on('agent.list', () => ({ value: [] }))
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200000 }, rateLimits: [], cost: { usd: 0 } } }))
  on('session.messages', () => ({ value: [] }))
  on('process.run', () => ({ value: { exitCode: 128, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('fs.exists', () => ({ value: false }))
  on('fs.stat', () => { throw new Error('ENOENT') })
  on('fs.read', () => ({ value: '{}' }))
  on('env.get', (_, e) => ({ value: world.env[e.name] }))
  on('env.set', (_, e) => { world.env[e.name] = e.value; return { value: undefined } })
  on('ui.toast', (_, e) => { world.toasts.push(String(e.text)); return { value: undefined } })
  on('ui.log', (_, e) => { world.logs.push(String(e.text)); return { value: undefined } })
  on('ui.invalidate', () => ({ value: undefined }))
  on('tool.list', () => ({ value: ['TaskCreate', 'TaskList', 'TaskUpdate'].map((name): ToolInfo => ({ name, description: '', mcp: false })) }))
  on('tool.call', { tool: 'TaskCreate' }, (_, e) => {
    const task = { id: String(world.tasks.length + 1), subject: e.subject, status: 'pending' as const }
    world.tasks.push(task)
    return { result: { task: { id: task.id, subject: task.subject } }, text: `Task #${task.id} created` }
  })
  on('tool.call', { tool: 'TaskList' }, () => ({ result: { tasks: world.tasks.map((t) => ({ ...t, blockedBy: [] })) } }))
}

// The deny, registered beneath the plugin before the session starts: one key
// refused, every other passed on (#452's pattern).
function denyKeys(on: On, world: World) {
  on('state.set', (_, e, next) => {
    const key = String((e as { key?: string }).key ?? '')
    const denied = world.denied.has(key)
    world.sets.push({ key, denied })
    return denied ? { deny: `refused ${key}` } : next(e)
  })
}

const start = ($: Engine) => $.session.start({ cwd: '/srv/x', surface: 'terminal', isInteractive: true })

const emptyWorld = (): World => ({ tasks: [], env: {}, denied: new Set(), sets: [], toasts: [], logs: [] })

// 1. A bare `void` in the 1 s tick callback: `void refillVersions($, theme)`,
// whose `$.state.set(VERSIONS, …)` the world refuses. VERSIONS never caches, so
// it retries — and rejects — on every tick.
test('tick callback: a denied versions write', OPTIONS, async ($, on) => {
  const world = emptyWorld()
  world.denied.add('versions')
  const clock = mock.clock(on, { now: 0 })
  denyKeys(on, world)
  host(on, world)
  await start($)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, plugin: 'ctui', requestId: 'sidebar' })

  const versionSets = () => world.sets.filter((s) => s.key === 'versions').length
  const afterStart = versionSets()
  console.log('PROBE1 versions sets after session.start:', afterStart)

  await clock.advance(1000)
  await clock.settle()
  const afterTick1 = versionSets()
  console.log('PROBE1 versions sets after tick 1:', afterTick1)

  await clock.advance(1000)
  await clock.settle()
  const afterTick2 = versionSets()
  console.log('PROBE1 versions sets after tick 2:', afterTick2)

  await clock.advance(1000)
  await clock.settle()
  console.log('PROBE1 versions sets after tick 3:', versionSets())

  // Does a later hook still fire? ctui hooks tool.call for TaskCreate.
  const called = await $.tool.call({ tool: 'TaskCreate', subject: 'alpha', description: 'a', activeForm: 'Doing alpha' })
  console.log('PROBE1 TaskCreate answer:', JSON.stringify(called))

  // Does the Sidebar still redraw?
  await pane.redraw()
  const texts = await pane.findAll({ type: 'Text' })
  console.log('PROBE1 sidebar text count after redraw:', texts.length)
  console.log('PROBE1 toasts:', JSON.stringify(world.toasts))
  console.log('PROBE1 logs:', JSON.stringify(world.logs))
  console.log('PROBE1 ticks advanced past the first rejection:', afterTick2 > afterTick1)
  expect(afterTick1).toBeGreaterThan(afterStart - 1)
})

// 2. A bare `void` in a hook body: `void loadTodo($)` at the TaskCreate hook,
// whose `$.state.set(TODO, …)` the world refuses. The hook has already returned.
test('hook body: a denied todo write', OPTIONS, async ($, on) => {
  const world = emptyWorld()
  world.denied.add('todo')
  const clock = mock.clock(on, { now: 0 })
  denyKeys(on, world)
  host(on, world)
  await start($)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, plugin: 'ctui', requestId: 'sidebar' })

  const first = await $.tool.call({ tool: 'TaskCreate', subject: 'alpha', description: 'a', activeForm: 'Doing alpha' })
  console.log('PROBE2 first TaskCreate answer:', JSON.stringify(first))
  await clock.settle()

  // Does the hook still fire on the next call?
  const second = await $.tool.call({ tool: 'TaskCreate', subject: 'beta', description: 'b' })
  console.log('PROBE2 second TaskCreate answer:', JSON.stringify(second))
  console.log('PROBE2 todo sets seen:', JSON.stringify(world.sets.filter((s) => s.key === 'todo')))

  await clock.advance(1000)
  await clock.settle()
  console.log('PROBE2 sets after a tick:', JSON.stringify(world.sets.map((s) => s.key + (s.denied ? '!' : ''))))

  await pane.redraw()
  console.log('PROBE2 sidebar text count after redraw:', (await pane.findAll({ type: 'Text' })).length)
  console.log('PROBE2 toasts:', JSON.stringify(world.toasts))
  console.log('PROBE2 logs:', JSON.stringify(world.logs))
  expect(second).toBeDefined()
})

