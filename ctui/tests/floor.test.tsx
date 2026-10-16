import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

import { belowFloor, FLOOR } from '../hooks/floor'

// The support floor (CONTEXT.md "Support floor"): which engine versions are
// older than it, and the one toast an older engine gets per session.

test('versions below the floor, the floor itself and later ones', () => {
  expect(FLOOR).toBe('2.1.292')
  // 2.1.285 is the oldest engine that loads the hooks module.
  expect(['2.1.285', '2.1.291'].map(belowFloor)).toEqual([true, true])
  expect(['2.1.292', '2.1.300', '2.2.0', '3.0.0'].map(belowFloor)).toEqual([false, false, false, false])
  // A development build carries the release it is built from first.
  expect(belowFloor('2.1.291-dev.20261001.t101500.sha1a2b3c4')).toBe(true)
  expect(belowFloor('2.1.292-dev.20261001.t101500.sha1a2b3c4')).toBe(false)
})

// The world beneath the plugin: an engine of `version`, and every toast shown.
function host(on: On, version: string, toasts: string[]) {
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('session.version', () => ({ value: { version } }))
  on('fs.read', () => ({ value: '{ "version": "0.0.0" }' }))
  on('env.set', () => ({ value: undefined }))
  on('ui.toast', (_, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
}

test('an engine below the floor toasts once per session, even with agents_toasts off', { options: { agents_toasts: false } }, async ($, on) => {
  const clock = mock.clock(on)
  const toasts: string[] = []
  host(on, '2.1.291', toasts)
  await $.session.start({ cwd: '/srv/x', surface: 'terminal', isInteractive: true })
  await $.session.start({ cwd: '/srv/x', surface: 'terminal', isInteractive: true }) // a settings reload
  await clock.settle()
  expect(toasts).toEqual(['ctui needs Claude Code 2.1.292 or later; this is 2.1.291'])
})

for (const version of [FLOOR, '2.1.300']) {
  test(`${version} gets no toast`, async ($, on) => {
    const clock = mock.clock(on)
    const toasts: string[] = []
    host(on, version, toasts)
    await $.session.start({ cwd: '/srv/x', surface: 'terminal', isInteractive: true })
    await clock.settle()
    expect(toasts).toEqual([])
  })
}
