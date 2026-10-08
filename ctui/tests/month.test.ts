import { expect, test } from 'claude-code/testing'

import { costKey, lastCosts, monthOf, monthStart, monthTotal, showsCost, staleTranscripts } from '../hooks/month'
import type { Usage } from '../types'

// The month total's pure parts: the local month, the grep output, the cache.

const line = (sessionId: string, totalCostUSD: number) =>
  JSON.stringify({ type: 'cost-state', sessionId, totalCostUSD, startTime: 0, modelUsage: {} })

test('the month is local: midnight on the 1st starts the next one', () => {
  const last = new Date(2026, 9, 31, 23, 59, 59, 999).getTime()
  const first = new Date(2026, 10, 1, 0, 0).getTime()
  expect(monthOf(last)).toBe('2026-10')
  expect(monthOf(first)).toBe('2026-11')
  expect(monthStart(last)).toBe(new Date(2026, 9, 1).getTime())
  expect(monthStart(first)).toBe(first)
  expect(monthOf(new Date(2027, 0, 5).getTime())).toBe('2027-01')
})

test('each session keeps its last cost-state line', () => {
  const stdout = [line('a', 1.5), line('b', 2), line('a', 4.25), ''].join('\n')
  expect(lastCosts(stdout)).toEqual({ a: 4.25, b: 2 })
  expect(lastCosts('')).toEqual({})
})

test('a cost-state line cut off mid-write is skipped', () => {
  expect(lastCosts(`${line('a', 3)}\n{"type":"cost-state","sessionId":"b","tot`)).toEqual({ a: 3 })
})

test('a transcript is read again only when its size or mtime moved', () => {
  const cached = { a: { usd: 1, mtimeMs: 10, size: 100 }, b: { usd: 2, mtimeMs: 10, size: 100 } }
  const transcripts = [
    { session: 'a', path: '/p/a.jsonl', mtimeMs: 10, size: 100 },
    { session: 'b', path: '/p/b.jsonl', mtimeMs: 20, size: 140 },
    { session: 'c', path: '/p/c.jsonl', mtimeMs: 30, size: 50 },
  ]
  expect(staleTranscripts(transcripts, cached).map((t) => t.session)).toEqual(['b', 'c'])
})

test('the total adds every cached session but the current one', () => {
  const cached = { a: { usd: 1.25, mtimeMs: 0, size: 0 }, b: { usd: 2, mtimeMs: 0, size: 0 }, now: { usd: 9, mtimeMs: 0, size: 0 } }
  expect(monthTotal(cached, 'now')).toBe(3.25)
  expect(monthTotal({}, 'now')).toBe(0)
})

test('a session is cached under its month', () => {
  expect(costKey('2026-10', 'abc')).toBe('cost:2026-10:abc')
})

test('the cost row shows per limits_cost and plan state, and only with a cost', () => {
  const api: Usage = { context: { window: 1 }, rateLimits: [], cost: { usd: 0 } }
  const plan: Usage = { ...api, rateLimits: [{ kind: 'five_hour', percentUsed: 1 }] }
  const gateway: Usage = { ...api, rateLimits: [{ kind: 'spend_limit', percentUsed: 1 }] }
  expect([showsCost(api, 'auto'), showsCost(plan, 'auto'), showsCost(gateway, 'auto')]).toEqual([true, false, true])
  expect([showsCost(plan, 'on'), showsCost(api, 'off')]).toEqual([true, false])
  expect([showsCost(undefined, 'on'), showsCost({ ...api, cost: undefined }, 'on')]).toEqual([false, false])
})
