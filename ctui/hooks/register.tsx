import type { CommandRunResult, EngineInterface, Register } from 'claude-code'

import { plugins } from '../plugins'
import { colors } from '../plugins/colors'
import type { GitSnapshot, Task, Todo, TodoItem, Turn, Usage } from '../types'
import { deniedText, gated, type Outcome, pluginsOutcome, themeOutcome } from './commands'
import { type Config, readConfig } from './config'
import { fitsPromptLine, formatReset, modelEffort, promptLabel, savedEffort } from './format'
import { parseGit, tildify } from './git'
import { mcpRows, segmentOf } from './mcp'
import { inheritGlass, themeFile } from './glass'
import { picker } from './pickers'
import { sidebar, type SidebarInput } from './sidebar'
import { assistantMessage } from './skin/assistant'
import { promptLabelRow } from './skin/prompt'
import { hasToolRow, toolLine, toolRow } from './skin/tool'
import { turnOf, turnWord } from './skin/turn'
import { isOwnPrompt, userMessage } from './skin/user'
import {
  applyAgentList,
  applyNotification,
  dropEnded,
  endTask,
  enqueue,
  failureReason,
  firstLine,
  parseTaskNotification,
  startedToast,
  type Toast,
} from './tasks'

const SIDEBAR = 'sidebar'
const FOLDED = { plugin: 'ctui', key: 'folded' } as const
const EXPANDED = { plugin: 'ctui', key: 'expanded' } as const
const SCROLL = { plugin: 'ctui', key: 'scroll' } as const
const GIT = { plugin: 'ctui', key: 'git' } as const
const VERSIONS = { plugin: 'ctui', key: 'versions' } as const
const USAGE = { plugin: 'ctui', key: 'usage' } as const
const NOW = { plugin: 'ctui', key: 'now' } as const
const MCP = { plugin: 'ctui', key: 'mcp' } as const
const TODO = { plugin: 'ctui', key: 'todo' } as const
const ACTIVE_FORMS = { plugin: 'ctui', key: 'activeForms' } as const
const TODO_ENV_SET = { plugin: 'ctui', key: 'todoEnvSet' } as const
const TASKS = { plugin: 'ctui', key: 'tasks' } as const
const MODEL = { plugin: 'ctui', key: 'model' } as const
const EFFORT = { plugin: 'ctui', key: 'effort' } as const
const TURNS = { plugin: 'ctui', key: 'turns' } as const
const GLASS = { plugin: 'ctui', key: 'glass' } as const

// The dock docks from 110 terminal columns; the Sidebar asks 42, or 53 from 160.
const DOCK_COLUMNS = 110
const GAP = 2 // columns between the transcript rows ctui draws and the docked Sidebar's rule
const widthFor = (terminalColumns: number) => (terminalColumns >= 160 ? 53 : 42)

// The `/ctui:*` picker panes by command, which is also the Select's key: pane id and title.
const PICKERS = {
  theme: { id: 'ctui-theme', title: 'Sidebar theme' },
  enable: { id: 'ctui-enable', title: 'Enable a Sidebar plugin' },
  disable: { id: 'ctui-disable', title: 'Disable a Sidebar plugin' },
} as const
type Picker = keyof typeof PICKERS

const GIT_TOOLS = new Set(['Edit', 'Write', 'NotebookEdit', 'Bash'])

// What `/effort <args>` sets for the session.
const EFFORT_LEVELS = new Set(['low', 'medium', 'high', 'xhigh', 'max'])

// Toasts come at most this often: the engine drops one within 2 s of the last.
const TOAST_GAP_MS = 2100

// Module state: a reload starts a fresh environment.
let tick: { cancel: () => void } | undefined
let gitRunning = false
let gitAgain = false // a refresh came while git ran: run once more after it
let checking = false // a viewport check is queued
let waiting = false // opened unasked and not placed: open again on the person's prompt
let requested: number | undefined // the columns last asked for
let maxScroll = 0 // the sections window's last offset, as last drawn
let mcpRunning = false
let mcpTimeout: number | undefined // MCP_TIMEOUT, read once
let claudeJson: { path: string; project: string; mtimeMs?: number; disabled: string[] } | undefined
let themeSeen: { path?: string; mtimeMs?: number } = {} // the active custom /theme file, last read
const mcpNames: Record<string, string> = {} // segment → /mcp name, from `tool.describe`
let todoRunning = false
let todoAgain = false // a reload came while one ran: run once more after it
let tasksChain: Promise<unknown> = Promise.resolve() // task updates, one at a time
let carry: Record<string, Task> | undefined // running tasks across /clear and /resume
let toasts: Toast[] = []
let toasting = false
let toastsOn = true // `agents_toasts`
let lastToast = -Infinity
let agentsRunning = false
let themes: readonly string[] | undefined // the `theme` setting's options, read once
let hint = '' // PromptHint's text, as the engine last drew it
let dockColumns = 0 // the docked Sidebar's columns, its rule included; 0 while it isn't docked
let savedLevel: { model: string; level: unknown } | undefined // modelSettings[model].effortLevel at the last poll
let effortCarry: string | null | undefined // the session's effort across /clear and /resume
let mode: string | undefined // the latest main-loop permission_mode
let stepModel: string | undefined // the last main-loop turn.step's model
let lastTurn: { turn: Turn; at: number } | undefined // the latest main-loop turn.complete's record
const drawnFooters = new Set<string>() // TurnDuration instances drawn since load

