import type { EngineInterface, Register } from 'claude-code'

import { plugins } from '../plugins'
import type { GitSnapshot, Todo, TodoItem, Usage } from '../types'
import { readConfig } from './config'
import { formatReset } from './format'
import { parseGit, tildify } from './git'
import { mcpRows, segmentOf } from './mcp'
import { sidebar } from './sidebar'

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

// The dock docks from 110 terminal columns; the Sidebar asks 42, or 53 from 160.
const DOCK_COLUMNS = 110
const widthFor = (terminalColumns: number) => (terminalColumns >= 160 ? 53 : 42)

const GIT_TOOLS = new Set(['Edit', 'Write', 'NotebookEdit', 'Bash'])

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
const mcpNames: Record<string, string> = {} // segment → /mcp name, from `tool.describe`
let todoRunning = false
let todoAgain = false // a reload came while one ran: run once more after it

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

async function openSidebar($: EngineInterface, columns: number) {
  requested = columns
  const opened = await $.ui.open({ id: SIDEBAR, title: 'Sidebar', columns })
  waiting = !opened.isPlaced
}

export const register: Register = (on, options) => {
  const config = readConfig(options)
  const enabled = plugins.filter((plugin) => config[plugin.id].enable)
  const needs = new Set(enabled.flatMap((plugin) => plugin.needs))

  on('session.start', async ($, e, next) => {
    await setTodoEnv($, config.todo.tools)
    if (needs.has('todo')) void loadTodo($)
    if (needs.has('git')) void refreshGit($)
    if (needs.has('versions')) void loadVersions($)
    if (needs.has('usage')) void loadUsage($).then(() => (needs.has('now') ? setNow($) : undefined))
    let ticks = 0
    tick?.cancel()
    tick = $.clock.every(1000, () => {
      ticks++
      if (ticks % 5 === 0 && needs.has('git')) void refreshGit($)
      if (needs.has('usage')) void refillUsage($)
      if (needs.has('mcp')) void refreshMcp($)
      if (needs.has('todo')) void refreshTodo($)
      if (needs.has('now')) void setNow($)
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

  // MEMORY.md "The Sidebar shows only when docked": watch an always-drawn site
  // and open the pane once the terminal can dock it. Observe only.
  on('ui.render', { component: 'SessionMode' }, ($, e, next) => {
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
    return next(e)
  })

  // An open from the person's prompt counts as asked: it docks from 110 columns.
  on('prompt.submit', ($, e, next) => {
    if (waiting && e.origin.kind === 'composer') void openSidebar($, requested ?? widthFor(DOCK_COLUMNS))
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: SIDEBAR }, async ($, e) => {
    const ui = $.ui.resolve(e)
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
    const [folded, expanded, scroll, git, usage, now, mcp, todo, versions] = await Promise.all([
      $.state.get(FOLDED),
      $.state.get(EXPANDED),
      $.state.get(SCROLL),
      $.state.get(GIT),
      $.state.get(USAGE),
      $.state.get(NOW),
      $.state.get(MCP),
      $.state.get(TODO),
      $.state.get(VERSIONS),
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
      },
      config,
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
}
