// A stdio MCP server for the mcp Sidebar plugin's checks: node mcp-server.ts <name> <tool-count> [startup-delay-ms]
// It answers initialize after the delay, so a check can watch a server come up with a known tool count.
import process from 'node:process'

const [name = 'srv', count = '1', delay = '0'] = process.argv.slice(2)
const tools = Array.from({ length: Number(count) }, (_, index) => ({
  name: `${name}_tool_${index + 1}`,
  description: `tool ${index + 1} of ${name}`,
  inputSchema: { type: 'object', properties: {} },
}))

const send = (message: unknown) => process.stdout.write(`${JSON.stringify(message)}\n`)
let pending = ''
process.stdin.on('data', (chunk: Buffer) => {
  pending += chunk.toString()
  for (let newline = pending.indexOf('\n'); newline >= 0; newline = pending.indexOf('\n')) {
    const line = pending.slice(0, newline)
    pending = pending.slice(newline + 1)
    if (!line.trim()) continue
    let message: { id?: unknown; method?: string }
    try {
      message = JSON.parse(line) as { id?: unknown; method?: string }
    } catch {
      continue
    }
    const reply = (result: unknown) => {
      if (message.id !== undefined) send({ jsonrpc: '2.0', id: message.id, result })
    }
    if (message.method === 'initialize') {
      setTimeout(
        () =>
          reply({
            protocolVersion: '2024-11-05',
            capabilities: { tools: { listChanged: false } },
            serverInfo: { name, version: '1.0.0' },
          }),
        Number(delay),
      )
    } else if (message.method === 'tools/list') reply({ tools })
    else if (message.method === 'tools/call') reply({ content: [{ type: 'text', text: `${name} ok` }] })
    else if (message.method === 'ping') reply({})
    else if (!message.method?.startsWith('notifications/')) reply({})
  }
})