// A run still going takes this refresh as one more run after it ends.
async function refreshGit($: EngineInterface) {
  if (gitRunning) {
    gitAgain = true
    return
  }
  gitRunning = true
  try {
    const run = (args: string[]) => $.process.run(['git', '--no-optional-locks', ...args]).catch(() => undefined)
    const git: GitSnapshot = { path: tildify(await $.session.cwd(), await $.env.get('HOME')) }
    const status = await run(['status', '--porcelain=v2', '--branch'])
    if (status?.exitCode === 0) {
      // On an unborn branch the numstat fails: it counts as 0.
      const [stash, numstat] = await Promise.all([run(['stash', 'list']), run(['diff', '--numstat', 'HEAD'])])
      const out = (result: typeof stash) => (result?.exitCode === 0 ? result.stdout : '')
      git.repo = parseGit(status.stdout, out(stash), out(numstat))
    }
    const { value } = await $.state.get(GIT)
    if (JSON.stringify(value) !== JSON.stringify(git)) await $.state.set(GIT, git)
  } finally {
    gitRunning = false
  }
  if (gitAgain) {
    gitAgain = false
    await refreshGit($)
  }
}

// `/clear` and `/resume` empty `$.state` with no `session.start`: the tick refills it.
async function refillVersions($: EngineInterface) {
  const { value } = await $.state.get(VERSIONS)
  if (!value) await loadVersions($)
}

async function loadVersions($: EngineInterface) {
  const manifest = JSON.parse(await $.fs.read(`${$.plugin.root}/.claude-plugin/plugin.json`))
  const versions = { ctui: String(manifest.version), claude: (await $.session.version()).version }
  const { value } = await $.state.get(VERSIONS)
  if (JSON.stringify(value) !== JSON.stringify(versions)) await $.state.set(VERSIONS, versions)
}

// The context and limits figures, from `$.session.usage()` or a `session.measure`.
async function setUsage($: EngineInterface, { context, rateLimits, cost }: Usage) {
  const usage: Usage = { context, rateLimits, ...(cost && { cost }) }
  const { value } = await $.state.get(USAGE)
  if (JSON.stringify(value) !== JSON.stringify(usage)) await $.state.set(USAGE, usage)
}

async function loadUsage($: EngineInterface) {
  await setUsage($, await $.session.usage())
}

// `/clear` and `/resume` empty `$.state` with no `session.start`: the tick refills it.
async function refillUsage($: EngineInterface) {
  const { value } = await $.state.get(USAGE)
  if (!value) await loadUsage($)
}

// `now` moves when a reset time shown would read differently.
async function setNow($: EngineInterface) {
  const usage = await $.state.get(USAGE)
  const resets = usage.value?.rateLimits.flatMap((limit) => (limit.resetsAt ? [limit.resetsAt] : [])) ?? []
  if (!resets.length) return
  const now = await $.clock.now()
  const { value } = await $.state.get(NOW)
  if (value === undefined || resets.some((at) => formatReset(at, now) !== formatReset(at, value))) {
    await $.state.set(NOW, now)
  }
}

// `.claude.json` keys a project by its git root, found by walking up from the cwd, else the cwd.
async function projectOf($: EngineInterface) {
  const cwd = await $.session.cwd()
  for (let dir = cwd; dir; dir = dir.slice(0, dir.lastIndexOf('/'))) {
    if (await $.fs.exists(`${dir}/.git`)) return dir
  }
  return cwd
}

// `projects[<project>].disabledMcpServers`, re-read when the file's mtime changes.
// Claude Code keeps the file in CLAUDE_CONFIG_DIR when that is set.
async function readDisabled($: EngineInterface) {
  const dir = (await $.env.get('CLAUDE_CONFIG_DIR')) || (await $.env.get('HOME'))
  claudeJson ??= { path: `${dir}/.claude.json`, project: await projectOf($), disabled: [] }
  const file = claudeJson
  const stat = await $.fs.stat(file.path).catch(() => undefined)
  if (stat?.mtimeMs !== file.mtimeMs) {
    try {
      const json = stat ? JSON.parse(await $.fs.read(file.path)) : {}
      file.disabled = json.projects?.[file.project]?.disabledMcpServers ?? []
      file.mtimeMs = stat?.mtimeMs
    } catch {
      // Caught mid-write: the next tick reads it again.
    }
  }
  return file.disabled
}

