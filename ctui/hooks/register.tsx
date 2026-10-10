import type { EngineInterface, Register } from 'claude-code'

import { plugins, sections } from '../plugins'
import { colors } from '../plugins/colors'
import type { GitSnapshot, Menu, SkillRow, Task, Todo, TodoItem, Turn, Usage } from '../types'
import { type Config, readConfig } from './config'
import { fitsPromptLine, formatReset, modelEffort, promptLabel, savedEffort } from './format'
import { parseGit, tildify } from './git'
import { type McpSources, mcpRows, segmentOf, serverName } from './mcp'
import {
  type Cached,
  COST_PREFIX,
  costKey,
  lastCosts,
  monthOf,
  monthStart,
  monthTotal,
  showsCost,
  staleTranscripts,
  type Transcript,
} from './month'
import { inheritGlass, themeFile } from './glass'
import { addSkill, skillsFromMessages, sourceOf } from './skills'
import { deniedText, HOTKEYS, isMonthlyKey, KEYS, MENU_START, monthlyKey, type Setting, settingKey, settingRows, menuView, moveId, NO_CONFIG, PARENT, rowId, rowKey, takenBy, themeSlug, type ThemeName, topKey, type TopPick, topPick } from './menu'
import { type Control, controlKey, foldRowKey, sidebar, type SidebarInput } from './sidebar'
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
const MONTH = { plugin: 'ctui', key: 'month' } as const
const MCP = { plugin: 'ctui', key: 'mcp' } as const
const MCP_OBSERVED = { plugin: 'ctui', key: 'mcpObserved' } as const
const TODO = { plugin: 'ctui', key: 'todo' } as const
const SKILLS = { plugin: 'ctui', key: 'skills' } as const
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

// The `/ctui` menu's pane, its model, and whether this session already toasted a taken `/ctui`.
const MENU_PANE = 'ctui'
const MENU = { plugin: 'ctui', key: 'menu' } as const
const MENU_TAKEN = { plugin: 'ctui', key: 'menuTaken' } as const

// The enterprise MCP file on Linux and macOS.
const ENTERPRISE_MCP = ['/etc/claude-code/managed-mcp.json', '/Library/Application Support/ClaudeCode/managed-mcp.json']

const GIT_TOOLS = new Set(['Edit', 'Write', 'NotebookEdit', 'Bash'])

// What `/effort <args>` sets for the session.
const EFFORT_LEVELS = new Set(['low', 'medium', 'high', 'xhigh', 'max'])

// The month total rescans this often while the cost row shows.
const SCAN_MS = 60_000

// Toasts come at most this often: the engine drops one within 2 s of the last.
const TOAST_GAP_MS = 2100

// Module state: a reload starts a fresh environment.
let tick: { cancel: () => void } | undefined
let orderTimer: { cancel: () => void } | undefined // the menu's order write, a second after the last move
let gitRunning = false
let gitAgain = false // a refresh came while git ran: run once more after it
let checking = false // a viewport check is queued
let waiting = false // opened unasked and not placed: open again on the person's prompt
let requested: number | undefined // the columns last asked for
let maxScroll = 0 // the sections window's last offset, as last drawn
let monthRunning = false
let lastScan = -Infinity // when the month total last scanned
let mcpRunning = false
let mcpTimeout: number | undefined // MCP_TIMEOUT, read once
// `.claude.json`'s disabled list and its user and local MCP server names.
type ClaudeJson = { path: string; project: string; mtimeMs?: number; disabled: string[]; user: string[]; local: string[] }
let claudeJson: ClaudeJson | undefined
// The approved project, managed and enterprise MCP server names, read at start and on /cd.
let mcpFiles: Pick<McpSources, 'project' | 'managed' | 'enterprise'> = { project: [], managed: [], enterprise: [] }
// The sources tool runs reported, by segment, also kept in `$.state`: a reload
// resets this, `/clear` and `/resume` empty that, and the servers outlive both.
let mcpObserved: Record<string, string> = {}
let cwdMoved = false // since the last MCP tick: drop the old project's off rows
let themeSeen: { path?: string; mtimeMs?: number } = {} // the active custom /theme file, last read
let themeNames: ThemeName[] | undefined // every Theme's slug and name, read once
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

// A hook's answer from its own call: the result alone, so core maps it for this
// call's tool_use_id. A deny or error passes through unchanged.
async function ownCall<R extends { deny?: string; isError?: true; result?: unknown }>(call: Promise<R>): Promise<R> {
  const ran = await call
  return ran.deny !== undefined || ran.isError ? ran : ({ result: ran.result } as R)
}

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

