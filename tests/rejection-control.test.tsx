import type { On, ToolInfo } from 'claude-code'
import { type Engine, expect, mock, test } from 'claude-code/testing'

// PROBE (#455) control, its own file: the SAME scenario with nothing denied.
// "the file ran to its end" is a per-file verdict, so a clean file tells the
// kit's unhandled-rejection catcher apart from a malformed probe.

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

test('control: nothing denied, the same ticks and the same hook', OPTIONS, async ($, on) => {
  const world = emptyWorld()
  const clock = mock.clock(on, { now: 0 })
  denyKeys(on, world)
  host(on, world)
  await start($)
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, plugin: 'ctui', requestId: 'sidebar' })
  await clock.advance(1000)
  await clock.settle()
  await clock.advance(1000)
  await clock.settle()
  await $.tool.call({ tool: 'TaskCreate', subject: 'alpha', description: 'a', activeForm: 'Doing alpha' })
  await clock.settle()
  await pane.redraw()
  console.log('CONTROL sets:', JSON.stringify(world.sets.map((s) => s.key + (s.denied ? '!' : ''))))
  console.log('CONTROL toasts:', JSON.stringify(world.toasts), 'logs:', JSON.stringify(world.logs))
  expect(world.sets.every((s) => !s.denied)).toBe(true)
})