// Under `inherit`, the glass of the active `/theme` when it's a user custom
// theme with no dock color (Omarchy's), re-read when the theme or its file's
// mtime changes: an Omarchy switch rewrites the file.
async function refreshGlass($: EngineInterface) {
  const row = (await $.config.list()).find((r) => r.key === 'theme')
  const dir = (await $.env.get('CLAUDE_CONFIG_DIR')) || `${await $.env.get('HOME')}/.claude`
  const path = themeFile(row?.value, dir)
  const stat = path ? await $.fs.stat(path).catch(() => undefined) : undefined
  // `/clear` and `/resume` empty `$.state` with no `session.start`: read again.
  const { value } = await $.state.get(GLASS)
  if (value !== undefined && path === themeSeen.path && stat?.mtimeMs === themeSeen.mtimeMs) return
  let glass: string | null
  try {
    glass = (path && stat && inheritGlass(JSON.parse(await $.fs.read(path)).overrides ?? {})) || null
  } catch {
    return // Caught mid-write: the next tick reads it again.
  }
  themeSeen = { path, mtimeMs: stat?.mtimeMs }
  // A state value is never undefined: null clears the paint.
  if (value !== glass) await $.state.set(GLASS, glass)
}

// MEMORY.md "The `mcp` Sidebar plugin reads live tools and the disabled list; it never probes".
async function refreshMcp($: EngineInterface) {
  if (mcpRunning) return
  mcpRunning = true
  try {
    mcpTimeout ??= Number(await $.env.get('MCP_TIMEOUT')) || 30_000
    const [tools, disabled, now, { value: rows = [] }] = await Promise.all([
      $.tool.list(),
      readDisabled($),
      $.clock.now(),
      $.state.get(MCP),
    ])
    const next = mcpRows({ rows, tools, disabled, names: mcpNames, now, timeoutMs: mcpTimeout })
    if (JSON.stringify(next) !== JSON.stringify(rows)) await $.state.set(MCP, next)
  } finally {
    mcpRunning = false
  }
}

// MEMORY.md "The `todo` Sidebar plugin turns the task tools on by default":
// set the variable when it's unset, and unset it only when ctui set it.
async function setTodoEnv($: EngineInterface, tools: boolean) {
  const { value: ours } = await $.state.get(TODO_ENV_SET)
  if (tools && (await $.env.get('CLAUDE_CODE_ENABLE_TODO_TOOLS')) === undefined) {
    await $.env.set('CLAUDE_CODE_ENABLE_TODO_TOOLS', '1')
    await $.state.set(TODO_ENV_SET, true)
  } else if (!tools && ours) {
    await $.env.set('CLAUDE_CODE_ENABLE_TODO_TOOLS', undefined)
    await $.state.set(TODO_ENV_SET, false)
  }
}

const TODO_STATUSES = new Set<string>(['pending', 'in_progress', 'completed'])

const todoToolsOf = (names: readonly string[]): Todo['tools'] =>
  names.includes('TaskList') ? 'task' : names.includes('TodoWrite') ? 'todowrite' : 'none'

async function setTodo($: EngineInterface, todo: Todo) {
  const { value } = await $.state.get(TODO)
  if (JSON.stringify(value) !== JSON.stringify(todo)) await $.state.set(TODO, todo)
}

// The list as the session's task tools hold it (the map decision for #10).
// `TaskList` covers a reload, `--resume` and compaction; it lacks `activeForm`,
// kept from the TaskCreate/TaskUpdate inputs. `TodoWrite` takes the last call's
// list from the transcript. A run still going takes this load as one more run.
async function loadTodo($: EngineInterface) {
  if (todoRunning) {
    todoAgain = true
    return
  }
  todoRunning = true
  try {
    const tools = todoToolsOf((await $.tool.list()).map((tool) => tool.name))
    let items: TodoItem[] = []
    if (tools === 'task') {
      // TaskList throws when the tool isn't listed, as after a `/model` switch.
      const listed = await $.tool.call({ tool: 'TaskList' }).catch(() => undefined)
      if (!listed?.result || listed.isError) return
      const { value: forms = {} } = await $.state.get(ACTIVE_FORMS)
      // Rows leave out `deleted`, which 2.1.288's TaskList type doesn't list.
      const shown = listed.result.tasks.filter(({ status }) => TODO_STATUSES.has(status))
      items = shown.map(({ id, subject, status }) => ({
        id,
        subject,
        status,
        ...(forms[id] !== undefined && { activeForm: forms[id] }),
      }))
    } else if (tools === 'todowrite') {
      const uses = (await $.session.messages()).flatMap((message) => message.toolUses)
      const last = uses.findLast((use) => use.tool === 'TodoWrite' && !use.isError)
      items = todoWriteItems(last?.input.todos)
    }
    await setTodo($, { tools, items })
  } finally {
    todoRunning = false
  }
  if (todoAgain) {
    todoAgain = false
    await loadTodo($)
  }
}

// A TodoWrite list: its `todos` input, or its `newTodos` result.
function todoWriteItems(todos: unknown): TodoItem[] {
  if (!Array.isArray(todos)) return []
  return todos.map(({ content, status, activeForm }) => ({ subject: content, status, activeForm }))
}

// Reloads the list when the session's task tools change: a `/model` switch,
// or `/clear` and `/resume`, which empty `$.state`.
async function refreshTodo($: EngineInterface) {
  const [tools, { value }] = await Promise.all([$.tool.list(), $.state.get(TODO)])
  if (todoToolsOf(tools.map((tool) => tool.name)) !== value?.tools) await loadTodo($)
}

