import { expect, test } from 'claude-code/testing'

import { formatElapsed, formatReset, formatDollars, formatTokens, formatUsd, formatWindow, level } from '../hooks/format'

test('token counts group thousands', () => {
  expect(formatTokens(0)).toBe('0')
  expect(formatTokens(18402)).toBe('18,402')
  expect(formatTokens(1234567)).toBe('1,234,567')
})

test('windows read in k or M', () => {
  expect(formatWindow(200000)).toBe('200k')
  expect(formatWindow(1000000)).toBe('1M')
})

test('cost reads in dollars and cents, or whole dollars, the sign after the digits', () => {
  expect(formatUsd(0.214)).toBe('0.21$')
  expect(formatUsd(12)).toBe('12.00$')
  expect(formatDollars(62.4)).toBe('62$')
  expect(formatDollars(133.5)).toBe('134$')
})

test('levels: below 60 success, below 85 warning, then error', () => {
  expect(level(0)).toBe('success')
  expect(level(59.9)).toBe('success')
  expect(level(60)).toBe('warning')
  expect(level(84.9)).toBe('warning')
  expect(level(85)).toBe('error')
  expect(level(112)).toBe('error')
})

test('resets within a day read hours and minutes', () => {
  const now = new Date(2026, 9, 6, 12, 0).getTime()
  expect(formatReset(new Date(2026, 9, 6, 14, 17, 30).toISOString(), now)).toBe('resets in 2h 17m')
  expect(formatReset(new Date(2026, 9, 6, 12, 42).toISOString(), now)).toBe('resets in 42m')
  expect(formatReset(new Date(2026, 9, 6, 12, 0, 20).toISOString(), now)).toBe('resets in 0m')
  expect(formatReset(new Date(2026, 9, 6, 11, 0).toISOString(), now)).toBe('resets in 0m')
  expect(formatReset(new Date(2026, 9, 7, 12, 0).toISOString(), now)).toBe('resets in 24h 0m')
})

test('resets past a day add the local weekday and time', () => {
  const now = new Date(2026, 9, 9, 5, 0).getTime() // Friday
  expect(formatReset(new Date(2026, 9, 12, 9, 0).toISOString(), now)).toBe('resets in 3d 4h, Mon 09:00')
})

test('elapsed times', () => {
  expect(formatElapsed(21_400)).toBe('21s')
  expect(formatElapsed(75_000)).toBe('1m 15s')
  expect(formatElapsed(903_000)).toBe('15m 03s')
  expect(formatElapsed(3_720_000)).toBe('1h 02m')
  expect(formatElapsed(-5)).toBe('0s')
})