// `/clear` and `/resume` empty `$.state` with no `session.start`: the Sidebar's
// next draw and the tick refill it.
async function refillVersions($: EngineInterface, slug: string) {
  const { value } = await $.state.get(VERSIONS)
  if (!value) await loadVersions($, slug)
}

// `slug` is the `theme` setting; the footer shows the Theme file's `name`, as `/theme` lists it.
async function loadVersions($: EngineInterface, slug: string) {
  const manifest = JSON.parse(await $.fs.read(`${$.plugin.root}/.claude-plugin/plugin.json`))
  const name =
    slug === 'inherit' ? slug : String(JSON.parse(await $.fs.read(`${$.plugin.root}/themes/${slug}.json`)).name)
  const versions = { ctui: String(manifest.version), claude: (await $.session.version()).version, theme: name }
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

// `/clear` and `/resume` empty `$.state` with no `session.start`: the Sidebar's
// next draw and the tick refill it.
async function refillUsage($: EngineInterface) {
  const { value } = await $.state.get(USAGE)
  if (!value) await loadUsage($)
}

// The usage says whether the cost row shows: the month follows it.
async function refillUsageAndMonth($: EngineInterface, monthCost: boolean, choice: Config['limits']['cost']) {
  await refillUsage($)
  if (monthCost) await refreshMonth($, choice)
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

// The main transcripts written since `since`, the current session's left out:
// `<config dir>/projects/<project>/<session id>.jsonl`.
async function listTranscripts($: EngineInterface, since: number, current: string) {
  const dir = (await $.env.get('CLAUDE_CONFIG_DIR')) || `${await $.env.get('HOME')}/.claude`
  const projects = (await $.fs.list(`${dir}/projects`)).filter((entry) => entry.kind === 'dir')
  const lists = await Promise.all(
    projects.map(async ({ name }) => {
      const path = `${dir}/projects/${name}`
      return (await $.fs.list(path)).flatMap(({ name, kind, mtimeMs, size }): Transcript[] => {
        const session = name.endsWith('.jsonl') ? name.slice(0, -'.jsonl'.length) : ''
        return kind === 'file' && session && session !== current && mtimeMs >= since
          ? [{ session, path: `${path}/${name}`, mtimeMs, size }]
          : []
      })
    }),
  )
  return lists.flat()
}

// The ended sessions' cost this month (#147): each transcript's last
// `cost-state`, cached per session in `$.store` so unchanged transcripts aren't
// read again and totals outlive the 30-day transcript sweep. A failed scan
// keeps the cached totals; the next one retries.
async function scanMonth($: EngineInterface) {
  if (monthRunning) return
  monthRunning = true
  try {
    const [now, current] = await Promise.all([$.clock.now(), $.session.id()])
    lastScan = now
    const month = monthOf(now)
    const prefix = costKey(month, '')
    const keys = await $.store.keys()
    const cached: Record<string, Cached> = {}
    for (const key of keys) {
      if (key.startsWith(prefix)) cached[key.slice(prefix.length)] = (await $.store.get(key)) as Cached
      // Earlier months' totals go.
      else if (key.startsWith(COST_PREFIX)) await $.store.delete(key).catch(() => undefined)
    }
    try {
      const stale = staleTranscripts(await listTranscripts($, monthStart(now), current), cached)
      if (stale.length) {
        const grep = ['grep', '-h', '-F', '"type":"cost-state"', '--', ...stale.map((t) => t.path)]
        const { exitCode, stdout, isStdoutTruncated } = await $.process.run(grep)
        // 1 is no line found.
        if (exitCode > 1 || isStdoutTruncated) throw new Error(`grep exited ${exitCode}`)
        const costs = lastCosts(stdout)
        for (const { session, mtimeMs, size } of stale) {
          const entry = { usd: costs[session] ?? 0, mtimeMs, size }
          await $.store.set(costKey(month, session), entry)
          cached[session] = entry
        }
      }
    } catch {
      // Failed: the cached totals stand until the next scan.
    }
    const total = { month, session: current, usd: monthTotal(cached, current) }
    const { value } = await $.state.get(MONTH)
    if (JSON.stringify(value) !== JSON.stringify(total)) await $.state.set(MONTH, total)
  } catch {
    // The store can't be read: the last total stands.
  } finally {
    monthRunning = false
  }
}

// Scans while the cost row shows: once the usage says it does, each SCAN_MS,
// at the local month's turn, and when `/clear` or `/resume` changed the
// session, a scan running across the switch included.
async function refreshMonth($: EngineInterface, choice: Config['limits']['cost']) {
  const [usage, total, now] = await Promise.all([$.state.get(USAGE), $.state.get(MONTH), $.clock.now()])
  if (!showsCost(usage.value, choice)) return
  const session = await $.session.id()
  const value = total.value
  if (!value || value.month !== monthOf(now) || value.session !== session || now - lastScan >= SCAN_MS) {
    await scanMonth($)
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

// `projects[<project>].disabledMcpServers`, and the user (`mcpServers`) and
// local (`projects[<project>].mcpServers`) server names, re-read when the
// file's mtime changes. Claude Code keeps the file in CLAUDE_CONFIG_DIR when that is set.
async function readClaudeJson($: EngineInterface) {
  const dir = (await $.env.get('CLAUDE_CONFIG_DIR')) || (await $.env.get('HOME'))
  claudeJson ??= { path: `${dir}/.claude.json`, project: await projectOf($), disabled: [], user: [], local: [] }
  const file = claudeJson
  const stat = await $.fs.stat(file.path).catch(() => undefined)
  if (stat?.mtimeMs !== file.mtimeMs) {
    try {
      const json = stat ? JSON.parse(await $.fs.read(file.path)) : {}
      const project = json.projects?.[file.project]
      file.disabled = project?.disabledMcpServers ?? []
      file.user = Object.keys(json.mcpServers ?? {})
      file.local = Object.keys(project?.mcpServers ?? {})
      file.mtimeMs = stat?.mtimeMs
    } catch {
      // Caught mid-write: the next tick reads it again.
    }
  }
  return file
}

// The server names in an `{ mcpServers }` file, never their entries (they can hold secrets).
async function serverNames($: EngineInterface, path: string) {
  try {
    return Object.keys(JSON.parse(await $.fs.read(path)).mcpServers ?? {})
  } catch {
    return [] // No such file.
  }
}

// MEMORY.md "The `mcp` Sidebar plugin reads live tools and MCP config names;
// it never probes": the approved project servers in `.mcp.json` from the cwd
// up to (not including) `/`, the policy's `managedMcpServers`, and the
// enterprise `managed-mcp.json`.
async function readMcpFiles($: EngineInterface, cwd?: string) {
  const [dir0, settings, policy] = await Promise.all([
    cwd ?? $.session.cwd(),
    $.settings.read() as Promise<Record<string, unknown>>,
    $.settings.read({ source: 'policy' }) as Promise<Record<string, unknown>>,
  ])
  const dirs: string[] = []
  for (let dir = dir0; dir; dir = dir.slice(0, dir.lastIndexOf('/'))) dirs.push(dir)
  const listed = (key: string) => (Array.isArray(settings[key]) ? (settings[key] as string[]) : [])
  const approved = (name: string) =>
    !listed('disabledMcpjsonServers').includes(name) &&
    (settings.enableAllProjectMcpServers === true || listed('enabledMcpjsonServers').includes(name))
  const [project, enterprise] = await Promise.all([
    Promise.all(dirs.map((dir) => serverNames($, `${dir}/.mcp.json`))),
    Promise.all(ENTERPRISE_MCP.map((path) => serverNames($, path))),
  ])
  const managed = policy.managedMcpServers
  mcpFiles = {
    project: project.flat().filter(approved),
    managed: managed && typeof managed === 'object' && !Array.isArray(managed) ? Object.keys(managed) : [],
    enterprise: enterprise.flat(),
  }
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

// MEMORY.md "The `mcp` Sidebar plugin reads live tools and MCP config names; it never probes".
async function refreshMcp($: EngineInterface) {
  if (mcpRunning) return
  mcpRunning = true
  try {
    mcpTimeout ??= Number(await $.env.get('MCP_TIMEOUT')) || 30_000
    const moved = cwdMoved
    cwdMoved = false
    const [tools, file, now, { value: rows = [] }, { value: observed = {} }] = await Promise.all([
      $.tool.list(),
      readClaudeJson($),
      $.clock.now(),
      $.state.get(MCP),
      $.state.get(MCP_OBSERVED),
    ])
    const kept = moved ? rows.filter((row) => row.state !== 'off') : rows
    const sources = { ...mcpFiles, user: file.user, local: file.local, observed: { ...mcpObserved, ...observed } }
    const next = mcpRows({ rows: kept, tools, disabled: file.disabled, names: mcpNames, now, timeoutMs: mcpTimeout, sources })
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

// The task tools `todo_tools` keeps out of ToolSearch; TaskList, TaskGet and TaskStop stay deferred.
const PINNED_TASK_TOOLS = new Set(['TaskCreate', 'TaskUpdate', 'TodoWrite'])

// The `ctui:todo` section, as tested live in #220, naming the tools the request offers.
const taskSection = (create: string, update: string) => `# Task list
The user follows your progress in a task list shown beside the conversation. For any request that needs 2 or more distinct steps (edits, fixes, checks, delegated agents), your first action is to create one task per step with ${create}, before reading files or delegating. Set each task in_progress with ${update} when you start it and completed as soon as it is done. Skip the list only for a single-step request or a pure question.`

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

// Folds or unfolds a section, or expands or caps its list.
async function toggle($: EngineInterface, config: Config, { kind, id }: Control) {
  if (kind === 'fold') {
    const { value = {} } = await $.state.get(FOLDED)
    await $.state.set(FOLDED, { ...value, [id]: !(value[id] ?? config[id].folded ?? false) })
  } else {
    const { value = {} } = await $.state.get(EXPANDED)
    await $.state.set(EXPANDED, { ...value, [id]: !value[id] })
  }
}

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

// `claude -p` and the SDK list no `ctui.theme` row, and `$.config.set` throws there.
async function hasConfig($: EngineInterface) {
  return (await $.config.list()).some((row) => row.key === 'ctui.theme')
}

// MEMORY.md "`/ctui` is one instant menu; it survives each settings reload".
// The name is global: a person's own `/ctui` or an earlier plugin's makes `register` throw.
async function registerMenu($: EngineInterface) {
  try {
    await $.command.register({ name: 'ctui', description: 'ctui: Sidebar plugins and themes', immediate: true })
  } catch (error) {
    // A taken name reads `"/ctui" refused: …`.
    const refusal = error instanceof Error ? error.message : String(error)
    if (!refusal.includes('refused') || (await $.state.get(MENU_TAKEN)).value) return
    await $.state.set(MENU_TAKEN, true)
    const who = takenBy(refusal)
    showToast($, { id: 'menu-taken', end: true, text: `/ctui is taken by ${who}; change ctui settings in /config` }, true)
  }
}

// Opens the menu with the keys: a first open, or one taking them back after Esc's deny.
async function openMenu($: EngineInterface) {
  // As wide as the Sidebar it docks over; inline ignores it, and fits the
  // menu's content up to `rows`.
  await $.ui.open({ id: MENU_PANE, title: 'Settings', focus: true, closeOnEscape: true, columns: requested ?? widthFor(DOCK_COLUMNS), rows: 24 })
}

async function menuOf($: EngineInterface): Promise<Menu> {
  return (await $.state.get(MENU)).value ?? MENU_START
}

async function setMenu($: EngineInterface, menu: Menu) {
  await $.state.set(MENU, menu)
}

// One menu write; a deny toasts its line (a menu pick has no command row),
// through the queue even with `agents_toasts` off.
async function writeSetting($: EngineInterface, set: Setting) {
  const { deny } = await $.config.set(set)
  if (deny !== undefined) showToast($, { id: 'menu-deny', end: true, text: deniedText(set, deny) }, true)
  return deny === undefined
}

// Puts the menu's ring on `key` once the redraw has drawn it, as #160's spike
// did: 50 ms on, or `ms` to follow another move.
function focusLater($: EngineInterface, key: string, ms = 50) {
  $.clock.after(ms, () => $.ui.focus({ requestId: MENU_PANE, key }).catch(() => undefined))
}

// Writes an order the Plugins screen moved, if one waits. Its reload drops
// the module's timer, so every other write, Esc and the close call this first.
// The rows keep the pending order until the write lands; the reload's
// `session.start` then drops it.
async function flushOrder($: EngineInterface) {
  orderTimer?.cancel()
  orderTimer = undefined
  const { pending } = await menuOf($)
  if (!pending) return
  await writeSetting($, { key: 'ctui.order', value: pending.join(',') })
  const { pending: _, ...menu } = await menuOf($)
  await setMenu($, menu)
}

async function themeNamesOf($: EngineInterface) {
  const slugs = await themesOf($)
  themeNames ??= await Promise.all(
    slugs.map(async (slug) =>
      slug === 'inherit'
        ? { slug, name: slug }
        : { slug, name: String(JSON.parse(await $.fs.read(`${$.plugin.root}/themes/${slug}.json`)).name) },
    ),
  )
  return themeNames
}

// MEMORY.md "The `skills` Sidebar plugin lists every `skill.prompt`": the
// skill listing and the command list name each skill's source.
async function skillCatalog($: EngineInterface) {
  const [usage, commands] = await Promise.all([$.session.usage({ breakdown: 'summary' }), $.command.list()])
  return { listed: usage.context.breakdown?.skills?.skillFrontmatter ?? [], commands }
}

let skillsChain: Promise<unknown> = Promise.resolve() // one list write at a time

// Runs `write` after the list's earlier writes, so a rebuild and a
// `skill.prompt` never race.
function writeSkills(write: () => Promise<void>) {
  const run = skillsChain.then(write)
  skillsChain = run.catch(() => undefined)
  return run
}

// A `skill.prompt`'s skill, once; a skill already listed reads nothing more.
function addSkills($: EngineInterface, name: string) {
  return writeSkills(async () => {
    const { value = [] } = await $.state.get(SKILLS)
    if (value.some((row) => row.name === name)) return
    const { listed, commands } = await skillCatalog($)
    await $.state.set(SKILLS, [...addSkill(value, { name, source: sourceOf(name, listed, commands) })])
  })
}

// After `--resume` (a new process) and `/resume` or `/clear` (`$.state`
// emptied), rebuild the list from the transcript's main rows; a reload keeps it.
function refillSkills($: EngineInterface) {
  return writeSkills(async () => {
    if ((await $.state.get(SKILLS)).value) return
    const [{ listed, commands }, messages] = await Promise.all([skillCatalog($), $.session.messages()])
    const known = new Set([
      ...listed.map((skill) => skill.name),
      ...commands.filter((command) => command.source !== 'builtin').map((command) => command.name),
    ])
    const names = skillsFromMessages(messages, known)
    let rows: readonly SkillRow[] = []
    for (const name of names) rows = addSkill(rows, { name, source: sourceOf(name, listed, commands) })
    await $.state.set(SKILLS, [...rows])
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

// A change of the dock's columns redraws what fits around it.
function setDock($: EngineInterface, dock: number) {
  if (dock !== dockColumns) {
    dockColumns = dock
    redrawLater($)
  }
}

async function openSidebar($: EngineInterface, columns: number) {
  requested = columns
  const opened = await $.ui.open({ id: SIDEBAR, title: 'Sidebar', columns })
  waiting = !opened.isPlaced
  if (waiting) setDock($, 0)
}

export const register: Register = (on, options) => {
  const config = readConfig(options)
  // The sections in the `order` setting's order; the Sidebar places the header and footer by slot.
  const enabled = plugins
    .filter((plugin) => config[plugin.id].enable)
    .sort((a, b) => config.order.indexOf(a.id) - config.order.indexOf(b.id))
  const needs = new Set(enabled.flatMap((plugin) => plugin.needs))
  // Tasks feed the Sidebar section and the toasts.
  const tracking = needs.has('tasks') || config.agents.toasts
  toastsOn = config.agents.toasts
  const inherit = config.theme === 'inherit'
  let look: ReturnType<typeof themeLook> | undefined // read once per load: a `theme` change reloads

  on('session.start', async ($, e, next) => {
    void registerMenu($).catch(() => undefined)
    // A reload from elsewhere (`/config`) drops the order timer: start it again.
    const { pending, ...menu } = await menuOf($)
    if (pending?.join(',') === config.order.join(',')) await setMenu($, menu)
    else if (pending) {
      orderTimer?.cancel()
      orderTimer = $.clock.after(1000, () => flushOrder($))
    }
    await setTodoEnv($, config.todo.tools)
    // `tool.describe` answers are cached for the session: re-ask them, so the pin follows `todo_tools`.
    $.ui.invalidate('tool.describe')
    void refreshModel($).catch(() => undefined)
    if (needs.has('todo')) void loadTodo($)
    if (needs.has('skills')) void refillSkills($).catch(() => undefined)
    if (needs.has('git')) void refreshGit($)
    if (needs.has('mcp')) void readMcpFiles($).catch(() => undefined)
    if (needs.has('versions')) void loadVersions($, config.theme)
    if (needs.has('usage')) {
      void loadUsage($).then(() => {
        if (needs.has('now')) void setNow($)
        if (needs.has('monthCost')) void refreshMonth($, config.limits.cost).catch(() => undefined)
      })
    }
    if (inherit) void refreshGlass($).catch(() => undefined)
    let ticks = 0
    tick?.cancel()
    tick = $.clock.every(1000, () => {
      ticks++
      void refreshModel($).catch(() => undefined)
      if (ticks % 5 === 0 && needs.has('git')) void refreshGit($)
      if (needs.has('usage')) void refillUsageAndMonth($, needs.has('monthCost'), config.limits.cost).catch(() => undefined)
      if (needs.has('versions')) void refillVersions($, config.theme)
      if (needs.has('mcp')) void refreshMcp($)
      if (needs.has('todo')) void refreshTodo($)
      if (needs.has('skills')) void refillSkills($).catch(() => undefined)
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

  // Names a server's row as /mcp does, and with Task tools on keeps the tools
  // that start and move a list in the prompt, so their own text nudges Claude to keep one.
  on('tool.describe', async ($, e, next) => {
    const [segment, name] = serverName(e.tool, e.provider.plugin) ?? []
    if (segment && name) mcpNames[segment] = name
    if (config.todo.tools && PINNED_TASK_TOOLS.has(e.tool)) return { ...(await next(e)), isDeferred: false }
    return next(e)
  })

  // With Task tools on, tells Claude the user follows a task list. Pure: it
  // also runs for /context's measuring render.
  on('prompt.compose', async ($, e, next) => {
    const answer = await next(e)
    if (!config.todo.tools) return answer
    const text = e.tools.includes('TaskCreate')
      ? taskSection('TaskCreate', 'TaskUpdate')
      : e.tools.includes('TodoWrite')
        ? taskSection('TodoWrite', 'TodoWrite')
        : undefined
    return text ? { sections: [...answer.sections, { id: 'ctui:todo', text, scope: 'session' }] } : answer
  })

  // After /cd the disabled list is another project's: re-derive its key, and
  // drop the off rows the old list made. Observe only.
  on('classic.CwdChanged', ($, e, next) => {
    claudeJson = undefined
    cwdMoved = true
    // Another directory's servers of the same names may come from elsewhere.
    mcpObserved = {}
    if (needs.has('mcp')) {
      void $.state.set(MCP_OBSERVED, {}).catch(() => undefined)
      void readMcpFiles($, e.new_cwd).catch(() => undefined)
    }
    return next(e)
  })

  // A run of a server's tool names its source; it corrects the guess. Observe only.
  on('classic.PostToolUse', async ($, e, next) => {
    if (needs.has('mcp') && e.mcp_server) {
      const { name, source } = e.mcp_server
      const server = segmentOf(name)
      mcpObserved = { ...mcpObserved, [server]: source }
      const { value = {} } = await $.state.get(MCP_OBSERVED)
      if (value[server] !== source) await $.state.set(MCP_OBSERVED, { ...value, [server]: source })
    }
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    try {
      return await next(e)
    } finally {
      if (needs.has('git') && GIT_TOOLS.has(e.tool)) void refreshGit($)
    }
  })

  // While the Sidebar is docked with Todo on, a main-loop task call runs as ctui's
  // own `$.tool.call`: the tool's `set_expanded_view` progress never reaches the
  // REPL, so Claude Code's own list stays closed. It runs here, not in a hook of
  // its own, since ctui's own call skips ctui's `tool.call` hooks.
  const hidesList = (agentId: string | undefined) => agentId === undefined && dockColumns > 0 && needs.has('todo')

  // A task tool's call reloads the list.
  on('tool.call', { tool: 'TaskCreate' }, async ($, e, next) => {
    const done = hidesList(e.agentId) ? await ownCall($.tool.call(e)) : await next(e)
    if (needs.has('todo') && done.result && !done.isError) {
      await keepActiveForm($, done.result.task.id, e.activeForm)
      void loadTodo($)
    }
    return done
  })

  on('tool.call', { tool: 'TaskUpdate' }, async ($, e, next) => {
    const done = hidesList(e.agentId) ? await ownCall($.tool.call(e)) : await next(e)
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

  // Every invocation, whoever made it: typed, the Skill tool (a subagent's
  // too), a fork, a preload, a markdown command. Observe only.
  on('skill.prompt', ($, e, next) => {
    if (needs.has('skills')) void addSkills($, e.skill).catch(() => undefined)
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
          const pane = (await $.ui.panes()).find((pane) => pane.id === SIDEBAR)
          // Closed or waiting, it isn't docked, and its last docked columns go.
          if (!pane?.isPlaced) setDock($, 0)
          if (!pane) await openSidebar($, widthFor(viewport.columns))
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
    if (!('Client' in ui)) return <ui.Box />
    setDock($, e.props.placement === 'inline' ? 0 : e.props.bodyColumns + 1)
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
    const [folded, expanded, scroll, git, usage, month, now, mcp, todo, skills, versions, tasks, glass] = await Promise.all([
      $.state.get(FOLDED),
      $.state.get(EXPANDED),
      $.state.get(SCROLL),
      $.state.get(GIT),
      $.state.get(USAGE),
      $.state.get(MONTH),
      $.state.get(NOW),
      $.state.get(MCP),
      $.state.get(TODO),
      $.state.get(SKILLS),
      $.state.get(VERSIONS),
      $.state.get(TASKS),
      $.state.get(GLASS),
    ])
    // After `/clear` the engine redraws at once; the tick would refill up to 1 s later.
    if (needs.has('usage') && !usage.value) {
      $.clock.after(0, () => void refillUsageAndMonth($, needs.has('monthCost'), config.limits.cost).catch(() => undefined))
    }
    if (needs.has('versions') && !versions.value) $.clock.after(0, () => void refillVersions($, config.theme).catch(() => undefined))
    const drawn = sidebar({
      ui,
      bodyRows: e.props.scroll.bodyRows,
      bodyColumns: e.props.bodyColumns,
      plugins: enabled,
      data: {
        git: git.value,
        usage: usage.value,
        monthCost: month.value?.usd,
        now: now.value,
        mcp: mcp.value,
        todo: todo.value,
        skills: skills.value,
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
      focused: e.props.isFocused,
      onControl: (control) => void toggle($, config, control),
    })
    maxScroll = drawn.maxScroll
    return drawn.tree
  })

  // A fold arrow's or a list toggle's click (`press.tsx`), or a title row's
  // (`foldrow.tsx`), by its key.
  const controls = new Map<string, Control>(
    enabled
      .filter((plugin) => plugin.slot === 'section')
      .flatMap((plugin) => {
        const fold: Control = { kind: 'fold', id: plugin.id }
        const more: Control = { kind: 'more', id: plugin.id }
        return [[controlKey(fold), fold], [controlKey(more), more], [foldRowKey(plugin.id), fold]] as const
      }),
  )
  on('ui.message', { component: 'Pane', requestId: SIDEBAR }, async ($, e) => {
    const control = controls.get(e.element)
    if (control) await toggle($, config, control)
    return {}
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

  // MEMORY.md "`/ctui` is one instant menu; it survives each settings reload".
  // Text after `/ctui` is ignored: `/config` is the way to type a value.
  on('command.run', { command: 'ctui' }, async ($) => {
    if (!(await hasConfig($))) return { text: NO_CONFIG }
    await flushOrder($)
    await setMenu($, MENU_START)
    await openMenu($)
    return {}
  })

  on('ui.render', { component: 'Pane', requestId: MENU_PANE }, async ($, e) => {
    const ui = $.ui.resolve(e)
    if (!('Input' in ui)) return <ui.Box />
    const menu = await menuOf($)
    const plugins = (menu.pending ?? config.order).flatMap((id) => {
      const plugin = sections.find((section) => section.id === id)
      return plugin ? [{ id: plugin.id, title: plugin.title, enable: config[plugin.id].enable, folded: config[plugin.id].folded ?? false }] : []
    })
    const open = sections.find((section) => section.id === menu.focus)
    const { value: glass } = await $.state.get(GLASS)
    return menuView({
      ui,
      // The Sidebar's roles and background.
      ...(await (look ??= themeLook($, config.theme))),
      ...(inherit && glass && { background: glass }),
      placement: e.props.placement,
      bodyRows: e.props.scroll.bodyRows,
      bodyColumns: e.props.bodyColumns,
      menu,
      themes: await themeNamesOf($),
      theme: config.theme,
      plugins,
      settings: open ? settingRows(open.id, config) : [],
      ...(open?.id === 'limits' && { monthly: config.limits.monthly }),
    })
  })

  // The ring is tracked so a redraw and a reload keep it; on a Plugins row it
  // names the plugin `x`, `k` and `j` act on. The hidden hotkeys never take
  // it, so Down stops on the last row. Each hook lets the element's handler
  // run before a write redraws it away.
  on('ui.focus', { component: 'Pane', requestId: MENU_PANE }, async ($, e, next) => {
    if (e.element && HOTKEYS.includes(e.element)) return { deny: 'The ring stays on the rows' }
    const result = await next(e)
    const id = rowId(e.element)
    const menu = await menuOf($)
    if (menu.ring !== e.element || (id && menu.focus !== id)) await setMenu($, { ...menu, ring: e.element, ...(id && { focus: id }) })
    return result
  })

  // Enter on a top row opens its screen. Enter on a Theme row writes it at
  // once; the reload keeps the menu, its level and filter in `$.state`.
  // Enter on a Plugins row opens its plugin's screen, even when it's off; `x`
  // flips it, saving at once; `k`/`j` move it, saving the order a second
  // after the last move, and keep the ring on it. On a plugin's screen,
  // Enter on a setting writes its next value.
  on('ui.press', { component: 'Pane', requestId: MENU_PANE }, async ($, e, next) => {
    const result = await next(e)
    const menu = await menuOf($)
    const order = menu.pending ?? config.order
    const id = menu.focus ?? order[0]
    const row = rowId(e.element)
    const top = topPick(e.element)
    const slug = themeSlug(e.element)
    if (top) {
      const { ring: _, ...rest } = menu
      await setMenu($, { ...rest, level: top, filter: '', picks: { ...menu.picks, top } })
      // The ring keeps its index from the top level: start it on the filter.
      if (top === 'themes') focusLater($, KEYS.filter)
    } else if (slug) {
      if (slug !== config.theme) await writeSetting($, { key: 'ctui.theme', value: slug })
    } else if (row) {
      const { ring: _, ...rest } = menu
      await setMenu($, { ...rest, level: 'plugin', focus: row })
      // The ring keeps its place from the list: start it on the first setting.
      const opened = sections.find((plugin) => plugin.id === row)
      const [setting] = opened ? settingRows(opened.id, config) : []
      if (setting) focusLater($, settingKey(setting.option))
    } else if (e.element === KEYS.toggle && id) {
      await flushOrder($)
      const section = sections.find((plugin) => plugin.id === id)
      if (section) await writeSetting($, { key: `ctui.${id}_enable`, value: !config[section.id].enable })
    } else if (menu.level === 'plugin' && id) {
      // A setting row. `Start folded` sets where a new session starts: pin
      // the section's fold now, so the reload doesn't change it.
      const section = sections.find((plugin) => plugin.id === id)
      const setting = section && settingRows(section.id, config).find(({ option }) => settingKey(option) === e.element)
      if (section && setting) {
        if (setting.option === `${section.id}_folded`) {
          const { value = {} } = await $.state.get(FOLDED)
          if (value[section.id] === undefined) await $.state.set(FOLDED, { ...value, [section.id]: config[section.id].folded ?? false })
        }
        await flushOrder($)
        await writeSetting($, { key: `ctui.${setting.option}`, value: setting.next })
      }
    } else if ((e.element === KEYS.up || e.element === KEYS.down) && id) {
      const moved = moveId(order, id, e.element === KEYS.up ? -1 : 1)
      if (moved.join(',') === order.join(',')) return result // at an end
      await setMenu($, { ...menu, focus: id, pending: moved })
      orderTimer?.cancel()
      orderTimer = $.clock.after(1000, () => flushOrder($))
      focusLater($, rowKey(id))
    }
    return result
  })

  // Limits' Monthly cost saves a number on Enter. Text that isn't one, or a
  // value the engine denies, toasts; the redraw shows the saved value again.
  on('ui.input', { component: 'Pane', requestId: MENU_PANE }, async ($, e, next) => {
    const result = await next(e)
    if (!isMonthlyKey(e.element) || e.kind !== 'submit') return result
    const text = e.value.trim()
    const value = Number(text)
    const set = { key: 'ctui.limits_cost_monthly', value }
    let saved = false
    if (text === '' || !Number.isFinite(value)) {
      showToast($, { id: 'menu-deny', end: true, text: deniedText(set, `"${e.value}" isn't a number`) }, true)
    } else if (value !== config.limits.monthly) {
      await flushOrder($)
      saved = await writeSetting($, set)
    }
    // A save reloads and draws the new value; otherwise a new field shows the saved one.
    // The ring leaves for Cost and comes back after it, at #240's probe timing,
    // so the engine puts the cursor after the value, not where the text ended.
    if (!saved) {
      const menu = await menuOf($)
      const entry = (menu.entry ?? 0) + 1
      await setMenu($, { ...menu, entry })
      focusLater($, settingKey('limits_cost'))
      focusLater($, monthlyKey(entry), 150)
    }
    return result
  })

  on('ui.input', { plugin: 'ctui', element: KEYS.filter }, async ($, e, next) => {
    const result = await next(e)
    if (e.kind === 'change') await setMenu($, { ...(await menuOf($)), filter: e.value })
    return result
  })

  // Esc in a submenu goes back a level: the deny keeps the pane but hands the
  // keys to the prompt, so the menu opens again to take them. At the top it closes.
  // An order still waiting is written first, on the way back or out.
  on('ui.close', { id: MENU_PANE }, async ($, e, next) => {
    const menu = await menuOf($)
    const up = PARENT[menu.level]
    if (e.origin.kind !== 'person' || !up) {
      const result = await next(e)
      $.clock.after(0, () => flushOrder($))
      return result
    }
    // The ring goes back to the row just left.
    const ring = up === 'top' ? topKey(menu.level as TopPick) : menu.focus && rowKey(menu.focus)
    await setMenu($, { ...menu, level: up, filter: '', ring })
    // Take the keys back first: the order's write reloads the mod, and an
    // open from the old module after that is lost (live, 2.1.292). The ring
    // keeps its index through the redraw and the open, so move it too.
    $.clock.after(0, async () => {
      await openMenu($)
      if (ring) focusLater($, ring)
      await flushOrder($)
    })
    return { deny: 'Back one level in the ctui menu' }
  })
}