// Keeps a Task's `activeForm`, which TaskList lacks.
async function keepActiveForm($: EngineInterface, id: string, activeForm: string | undefined) {
  if (activeForm === undefined) return
  const { value = {} } = await $.state.get(ACTIVE_FORMS)
  if (value[id] !== activeForm) await $.state.set(ACTIVE_FORMS, { ...value, [id]: activeForm })
}

// Applies `change` to the session's tasks, one change at a time. `change`
// edits the copy it gets and returns the toasts its edits raise.
function updateTasks(
  $: EngineInterface,
  change: (tasks: Record<string, Task>, now: number) => Toast[] | void | Promise<Toast[] | void>,
) {
  const run = tasksChain.then(async () => {
    const [{ value = {} }, now] = await Promise.all([$.state.get(TASKS), $.clock.now()])
    const tasks = { ...value }
    const raised = (await change(tasks, now)) ?? []
    if (JSON.stringify(tasks) !== JSON.stringify(value)) await $.state.set(TASKS, tasks)
    for (const toast of raised) showToast($, toast)
  })
  tasksChain = run.catch(() => undefined)
  return run
}

// One toast at most every TOAST_GAP_MS; an end goes ahead of waiting starts.
// `always` skips the `agents_toasts` gate, for a toast that isn't a task's.
function showToast($: EngineInterface, toast: Toast, always = false) {
  if (!toastsOn && !always) return
  toasts = enqueue(toasts, toast)
  // A reload unloads the environment under a waiting toast: the new module starts its own queue.
  if (!toasting) void drainToasts($).catch(() => undefined)
}

async function drainToasts($: EngineInterface) {
  toasting = true
  try {
    while (toasts.length) {
      const wait = lastToast + TOAST_GAP_MS - (await $.clock.now())
      if (wait > 0) await $.clock.sleep(wait)
      const [toast, ...rest] = toasts
      toasts = rest
      if (!toast) break
      lastToast = await $.clock.now()
      await $.ui.toast(toast.text)
    }
  } finally {
    toasting = false
  }
}

// Agent status from the list, which has no change event.
async function refreshAgents($: EngineInterface) {
  if (agentsRunning) return
  agentsRunning = true
  try {
    const list = (await $.agent.list()).filter((agent) => agent.type !== 'teammate')
    await updateTasks($, (tasks, now) => applyAgentList(tasks, list, now))
  } finally {
    agentsRunning = false
  }
}

// The tick's share: merges the /clear carry, drops rows ended ENDED_MS ago,
// and moves `now` while a row shows.
async function tickTasks($: EngineInterface, timers: boolean) {
  const carried = carry
  carry = undefined
  let shown = false
  await updateTasks($, (tasks, now) => {
    for (const task of Object.values(carried ?? {})) tasks[task.id] ??= task
    dropEnded(tasks, now)
    shown = Object.keys(tasks).length > 0
  })
  if (timers && shown) await $.state.set(NOW, await $.clock.now())
}

function onNotification($: EngineInterface, text: string) {
  const note = parseTaskNotification(text)
  if (note) return updateTasks($, (tasks, now) => applyNotification(tasks, note, now))
}

const textOf = (content: readonly { type: string; text?: string }[]) =>
  content.map((block) => (block.type === 'text' ? (block.text ?? '') : '')).join('\n')

// The Sidebar's role colors and background: under `inherit` each role's theme
// key and no background, else the selected Theme's overrides and its glass,
// from `themes/<slug>.json`.
async function themeLook($: EngineInterface, theme: string): Promise<Pick<SidebarInput, 'colors' | 'background'>> {
  if (theme === 'inherit') return { colors: colors() }
  const { overrides } = JSON.parse(await $.fs.read(`${$.plugin.root}/themes/${theme}.json`))
  return { colors: colors(overrides), background: overrides.composerSidebarBackground }
}

// The manifest's `theme` options: under `claude -p` no `/config` row lists them.
async function themesOf($: EngineInterface) {
  themes ??= JSON.parse(await $.fs.read(`${$.plugin.root}/.claude-plugin/plugin.json`)).userConfig.theme
    .options as string[]
  return themes
}

// What a `/ctui:*` command, or a pick in its picker, does with `args`.
async function outcomeOf($: EngineInterface, config: Config, name: Picker, args: string): Promise<Outcome> {
  if (name === 'theme') return themeOutcome(args, await themesOf($), config.theme)
  const states = plugins.map(({ id }) => ({ id, enable: config[id].enable }))
  return pluginsOutcome(name, args, states)
}

async function runCommand(
  $: EngineInterface,
  config: Config,
  name: Picker,
  args: string,
): Promise<CommandRunResult> {
  const decided = await outcomeOf($, config, name, args)
  const hasConfig = 'text' in decided || (await $.config.list()).some((row) => row.key === 'ctui.theme')
  const outcome = gated(decided, hasConfig)
  if ('text' in outcome) return { text: outcome.text }
  if ('set' in outcome) {
    const { deny } = await $.config.set(outcome.set)
    return deny === undefined ? {} : { text: deniedText(outcome.set, deny) }
  }
  // As wide as the Sidebar it docks over; the dock ignores it inline.
  const { id, title } = PICKERS[name]
  await $.ui.open({ id, title, focus: true, closeOnEscape: true, columns: requested ?? widthFor(DOCK_COLUMNS) })
  return {}
}

