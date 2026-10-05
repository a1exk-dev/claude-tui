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

declare module 'claude-code' {
  interface PluginState {
    ctui: {
      folded: Record<string, boolean> // per Sidebar plugin; unset reads <id>_folded
      expanded: Record<string, boolean> // list caps
      scroll: number // Sidebar section offset, in rows
      git?: GitSnapshot
      versions?: Versions
    }
  }
}
