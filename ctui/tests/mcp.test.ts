import { expect, test } from 'claude-code/testing'

import { type McpInput, mcpRows, serverName } from '../hooks/mcp'
import type { McpRow } from '../types'

// Tool names as `$.tool.list()` gave them on 2.1.288 (MEMORY.md "The `mcp`
// Sidebar plugin reads live tools and the disabled list; it never probes").
const tools = (server: string, ...names: string[]) =>
  names.map((name) => ({ name: `mcp__${server}__${name}`, mcp: true }))
const BUILTIN = [{ name: 'Bash', mcp: false }]
const PLAYWRIGHT = tools('playwright', 'browser_click', 'browser_navigate')
const DOCS = tools('claude_ai_Claude_Docs', 'read')
const AUTHY = tools('authy', 'authenticate', 'complete_authentication')

const TIMEOUT = 30_000
const input = (over: Partial<McpInput>): McpInput => ({
  rows: [],
  tools: BUILTIN,
  disabled: [],
  names: {},
  now: 0,
  timeoutMs: TIMEOUT,
  ...over,
})

test('servers with tools, counted', () => {
  expect(mcpRows(input({ tools: [...BUILTIN, ...PLAYWRIGHT, ...tools('context7', 'docs')] }))).toEqual([
    { server: 'context7', label: 'context7', state: 'ok', tools: 1 },
    { server: 'playwright', label: 'playwright', state: 'ok', tools: 2 },
  ])
})

test('only the auth pseudo-tools read needs auth', () => {
  expect(mcpRows(input({ tools: AUTHY }))).toEqual([{ server: 'authy', label: 'authy', state: 'auth' }])
})

test('labels: the /mcp name minus its prefix, else the segment minus its prefix', () => {
  const both = [...DOCS, ...tools('plugin_kit_linear', 'list')]
  expect(mcpRows(input({ tools: both })).map((row) => row.label)).toEqual(['Claude_Docs', 'linear'])
  const names = { claude_ai_Claude_Docs: 'claude.ai Claude Docs', plugin_kit_linear: 'plugin:kit:linear' }
  expect(mcpRows(input({ tools: both, names })).map((row) => row.label)).toEqual(['Claude Docs', 'linear'])
})

test('a disabled server reads off under its /mcp name, also unseen this session', () => {
  expect(mcpRows(input({ disabled: ['claude.ai Claude Docs', 'github'] }))).toEqual([
    { server: 'claude_ai_Claude_Docs', label: 'Claude Docs', state: 'off' },
    { server: 'github', label: 'github', state: 'off' },
  ])
})

test('/mcp disable turns a listed server off, last; its label stays', () => {
  const names = { claude_ai_Claude_Docs: 'claude.ai Claude Docs' }
  const rows = mcpRows(input({ tools: [...DOCS, ...PLAYWRIGHT], names }))
  expect(mcpRows(input({ rows, tools: PLAYWRIGHT, disabled: ['claude.ai Claude Docs'] }))).toEqual([
    { server: 'playwright', label: 'playwright', state: 'ok', tools: 2 },
    { server: 'claude_ai_Claude_Docs', label: 'Claude Docs', state: 'off' },
  ])
})

test('a server that leaves the disabled list connects, then lists its tools', () => {
  const off = mcpRows(input({ disabled: ['playwright'] }))
  const connecting = mcpRows(input({ rows: off, now: 5000 }))
  expect(connecting).toEqual([{ server: 'playwright', label: 'playwright', state: 'connecting', since: 5000 }])
  expect(mcpRows(input({ rows: connecting, tools: PLAYWRIGHT, now: 6000 }))).toEqual([
    { server: 'playwright', label: 'playwright', state: 'ok', tools: 2 },
  ])
})

test('a server that loses its tools connects for MCP_TIMEOUT, then reads down', () => {
  const ok = mcpRows(input({ tools: PLAYWRIGHT }))
  const connecting = mcpRows(input({ rows: ok, now: 1000 }))
  expect(connecting).toEqual([{ server: 'playwright', label: 'playwright', state: 'connecting', since: 1000 }])
  expect(mcpRows(input({ rows: connecting, now: 1000 + TIMEOUT - 1 }))).toEqual(connecting)
  const down = mcpRows(input({ rows: connecting, now: 1000 + TIMEOUT }))
  expect(down).toEqual([{ server: 'playwright', label: 'playwright', state: 'down' }])
  expect(mcpRows(input({ rows: down, now: 1000 + 2 * TIMEOUT }))).toEqual(down)
  expect(mcpRows(input({ rows: down, tools: PLAYWRIGHT }))).toEqual(ok)
})

test('a re-enabled server needing auth gets no pseudo-tools: connecting, then down', () => {
  const auth = mcpRows(input({ tools: AUTHY }))
  const off = mcpRows(input({ rows: auth, disabled: ['authy'] }))
  const connecting = mcpRows(input({ rows: off, now: 2000 }))
  expect(connecting[0]?.state).toBe('connecting')
  expect(mcpRows(input({ rows: connecting, now: 2000 + TIMEOUT }))[0]?.state).toBe('down')
})

test('A–Z by label, off rows last and A–Z too; one label on two servers by server', () => {
  const rows = mcpRows(
    input({
      tools: [...PLAYWRIGHT, ...DOCS, ...AUTHY, ...tools('plugin_b_linear', 'list'), ...tools('plugin_a_linear', 'list')],
      disabled: ['zeta', 'github'],
      names: { claude_ai_Claude_Docs: 'claude.ai Claude Docs' },
    }),
  )
  expect(rows.map((row) => `${row.label}:${row.server}`)).toEqual([
    'authy:authy',
    'Claude Docs:claude_ai_Claude_Docs',
    'linear:plugin_a_linear',
    'linear:plugin_b_linear',
    'playwright:playwright',
    'github:github',
    'zeta:zeta',
  ])
})

test('a tool.describe provider names its server as /mcp does', () => {
  expect(serverName('mcp__claude_ai_Claude_Docs__read', 'mcp:claude.ai Claude Docs')).toEqual([
    'claude_ai_Claude_Docs',
    'claude.ai Claude Docs',
  ])
  // A plugin's server reads `<plugin>@<marketplace>`; its plugin name may hold `_`.
  expect(serverName('mcp__plugin_my_kit_linear__list', 'my_kit@market')).toEqual([
    'plugin_my_kit_linear',
    'plugin:my_kit:linear',
  ])
  expect(serverName('Bash', 'engine')).toBeUndefined()
})
