import { expect, test } from 'claude-code/testing'

import { readConfig } from '../hooks/config'

// The `order` setting (#172): comma-separated section ids, from the `/ctui`
// menu or typed in `/config`, cleaned up on every read.

const DEFAULT = ['context', 'limits', 'todo', 'mcp', 'agents']

test('no order, or an empty one, is the registry order', () => {
  expect(readConfig({}).order).toEqual(DEFAULT)
  expect(readConfig({ order: '' }).order).toEqual(DEFAULT)
})

test('listed ids lead; unknown, repeated and fixed ids drop; missing ones follow in registry order', () => {
  expect(readConfig({ order: 'agents,mcp' }).order).toEqual(['agents', 'mcp', 'context', 'limits', 'todo'])
  expect(readConfig({ order: ' mcp , nope,context,mcp,git,versions,' }).order).toEqual([
    'mcp',
    'context',
    'limits',
    'todo',
    'agents',
  ])
})

// A `git_enable` or `versions_enable` saved by an earlier ctui stays in settings.json.
test('the git header and versions footer are always on', () => {
  const config = readConfig({ git_enable: false, versions_enable: false })
  expect([config.git.enable, config.versions.enable]).toEqual([true, true])
})
