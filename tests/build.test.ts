import { expect, test } from 'claude-code/testing'

import { build } from '../hooks/build'

// The `versions` footer's ctui part: the commit Claude Code installed, the id
// `/plugin` shows, or `local` when ctui loads from a folder by `--plugin-dir`.

test('a marketplace install names its 12-character commit', () => {
  expect(build('/home/a/.claude/plugins/cache/claude-tui/ctui/da270ab1c2f3')).toBe('da270ab1c2f3')
  expect(build('C:\\Users\\a\\.claude\\plugins\\cache\\claude-tui\\ctui\\da270ab1c2f3')).toBe('da270ab1c2f3')
})

test('a folder loaded by --plugin-dir is local', () => {
  expect(build('/home/a/Projects/claude-tui/ctui')).toBe('local')
  expect(build('/home/a/cache/claude-tui/ctui')).toBe('local')
})