// A pick closes the pane, then writes last: the write reloads the mod. A
// deny has no command row to print into, so it toasts.
async function pick($: EngineInterface, config: Config, name: Picker, value: string) {
  const outcome = await outcomeOf($, config, name, value)
  const { id } = PICKERS[name]
  $.clock.after(0, async () => {
    await $.ui.close({ id })
    if (!('set' in outcome)) return
    const { deny } = await $.config.set(outcome.set)
    if (deny !== undefined) showToast($, { id, end: true, text: deniedText(outcome.set, deny) }, true)
  })
}

// MEMORY.md "The line under the prompt: `model · effort` is a `SessionMode`
// label". The model follows `/model` within a tick. An unset effort is a new
// session (or `/clear`, `/resume`): seed it. Later, a change in the current
// model's saved level is a `/effort` picker save.
async function refreshModel($: EngineInterface) {
  const [model, settings, stored, effort] = await Promise.all([
    $.session.model(),
    $.settings.read(),
    $.state.get(MODEL),
    $.state.get(EFFORT),
  ])
  const level = modelEffort(settings, model)
  const changed = savedLevel?.model === model && savedLevel.level !== level
  savedLevel = { model, level }
  if (effort.value === undefined) {
    await setEffort($, effortCarry !== undefined ? effortCarry : (savedEffort(settings, model) ?? null))
    effortCarry = undefined
  } else if (changed && typeof level === 'string') {
    await setEffort($, level)
  }
  if (stored.value !== model) await $.state.set(MODEL, model)
}

// A turn's footer draws within this long of its turn.complete.
const FOOTER_MS = 2000

async function addTurn($: EngineInterface, turn: Turn) {
  const { value = [] } = await $.state.get(TURNS)
  await $.state.set(TURNS, [...value, turn])
}

// The latest main-loop permission mode, for the turn footer.
function noteMode(e: { agent_id?: string; permission_mode?: string }) {
  if (e.agent_id === undefined && e.permission_mode) mode = e.permission_mode
}

// Redraws the line under the prompt on the next tick, never from a render.
function redrawLater($: EngineInterface) {
  $.clock.after(0, () => $.ui.invalidate('ui.render'))
}

async function setEffort($: EngineInterface, effort: string | null) {
  const { value } = await $.state.get(EFFORT)
  if (value !== effort) await $.state.set(EFFORT, effort)
}

async function openSidebar($: EngineInterface, columns: number) {
  requested = columns
  const opened = await $.ui.open({ id: SIDEBAR, title: 'Sidebar', columns })
  waiting = !opened.isPlaced
}

