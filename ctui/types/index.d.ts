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

export type Versions = { ctui: string; claude: string }

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

declare module 'claude-code' {
  interface PluginState {
    ctui: {
      folded: Record<string, boolean> // per Sidebar plugin; unset reads <id>_folded
      expanded: Record<string, boolean> // list caps
      scroll: number // Sidebar section offset, in rows
      now?: number // written by the tick while a timer shows
      git?: GitSnapshot
      usage?: Usage
      mcp: McpRow[] // first-seen order
      versions?: Versions
    }
  }
}
