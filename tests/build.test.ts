import { expect, test } from 'claude-code/testing'

import { build } from '../hooks/build'

// The `versions` footer's ctui part: the version Claude Code installed, from
// plugin.json, or `local` when ctui loads from a folder by `--plugin-dir`.

test('a marketplace install names its version', () => {
  expect(build('/home/a/.claude/plugins/cache/claude-tui/ctui/1.0.1')).toBe('1.0.1')
  expect(build('C:\\Users\\a\\.claude\\plugins\\cache\\claude-tui\\ctui\\1.0.1')).toBe('1.0.1')
})

test('a folder loaded by --plugin-dir is local', () => {
  expect(build('/home/a/Projects/claude-tui/ctui')).toBe('local')
  expect(build('/home/a/cache/claude-tui/ctui')).toBe('local')
})