export const register: Register = (on, options) => {
  const config = readConfig(options)
  const enabled = plugins.filter((plugin) => config[plugin.id].enable)
  const needs = new Set(enabled.flatMap((plugin) => plugin.needs))
  // Tasks feed the Sidebar section and the toasts.
  const tracking = needs.has('tasks') || config.agents.toasts
  toastsOn = config.agents.toasts
  const inherit = config.theme === 'inherit'
  let look: ReturnType<typeof themeLook> | undefined // read once per load: a `theme` change reloads

  on('session.start', async ($, e, next) => {
    await setTodoEnv($, config.todo.tools)
    void refreshModel($).catch(() => undefined)
    if (needs.has('todo')) void loadTodo($)
    if (needs.has('git')) void refreshGit($)
    if (needs.has('versions')) void loadVersions($)
    if (needs.has('usage')) void loadUsage($).then(() => (needs.has('now') ? setNow($) : undefined))
    if (inherit) void refreshGlass($).catch(() => undefined)
    let ticks = 0
    tick?.cancel()
    tick = $.clock.every(1000, () => {
      ticks++
      void refreshModel($).catch(() => undefined)
      if (ticks % 5 === 0 && needs.has('git')) void refreshGit($)
      if (needs.has('usage')) void refillUsage($)
      if (needs.has('versions')) void refillVersions($)
      if (needs.has('mcp')) void refreshMcp($)
      if (needs.has('todo')) void refreshTodo($)
      if (needs.has('now')) void setNow($)
      if (inherit) void refreshGlass($).catch(() => undefined)
      if (tracking) void refreshAgents($).then(() => tickTasks($, needs.has('now')))
    })
    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    if (needs.has('usage')) await setUsage($, e)
    if (needs.has('now')) await setNow($)
    return next(e)
  })

  // Names a server's row as /mcp does. Observe only.
  on('tool.describe', ($, e, next) => {
    const server = /^mcp:(.+)$/.exec(e.provider.plugin)?.[1]
    if (server) mcpNames[segmentOf(server)] = server
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    try {
      return await next(e)
    } finally {
      if (needs.has('git') && GIT_TOOLS.has(e.tool)) void refreshGit($)
    }
  })

  // A task tool's call reloads the list. Observe only.
  on('tool.call', { tool: 'TaskCreate' }, async ($, e, next) => {
    const done = await next(e)
    if (needs.has('todo') && done.result && !done.isError) {
      await keepActiveForm($, done.result.task.id, e.activeForm)
      void loadTodo($)
    }
    return done
  })

  on('tool.call', { tool: 'TaskUpdate' }, async ($, e, next) => {
    const done = await next(e)
    if (needs.has('todo') && done.result && !done.isError) {
      await keepActiveForm($, e.taskId, e.activeForm)
      void loadTodo($)
    }
    return done
  })

  on('tool.call', { tool: 'TodoWrite' }, async ($, e, next) => {
    const done = await next(e)
    if (!needs.has('todo') || !done.result || done.isError) return done
    // Before the first load or after `/clear`, the tick's load replays the transcript.
    const { value } = await $.state.get(TODO)
    if (value?.tools === 'todowrite') {
      await setTodo($, { tools: 'todowrite', items: todoWriteItems(done.result.newTodos) })
    }
    return done
  })

  // MEMORY.md "Agent and shell events go to toasts, the live list goes to the
  // sidebar", "Task ends come from notifications" and "A Workflow run is one
  // task row". Every task hook observes only.
  on('agent.spawn', async ($, e, next) => {
    const done = await next(e)
    if (tracking && done.agentId) {
      const id = done.agentId
      await updateTasks($, (tasks, now) => {
        const task: Task = {
          id,
          kind: 'agent',
          type: e.subagentType,
          label: e.description,
          ...(e.parentAgentId && { parent: e.parentAgentId }),
          status: 'running',
          listed: 'running',
          startedAt: now,
        }
        tasks[id] = task
        return [startedToast(task)]
      })
    }
    return done
  })

  // An agent dead on an API error: StopFailure comes before the list says `failed`.
  on('classic.StopFailure', async ($, e, next) => {
    const id = e.agent_id
    if (tracking && id) {
      await updateTasks($, (tasks) => {
        const task = tasks[id]
        if (task?.kind === 'agent') tasks[id] = { ...task, reason: failureReason(e.error) }
      })
    }
    return next(e)
  })

  // A background shell: from the main loop, a held agent, or an agent of a
  // running Workflow run (nested quietly under the run whose transcripts hold it).
  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const done = await next(e)
    const id = done.isError ? undefined : done.result?.backgroundTaskId
    if (!tracking || !id) return done
    const agentId = e.agentId
    await updateTasks($, async (tasks, now) => {
      const label = firstLine(e.command)
      const shell: Task = { id, kind: 'shell', type: 'shell', label, status: 'running', startedAt: now }
      if (!agentId || tasks[agentId]) {
        tasks[id] = { ...shell, ...(agentId && { parent: agentId }) }
        return [startedToast(shell)]
      }
      for (const run of Object.values(tasks)) {
        if (run.kind !== 'workflow' || run.status !== 'running' || !run.transcriptDir) continue
        const found = await $.fs.stat(`${run.transcriptDir}/agent-${agentId}.jsonl`).catch(() => undefined)
        if (found) {
          tasks[id] = { ...shell, parent: run.id }
          return
        }
      }
    })
    return done
  })

  on('tool.call', { tool: 'Workflow' }, async ($, e, next) => {
    const done = await next(e)
    const result = done.isError ? undefined : done.result
    if (tracking && result?.taskId) {
      const id = result.taskId
      await updateTasks($, (tasks, now) => {
        const task: Task = {
          id,
          kind: 'workflow',
          type: 'workflow',
          label: result.workflowName ?? 'workflow',
          ...(result.transcriptDir && { transcriptDir: result.transcriptDir }),
          status: 'running',
          startedAt: now,
        }
        tasks[id] = task
        return [startedToast(task)]
      })
    }
    return done
  })

  // The model's TaskStop sends no notification: its result is the kill.
  on('tool.call', { tool: 'TaskStop' }, async ($, e, next) => {
    const done = await next(e)
    const id = done.isError ? undefined : done.result?.task_id
    if (tracking && id) {
      await updateTasks($, (tasks, now) => {
        const task = tasks[id]
        return task?.status === 'running' ? endTask(tasks, task, 'killed', now, true) : undefined
      })
    }
    return done
  })

  on('prompt.submit', { origin: { kind: 'task-notification' } }, async ($, e, next) => {
    if (tracking) await onNotification($, e.text)
    return next(e)
  })

  // A /tasks kill's notification comes only as this row, with the next prompt.
  on('session.append', { door: 'delivery', message: { name: 'queued_command' } }, async ($, e, next) => {
    if (tracking) await onNotification($, textOf(e.message.content))
    return next(e)
  })

  // A subagent's shell reports its end into that subagent's loop, with no
  // `prompt.submit`. The main loop's door-`prompt` rows (the synthetic
  // `stopped` after /resume) carry no `agentId` and stay unread.
  on('session.append', { door: 'prompt', origin: { kind: 'task-notification' } }, async ($, e, next) => {
    if (tracking && e.agentId) await onNotification($, textOf(e.message.content))
    return next(e)
  })

  // /clear and /resume empty `$.state` while running work goes on: the tick
  // merges it into the new session.
  on('session.end', async ($, e, next) => {
    if (e.reason === 'clear' || e.reason === 'resume') effortCarry = (await $.state.get(EFFORT)).value
    if (tracking && (e.reason === 'clear' || e.reason === 'resume')) {
      const { value = {} } = await $.state.get(TASKS)
      carry = Object.fromEntries(Object.entries(value).filter(([, task]) => task.status === 'running'))
    }
    return next(e)
  })

  // MEMORY.md "The Sidebar shows only when docked": watch an always-drawn site
  // and open the pane once the terminal can dock it. The same hook adds the
  // `model · effort` label (MEMORY.md "The line under the prompt").
  on('ui.render', { component: 'SessionMode' }, async ($, e, next) => {
    const viewport = e.viewport
    if (viewport?.isFullscreen === true && viewport.columns >= DOCK_COLUMNS && !checking) {
      checking = true
      $.clock.after(0, async () => {
        try {
          // Open or waiting: the pane is placed, or the engine places it as the terminal widens.
          if (!(await $.ui.panes()).some((pane) => pane.id === SIDEBAR)) {
            await openSidebar($, widthFor(viewport.columns))
          }
        } finally {
          checking = false
        }
      })
    }
    const [{ value: model }, { value: effort }] = await Promise.all([$.state.get(MODEL), $.state.get(EFFORT)])
    if (model === undefined) return next(e)
    const label = promptLabel(model, effort)
    // The line spans the terminal, while `viewport.columns` excludes the dock.
    if (!viewport || fitsPromptLine(hint, label, viewport.columns + dockColumns)) {
      return next({ ...e, props: { ...e.props, modes: [...e.props.modes, label] } })
    }
    return promptLabelRow($.ui.resolve(e), label)
  })

  // The hint's width decides where the label goes. Observe only.
  on('ui.render', { component: 'PromptHint' }, ($, e, next) => {
    if (e.props.hint !== hint) {
      hint = e.props.hint
      redrawLater($)
    }
    return next(e)
  })

  // An open from the person's prompt counts as asked: it docks from 110 columns.
  on('prompt.submit', ($, e, next) => {
    if (waiting && e.origin.kind === 'composer') void openSidebar($, requested ?? widthFor(DOCK_COLUMNS))
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: SIDEBAR }, async ($, e) => {
    const ui = $.ui.resolve(e)
    const dock = e.props.placement === 'inline' ? 0 : e.props.bodyColumns + 1
    if (dock !== dockColumns) {
      dockColumns = dock
      redrawLater($)
    }
    if (e.props.placement === 'inline') {
      $.clock.after(0, () => void $.ui.close({ id: SIDEBAR }))
      return <ui.Box />
    }
    waiting = false
    if (e.viewport) {
      // The viewport here is the transcript's width.
      const columns = widthFor(e.viewport.columns + e.props.bodyColumns + 1)
      if (columns !== requested) {
        requested = columns
        $.clock.after(0, () => void openSidebar($, columns))
      }
    }
    const [folded, expanded, scroll, git, usage, now, mcp, todo, versions, tasks, glass] = await Promise.all([
      $.state.get(FOLDED),
      $.state.get(EXPANDED),
      $.state.get(SCROLL),
      $.state.get(GIT),
      $.state.get(USAGE),
      $.state.get(NOW),
      $.state.get(MCP),
      $.state.get(TODO),
      $.state.get(VERSIONS),
      $.state.get(TASKS),
      $.state.get(GLASS),
    ])
    const drawn = sidebar({
      ui,
      bodyRows: e.props.scroll.bodyRows,
      bodyColumns: e.props.bodyColumns,
      plugins: enabled,
      data: {
        git: git.value,
        usage: usage.value,
        now: now.value,
        mcp: mcp.value,
        todo: todo.value,
        versions: versions.value,
        tasks: tasks.value,
      },
      config,
      ...(await (look ??= themeLook($, config.theme))),
      // Under `inherit`, the active custom `/theme`'s glass, when it has no dock color.
      ...(inherit && glass.value && { background: glass.value }),
      folded: folded.value ?? {},
      expanded: expanded.value ?? {},
      scroll: scroll.value ?? 0,
      onFold: async (id) => {
        const { value = {} } = await $.state.get(FOLDED)
        await $.state.set(FOLDED, { ...value, [id]: !(value[id] ?? config[id].folded ?? false) })
      },
      onExpand: async (id) => {
        const { value = {} } = await $.state.get(EXPANDED)
        await $.state.set(EXPANDED, { ...value, [id]: !value[id] })
      },
    })
    maxScroll = drawn.maxScroll
    return drawn.tree
  })

  // The person can't close the Sidebar; a plugin close passes.
  on('ui.close', { id: SIDEBAR }, ($, e, next) =>
    e.origin.kind === 'person' ? { deny: 'The ctui Sidebar stays open while it is docked' } : next(e),
  )

  // The mod scrolls the sections itself; the engine's window never moves.
  on('ui.scroll', { component: 'Pane', requestId: SIDEBAR }, async ($, e) => {
    const { value = 0 } = await $.state.get(SCROLL)
    const from = Math.min(value, maxScroll)
    const offset = Math.min(Math.max(from + e.by, 0), maxScroll)
    if (offset !== value) await $.state.set(SCROLL, offset)
    return {}
  })
  // Transcript rewrites (docs/spec/v0.1.md slice 8). `ToolResult` stays the engine's.
  // While the Sidebar is docked, the rows ctui draws end `GAP` columns before its rule.
  const dockGap = () => (dockColumns ? GAP : 0)
  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) =>
    assistantMessage($.ui.resolve(e), await next({ ...e, props: { ...e.props, isFirstOfReply: false } }), dockGap()),
  )

  on('ui.render', { component: 'UserMessage' }, ($, e, next) =>
    isOwnPrompt(e.props.origin) ? userMessage($.ui.resolve(e), e.props.text, dockGap()) : next(e),
  )

  // Each call of a group draws as its own `ToolUse` row.
  on('ui.render', { component: 'ToolGroup' }, ($, e, next) => next({ ...e, props: { ...e.props, isExpanded: true } }))

  // The cwd is read here: on `--continue` the transcript draws before `session.start`.
  on('ui.render', { component: 'ToolUse' }, async ($, e, next) => {
    if (!hasToolRow(e.props.tool)) return next(e)
    const line = toolLine(e.props, { cwd: await $.session.cwd(), home: await $.env.get('HOME') })
    return line ? toolRow($.ui.resolve(e), line, dockGap()) : next(e)
  })

  // MEMORY.md "The line under the prompt": the latest effort source wins.
  // A main-loop step's effort is the one sent; absent, the model takes none.
  on('turn.step', async function* ($, e, next) {
    if (e.agentId === undefined) {
      stepModel = e.model
      // A numeric budget has no level to show: the label keeps the last.
      if (typeof e.effort !== 'number') await setEffort($, e.effort ?? null)
    }
    return yield* next(e)
  })

  on('command.run', { command: 'effort' }, async ($, e, next) => {
    const level = e.args.trim()
    if (EFFORT_LEVELS.has(level)) await setEffort($, level)
    return next(e)
  })

  // MEMORY.md "The turn footer: prefix the turn's mode and model to Claude
  // Code's `word`". The mode comes from the main loop's classic events.
  on('classic.UserPromptSubmit', ($, e, next) => {
    noteMode(e)
    return next(e)
  })

  on('classic.Stop', ($, e, next) => {
    noteMode(e)
    return next(e)
  })

  // An aborted turn draws no footer. The next turn names its own model.
  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) {
      const model = stepModel
      stepModel = undefined
      if (e.reason !== 'aborted' && mode && model) {
        const turn = { durationMs: e.durationMs, mode, model }
        lastTurn = { turn, at: await $.clock.now() }
        await addTurn($, turn)
      }
    }
    return next(e)
  })

  // A footer from an earlier process has no record: Claude Code's plain line.
  on('ui.render', { component: 'TurnDuration' }, async ($, e, next) => {
    let turn = turnOf((await $.state.get(TURNS)).value, e.props.durationMs)
    const isFirstDraw = !drawnFooters.has(e.requestId)
    drawnFooters.add(e.requestId)
    // A turn a task notification opened can count from earlier: first drawn
    // right after its turn.complete, the footer is that turn's, kept under its own duration.
    if (!turn && isFirstDraw && lastTurn && (await $.clock.now()) - lastTurn.at < FOOTER_MS) {
      turn = { ...lastTurn.turn, durationMs: e.props.durationMs }
      const alias = turn
      $.clock.after(0, () => void addTurn($, alias))
    }
    return next(turn ? { ...e, props: { ...e.props, word: turnWord(e.props.word, turn) } } : e)
  })

  // MEMORY.md "`/ctui:*` commands stay quiet on success; a bare command opens
  // a picker pane". Each hook answers without `next`: the markdown fallback
  // never reaches the model.
  on('command.run', { command: 'ctui:theme' }, ($, e) => runCommand($, config, 'theme', e.args))
  on('command.run', { command: 'ctui:plugins:enable' }, ($, e) => runCommand($, config, 'enable', e.args))
  on('command.run', { command: 'ctui:plugins:disable' }, ($, e) => runCommand($, config, 'disable', e.args))

  for (const name of Object.keys(PICKERS) as Picker[]) {
    const { id, title } = PICKERS[name]
    on('ui.render', { component: 'Pane', requestId: id }, async ($, e) => {
      const ui = $.ui.resolve(e)
      if (!('Select' in ui)) return <ui.Box />
      const outcome = await outcomeOf($, config, name, '')
      return picker({ ui, key: name, title, ...('pick' in outcome ? outcome.pick : { options: [] }) })
    })

    on('ui.select', { plugin: 'ctui', element: name }, async ($, e, next) => {
      await pick($, config, name, e.value)
      return next(e)
    })
  }
}
