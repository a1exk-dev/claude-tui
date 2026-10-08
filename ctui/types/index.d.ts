// ctui's $.state contract (docs/spec/v0.1.md). It survives a reload; /clear
// and /resume empty it.

// The git header's rows from a repo; `ahead` and `behind` only with an upstream.
export type GitRepo = {
  branch: string // the branch, or the short sha when detached
  ahead?: number
  behind?: number
  staged: number
  modified: number // conflicts count here
  untracked: number
  stashes: number
  added: number
  removed: number
}

// `repo` is absent outside a repo.
export type GitSnapshot = { path: string; repo?: GitRepo }

// `theme` is the selected Theme file's `name`, or `inherit`.
export type Versions = { ctui: string; claude: string; theme: string }

// `$.session.usage()`'s figures, as `session.measure` pushes them. The
// contract is self-contained, so the engine's types are restated here.
export type Usage = {
  context: { tokens?: number; window: number; percent?: number } // tokens and percent absent before the first response
  rateLimits: { kind: string; percentUsed: number; resetsAt?: string }[] // empty off a subscription
  cost?: { usd: number }
}

// One MCP server row: `tools` with `ok`, `since` (when it started) with `connecting`.
export type McpRow = {
  server: string // the tool-name segment, `mcp__<server>__<tool>`
  label: string
  state: 'ok' | 'auth' | 'connecting' | 'down' | 'off'
  tools?: number
  since?: number
}

// One todo row: a Task tool task (`id` set) or a `TodoWrite` todo.
export type TodoItem = {
  id?: string
  subject: string
  status: 'pending' | 'in_progress' | 'completed'
  activeForm?: string // shown while in progress
}

// The list and which tools feed it: `none` when the session has no task tools.
export type Todo = { tools: 'task' | 'todowrite' | 'none'; items: TodoItem[] }

// A subagent, background shell or Workflow run the `agents` Sidebar plugin
// draws and the toasts report.
export type Task = {
  id: string // agentId, backgroundTaskId or Workflow taskId
  kind: 'agent' | 'shell' | 'workflow'
  type: string // subagentType, 'shell' or 'workflow'
  label: string // description, the command's first line, or workflowName
  parent?: string // parent agent id or Workflow taskId: draws └
  transcriptDir?: string // workflow only
  status: string // running | completed | failed | killed | other engine words
  startedAt: number // $.clock.now()
  endedAt?: number
  reason?: string // short failure reason
  listed?: string // agent only: the status $.agent.list() last gave
}

// A finished main-loop turn, matched to its footer by `durationMs`.
export type Turn = { durationMs: number; mode: string; model: string }

declare module 'claude-code' {
  interface PluginState {
    ctui: {
      folded: Record<string, boolean> // per Sidebar plugin; unset reads <id>_folded
      expanded: Record<string, boolean> // list caps
      scroll: number // Sidebar section offset, in rows
      now?: number // written by the tick while a timer shows
      git?: GitSnapshot
      usage?: Usage
      month?: { month: string; session: string; usd: number } // the ended sessions' cost in the local month `2026-10`, the current session left out
      mcp: McpRow[] // first-seen order
      todo?: Todo
      activeForms: Record<string, string> // Task id → activeForm, from TaskCreate/TaskUpdate inputs
      todoEnvSet?: boolean // ctui set CLAUDE_CODE_ENABLE_TODO_TOOLS
      versions?: Versions
      tasks: Record<string, Task>
      model?: string // $.session.model(), from the tick
      effort?: string | null // the session's effort; null when the model takes none
      turns: Turn[] // every finished turn of the session: old footers redraw on scroll
      glass?: string | null // under `inherit`, the active custom /theme's glass; null or unset paints nothing
    }
  }
}
