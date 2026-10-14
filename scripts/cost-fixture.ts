// Writes the transcripts the cold-cache `cost` row's live check scans (docs/testing/live-checks.md,
// Sidebar layout and scroll): `node scripts/cost-fixture.ts <folder>`, with the folder a scratch
// `CLAUDE_CONFIG_DIR/projects/<project>/`. About 800 main transcripts, about 400 MB, no stored data.
import { randomUUID } from 'node:crypto'
import { mkdirSync, readdirSync, utimesSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const PADDING_CHARS = 900

type Options = { files: number; bytes: number }

// One transcript row that is not a `cost-state`, roughly a kilobyte.
const paddingRow = (sessionId: string) =>
  `${JSON.stringify({ type: 'assistant', sessionId, message: { role: 'assistant', content: [{ type: 'text', text: 'x'.repeat(PADDING_CHARS) }] } })}\n`

const costLine = (sessionId: string, cents: number) =>
  `${JSON.stringify({ type: 'cost-state', sessionId, totalCostUSD: cents / 100, startTime: 0, modelUsage: {} })}\n`

// Fills `folder` with `files` transcripts of about `bytes` in all, written now so each counts in
// this month. Each carries three `cost-state` lines, the last one the session's cost, and
// `total` is the sum of those last costs in dollars.
export function generate(folder: string, { files, bytes }: Options) {
  mkdirSync(folder, { recursive: true })
  if (readdirSync(folder).length) throw new Error(`${folder} is not empty`)

  const now = new Date()
  let written = 0
  let cents = 0
  for (let i = 0; i < files; i++) {
    const session = randomUUID()
    const first = 1 + Math.floor(Math.random() * 100)
    const second = first + Math.floor(Math.random() * 100)
    const last = second + Math.floor(Math.random() * 100)
    cents += last

    const row = paddingRow(session)
    const costs = [first, second, last].map((value) => costLine(session, value))
    const rows = Math.max(0, Math.floor((bytes / files - costs.join('').length) / row.length))
    // The cost lines sit among the padding, with rows after the last, as in a live transcript.
    const gap = Math.floor(rows / 4)
    const body = [row.repeat(gap), costs[0], row.repeat(gap), costs[1], row.repeat(gap), costs[2], row.repeat(rows - 3 * gap)].join('')

    const path = join(folder, `${session}.jsonl`)
    writeFileSync(path, body)
    utimesSync(path, now, now)
    written += Buffer.byteLength(body)
  }
  return { files, bytes: written, total: cents / 100 }
}

if (import.meta.main) {
  const folder = process.argv[2]
  if (!folder) {
    console.error('usage: node scripts/cost-fixture.ts <folder>')
    process.exit(1)
  }
  const { files, bytes, total } = generate(folder, { files: 800, bytes: 400_000_000 })
  console.log(`${files} transcripts, ${(bytes / 2 ** 20).toFixed(0)} MiB, in ${folder}`)
  console.log(`expected month total: ${total.toFixed(2)}$`)
}
