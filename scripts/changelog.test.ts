// Run by `node scripts/check.ts`, or alone: `node --test scripts/`.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { addEntry, entry, releasedLines, topEntry } from './changelog.ts'

const none = new Set<string>()

test('every type in the table lands in its section, in the preset order', () => {
  const subjects = ['ci: c', 'build: b', 'test: t', 'refactor: r', 'chore: ch', 'style: s', 'docs: d', 'revert: rv', 'perf: p', 'fix: f', 'feature: fe', 'feat: ft']
  assert.equal(
    entry('1.0.0', '2026-10-19', subjects, none),
    [
      '## 1.0.0 (2026-10-19)',
      '### Features\n\n- fe\n- ft',
      '### Bug Fixes\n\n- f',
      '### Performance Improvements\n\n- p',
      '### Reverts\n\n- rv',
      '### Documentation\n\n- d',
      '### Styles\n\n- s',
      '### Miscellaneous Chores\n\n- ch',
      '### Code Refactoring\n\n- r',
      '### Tests\n\n- t',
      '### Build System\n\n- b',
      '### Continuous Integration\n\n- c',
    ].join('\n\n'),
  )
})

test('a scope or a bang still lands; an unknown type or no type is dropped', () => {
  assert.equal(
    entry('1.0.0', '2026-10-19', ['fix(sidebar)!: scoped', 'wip: dropped', 'Initial commit'], none),
    '## 1.0.0 (2026-10-19)\n\n### Bug Fixes\n\n- scoped',
  )
})

test('a line an earlier entry lists is left out', () => {
  const released = releasedLines('# Changelog\n\n## 0.6.0 (2026-10-17)\n\n### Features\n\n- old\n')
  assert.equal(entry('1.0.0', '2026-10-19', ['feat: old', 'feat: new'], released), '## 1.0.0 (2026-10-19)\n\n### Features\n\n- new')
})

test('with nothing to list, the body is the note or "No user-facing changes."', () => {
  assert.equal(entry('1.0.1', '2026-10-19', ['wip: x'], none), '## 1.0.1 (2026-10-19)\n\nNo user-facing changes.')
  assert.equal(entry('1.0.1', '2026-10-19', [], none, 'A note.'), '## 1.0.1 (2026-10-19)\n\nA note.')
})

test('the note goes under the heading, above the sections', () => {
  assert.equal(entry('1.0.0', '2026-10-19', ['feat: x'], none, 'First stable.'), '## 1.0.0 (2026-10-19)\n\nFirst stable.\n\n### Features\n\n- x')
})

test('a new entry goes on top, under the header', () => {
  assert.equal(addEntry('# Changelog\n\n## 0.6.0 (2026-10-17)\n\nOld.\n', '## 1.0.0 (2026-10-19)\n\nNew.'), '# Changelog\n\n## 1.0.0 (2026-10-19)\n\nNew.\n\n## 0.6.0 (2026-10-17)\n\nOld.\n')
})

test('a version the changelog already has is refused', () => {
  assert.throws(() => addEntry('# Changelog\n\n## 1.0.0 (2026-10-18)\n\nOld.\n', '## 1.0.0 (2026-10-19)\n\nNew.'), /already has an entry for 1\.0\.0/)
})

test('a changelog without the header is refused', () => {
  assert.throws(() => addEntry('## 0.6.0 (2026-10-17)\n', '## 1.0.0 (2026-10-19)\n\nNew.'), /must start with "# Changelog"/)
})

const changelog = '# Changelog\n\n## 1.0.0 (2026-10-19)\n\nFirst stable.\n\n### Features\n\n- x\n\n## 0.6.0 (2026-10-17)\n\nOld.\n'

test('the top entry, heading included, is the release body', () => {
  assert.equal(topEntry(changelog, '1.0.0'), '## 1.0.0 (2026-10-19)\n\nFirst stable.\n\n### Features\n\n- x')
})

test('a top entry for another version fails the check', () => {
  assert.throws(() => topEntry(changelog, '1.0.1'), /top entry of ctui\/CHANGELOG\.md is 1\.0\.0, not 1\.0\.1/)
  assert.throws(() => topEntry('# Changelog\n', '1.0.0'), /is missing, not 1\.0\.0/)
})
