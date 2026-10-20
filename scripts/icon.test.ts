// Run by `node scripts/check.ts`, or alone: `node --test scripts/`.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { png } from './icon.ts'

test('the icon is a square PNG of 512 to 2048 px a side, under 2 MB', () => {
  const bytes = png()
  assert.equal(bytes.toString('latin1', 12, 16), 'IHDR')
  const width = bytes.readUInt32BE(16)
  const height = bytes.readUInt32BE(20)
  assert.equal(width, height)
  assert.ok(width >= 512 && width <= 2048, `${width} px a side`)
  assert.ok(bytes.length < 2 * 1024 * 1024, `${bytes.length} bytes`)
})
