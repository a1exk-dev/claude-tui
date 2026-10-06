import type { McpRow } from '../types'

// What the `mcp` Sidebar plugin reads each tick (MEMORY.md "The `mcp` Sidebar
// plugin reads live tools and the disabled list; it never probes").
export type McpInput = {
  rows: readonly McpRow[] // the previous tick's
  tools: readonly { name: string; mcp: boolean }[] // `$.tool.list()`
  disabled: readonly string[] // `disabledMcpServers`, as /mcp names them
  names: Readonly<Record<string, string>> // segment → /mcp name, from `tool.describe`
  now: number
  timeoutMs: number // MCP_TIMEOUT
}

// The tools a server offers before its sign-in.
const AUTH_TOOLS = new Set(['authenticate', 'complete_authentication'])

// A /mcp name as it shows in tool names: `claude.ai Claude Docs` → `claude_ai_Claude_Docs`.
export const segmentOf = (name: string) => name.replace(/[^A-Za-z0-9_-]/g, '_')

const labelOf = (name: string) => name.replace(/^claude\.ai /, '').replace(/^plugin:[^:]+:/, '')
const labelOfSegment = (segment: string) => segment.replace(/^claude_ai_/, '').replace(/^plugin_[^_]+_/, '')

// The rows in first-seen order: servers seen with tools this session plus
// disabled ones. A listed server with no tools connects for `timeoutMs` from
// the tick it lost them or left the disabled list, then reads down.
export function mcpRows({ rows, tools, disabled, names, now, timeoutMs }: McpInput): McpRow[] {
  const offered = new Map<string, string[]>()
  for (const tool of tools) {
    const [, server, name = ''] = tool.mcp ? tool.name.split('__') : []
    if (server) offered.set(server, [...(offered.get(server) ?? []), name])
  }
  const off = new Map(disabled.map((name) => [segmentOf(name), name]))
  const servers = [...new Set([...rows.map((row) => row.server), ...offered.keys(), ...off.keys()])]
  return servers.map((server) => {
    const before = rows.find((row) => row.server === server)
    const name = off.get(server) ?? names[server]
    const label = name ? labelOf(name) : (before?.label ?? labelOfSegment(server))
    const toolNames = offered.get(server)
    if (off.has(server)) return { server, label, state: 'off' }
    if (toolNames?.length) {
      return toolNames.every((tool) => AUTH_TOOLS.has(tool))
        ? { server, label, state: 'auth' }
        : { server, label, state: 'ok', tools: toolNames.length }
    }
    if (before?.state === 'down') return { server, label, state: 'down' }
    const since = before?.state === 'connecting' ? (before.since ?? now) : now
    return now - since >= timeoutMs ? { server, label, state: 'down' } : { server, label, state: 'connecting', since }
  })
}
