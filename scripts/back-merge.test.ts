// Run by `node scripts/check.ts`, or alone: `node --test scripts/`.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { conflictError, mergeDecision, prAction } from './back-merge.ts'

test('with no back-merge pull request open, one is created', () => {
  assert.deepEqual(prAction([]), { kind: 'create' })
})

test('an open back-merge pull request is updated, not duplicated', () => {
  assert.deepEqual(prAction([412]), { kind: 'update', number: 412 })
})

test('mergeability GitHub has not computed yet means wait', () => {
  assert.equal(mergeDecision('UNKNOWN', true), 'wait')
})

test('a conflicting back-merge is a conflict whoever merged the release', () => {
  assert.equal(mergeDecision('CONFLICTING', true), 'conflict')
  assert.equal(mergeDecision('CONFLICTING', false), 'conflict')
})

test('a mergeable back-merge auto-merges only when the repo owner merged the release', () => {
  assert.equal(mergeDecision('MERGEABLE', true), 'auto-merge')
  assert.equal(mergeDecision('MERGEABLE', false), 'leave')
})

test('the conflict error lists the four fix steps on one annotation line', () => {
  assert.equal(
    conflictError('1.0.1', 412),
    '::error::The back-merge pull request #412 from main into develop has a conflict. Fix it:' +
      '%0A1. Run git fetch, then make bugfix/back-merge-v1.0.1 from origin/develop.' +
      '%0A2. Run git merge origin/main and fix the conflict.' +
      '%0A3. Open a pull request into develop.' +
      '%0A4. Close the automatic pull request #412.',
  )
})
