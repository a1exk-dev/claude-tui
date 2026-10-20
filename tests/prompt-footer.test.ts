import { expect, test } from 'claude-code/testing'

import { fitsPromptLine, modeLabel, promptLabel, savedEffort } from '../hooks/format'
import { turnOf, turnWord } from '../hooks/skin/turn'

test('the label reads model · effort, or the model alone', () => {
  expect(promptLabel('claude-opus-5-5', 'high')).toBe('claude-opus-5-5 · high effort')
  expect(promptLabel('claude-haiku-4-5-20251001', null)).toBe('claude-haiku-4-5-20251001')
  expect(promptLabel('claude-opus-5-5', undefined)).toBe('claude-opus-5-5')
})

test('the label fits beside the widest pill and the hint, or takes its own row', () => {
  // 2 + 24 + 1 + 15 + 2 + 29 = 73
  const label = 'claude-opus-5-5 · high effort'
  expect(fitsPromptLine('? for shortcuts', label, 73)).toBe(true)
  expect(fitsPromptLine('? for shortcuts', label, 72)).toBe(false)
})

test('mode labels follow Claude Code’s pill', () => {
  expect(modeLabel('default')).toBe('manual mode')
  expect(modeLabel('acceptEdits')).toBe('accept edits')
  expect(modeLabel('plan')).toBe('plan mode')
  expect(modeLabel('bypassPermissions')).toBe('bypass permissions')
  expect(modeLabel('auto')).toBe('auto mode')
  expect(modeLabel('dontAsk')).toBe("don't ask")
})

test('the saved effort: the model’s own over the global level', () => {
  const settings = { effortLevel: 'medium', modelSettings: { 'claude-opus-5-5': { effortLevel: 'xhigh' } } }
  expect(savedEffort(settings, 'claude-opus-5-5')).toBe('xhigh')
  expect(savedEffort(settings, 'claude-sonnet-5-5')).toBe('medium')
  expect(savedEffort({}, 'claude-opus-5-5')).toBeUndefined()
})

test('the footer word takes the turn’s mode and model', () => {
  expect(turnWord('Baked', { durationMs: 1, mode: 'acceptEdits', model: 'claude-opus-5-5' })).toBe(
    'accept edits · claude-opus-5-5 · Baked',
  )
})

test('a footer reads the newest turn of its duration', () => {
  const turns = [
    { durationMs: 12000, mode: 'default', model: 'a' },
    { durationMs: 3000, mode: 'plan', model: 'b' },
    { durationMs: 12000, mode: 'auto', model: 'c' },
  ]
  expect(turnOf(turns, 12000)?.model).toBe('c')
  expect(turnOf(turns, 5)).toBeUndefined()
  expect(turnOf(undefined, 5)).toBeUndefined()
})
