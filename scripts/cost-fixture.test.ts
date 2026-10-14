// Run by `node scripts/check.ts`, or alone: `node --test scripts/`.
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { lastCosts, monthOf, monthTotal } from '../ctui/hooks/month.ts'
import { generate } from './cost-fixture.ts'

const scratch = () => mkdtempSync(join(tmpdir(), 'cost-fixture-'))

test('writes the files, their size and this month, and prints the total ctui sums', () => {
  const dir = scratch()
  try {
    const made = generate(dir, { files: 6, bytes: 600_000 })
    const names = readdirSync(dir)
    assert.equal(names.length, 6)
    assert.equal(made.files, 6)

    const sizes = names.map((name) => statSync(join(dir, name)).size)
    const total = sizes.reduce((sum, size) => sum + size, 0)
    assert.equal(made.bytes, total)
    assert.ok(Math.abs(total - 600_000) < 6 * 4096, `${total} bytes is not about 600000`)

    // What the Limits cost row reads: grep's lines, the last `totalCostUSD` per session.
    const cached: Record<string, { usd: number; mtimeMs: number; size: number }> = {}
    for (const name of names) {
      assert.match(name, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jsonl$/)
      const path = join(dir, name)
      const { mtimeMs, size } = statSync(path)
      assert.equal(monthOf(mtimeMs), monthOf(Date.now()))
      const stdout = readFileSync(path, 'utf8')
        .split('\n')
        .filter((line) => line.includes('"type":"cost-state"'))
        .join('\n')
      const session = name.slice(0, -'.jsonl'.length)
      const costs = lastCosts(stdout)
      assert.deepEqual(Object.keys(costs), [session])
      cached[session] = { usd: costs[session]!, mtimeMs, size }
    }
    assert.equal(monthTotal(cached, 'none').toFixed(2), made.total.toFixed(2))
  } finally {
    rmSync(dir, { recursive: true })
  }
})

test('creates the folder, and refuses one that already holds files', () => {
  const dir = scratch()
  try {
    const project = join(dir, 'projects', 'fixture')
    generate(project, { files: 1, bytes: 10_000 })
    assert.equal(readdirSync(project).length, 1)
    assert.throws(() => generate(project, { files: 1, bytes: 10_000 }), /not empty/)

    const other = join(dir, 'other')
    mkdirSync(other)
    writeFileSync(join(other, 'notes.txt'), '')
    assert.throws(() => generate(other, { files: 1, bytes: 10_000 }), /not empty/)
  } finally {
    rmSync(dir, { recursive: true })
  }
})
