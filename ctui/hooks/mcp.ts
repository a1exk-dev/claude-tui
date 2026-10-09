import type { McpRow } from '../types'

// What the `mcp` Sidebar plugin reads each tick (MEMORY.md "The `mcp` Sidebar
// plugin reads live tools and MCP config names; it never probes").
export type McpInput = {
  rows: readonly McpRow[] // the previous tick's
  tools: readonly { name: string; mcp: boolean }[] // `$.tool.list()`
  disabled: readonly string[] // `disabledMcpServers`, as /mcp names them
  names: Readonly<Record<string, string>> // segment → /mcp name, from `tool.describe`
  now: number
  timeoutMs: number // MCP_TIMEOUT
  sources: McpSources
}

// The `/mcp` names each config source holds (names only: an entry can hold
// secrets), and the source a tool run reported for a server, by segment.
export type McpSources = Record<(typeof SCOPES)[number], readonly string[]> & {
  observed: Readonly<Record<string, string>> // `classic.PostToolUse` `mcp_server.source`
}

// Claude Code's own lookup order for a name's scope.
const SCOPES = ['enterprise', 'managed', 'local', 'project', 'user'] as const

export const NO_SOURCES: McpSources = { enterprise: [], managed: [], local: [], project: [], user: [], observed: {} }

// The tools a server offers before its sign-in.
const AUTH_TOOLS = new Set(['authenticate', 'complete_authentication'])

// A /mcp name as it shows in tool names: `claude.ai Claude Docs` → `claude_ai_Claude_Docs`.
export const segmentOf = (name: string) => name.replace(/[^A-Za-z0-9_-]/g, '_')

// The server a `tool.describe` provider names, as its tool segment and /mcp
// name: `mcp:<name>` for a configured server; `<plugin>@<marketplace>` for a
// plugin's, whose /mcp name is `plugin:<plugin>:<server>`.
export function serverName(tool: string, provider: string): [segment: string, name: string] | undefined {
  const configured = /^mcp:(.+)$/.exec(provider)?.[1]
  if (configured) return [segmentOf(configured), configured]
  const [mcp, segment = ''] = tool.split('__')
  const plugin = /^([^@]+)@/.exec(provider)?.[1]
  const prefix = `plugin_${segmentOf(plugin ?? '')}_`
  if (mcp === 'mcp' && plugin && segment.startsWith(prefix)) {
    return [segment, `plugin:${plugin}:${segment.slice(prefix.length)}`]
  }
}

// Where a server comes from: what a tool run reported, else `claude.ai` or the
// plugin from its name, else the first config source holding it, else
// `dynamic` (`--mcp-config`, which the mod can't read).
function sourceOf(server: string, name: string | undefined, sources: McpSources) {
  const plugin = /^plugin:([^:]+):/.exec(name ?? '')?.[1] ?? /^plugin_([^_]+)_/.exec(server)?.[1]
  const observed = sources.observed[server]
  if (observed) return observed === 'claudeai' ? 'claude.ai' : observed === 'plugin' && plugin ? plugin : observed
  if (name?.startsWith('claude.ai ') || server.startsWith('claude_ai_')) return 'claude.ai'
  if (plugin) return plugin
  return SCOPES.find((scope) => sources[scope].some((held) => segmentOf(held) === server)) ?? 'dynamic'
}

const labelOf = (name: string) => name.replace(/^claude\.ai /, '').replace(/^plugin:[^:]+:/, '')
const labelOfSegment = (segment: string) => segment.replace(/^claude_ai_/, '').replace(/^plugin_[^_]+_/, '')

// The rows A–Z by label, off rows last: servers seen with tools this session
// plus disabled ones. A listed server with no tools connects for `timeoutMs` from
// the tick it lost them or left the disabled list, then reads down.
export function mcpRows({ rows, tools, disabled, names, now, timeoutMs, sources }: McpInput): McpRow[] {
  const offered = new Map<string, string[]>()
  for (const tool of tools) {
    const [, server, name = ''] = tool.mcp ? tool.name.split('__') : []
    if (server) offered.set(server, [...(offered.get(server) ?? []), name])
  }
  const off = new Map(disabled.map((name) => [segmentOf(name), name]))
  const servers = [...new Set([...rows.map((row) => row.server), ...offered.keys(), ...off.keys()])]
  const all: McpRow[] = servers.map((server) => {
    const before = rows.find((row) => row.server === server)
    const name = off.get(server) ?? names[server]
    const label = name ? labelOf(name) : (before?.label ?? labelOfSegment(server))
    const row = { server, label, source: sourceOf(server, name, sources) }
    const toolNames = offered.get(server)
    if (off.has(server)) return { ...row, state: 'off' }
    if (toolNames?.length) {
      return toolNames.every((tool) => AUTH_TOOLS.has(tool))
        ? { ...row, state: 'auth' }
        : { ...row, state: 'ok', tools: toolNames.length }
    }
    if (before?.state === 'down') return { ...row, state: 'down' }
    const since = before?.state === 'connecting' ? (before.since ?? now) : now
    return now - since >= timeoutMs ? { ...row, state: 'down' } : { ...row, state: 'connecting', since }
  })
  return all.sort(
    (a, b) =>
      +(a.state === 'off') - +(b.state === 'off') || a.label.localeCompare(b.label) || a.server.localeCompare(b.server),
  )
}
