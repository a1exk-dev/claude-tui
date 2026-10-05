import type { On, PaneOpenArgs, RenderViewport } from 'claude-code'
import { type Engine, expect, mock, test } from 'claude-code/testing'

import { register } from '../hooks/register'

// Scenario tests: the Sidebar pane's hooks through the engine's drivers
// (MEMORY.md "The Sidebar shows only when docked, and the person can't close it").

const PANE = {
  plugin: 'ctui',
  surface: 'terminal',
  component: 'Pane',
  requestId: 'sidebar',
} as const
const paneProps = (placement: 'dock' | 'inline', bodyRows = 30) => ({
  title: 'Sidebar',
  isFocused: false,
  bodyColumns: 42,
  placement,
  scroll: { offset: 0, bodyRows },
  view: {},
})

// Records the opens beneath the plugin; `panes` is what `$.ui.panes()` answers.
// Also draws the SessionMode site beneath ctui's observing hook.
function recordOpens(on: On, isPlaced = true, panes: string[] = []) {
  on('ui.render', { component: 'SessionMode' }, ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  const opens: PaneOpenArgs[] = []
  on('ui.open', ($, e) => {
    opens.push(e)
    return { value: isPlaced ? { isPlaced: true } : { isPlaced: false, reason: 'below 144 columns' } }
  })
  on('ui.panes', () => ({
    value: panes.map((id) => ({ id, title: id, isShown: true, isFocused: false, isPlaced: true })),
  }))
  return opens
}

async function sessionMode($: Engine, viewport: RenderViewport) {
  const site = await $.ui.mount({
    plugin: 'ctui',
    surface: 'terminal',
    component: 'SessionMode',
    props: { modes: [] },
    viewport,
  })
  await site.unmount()
}

test('fullscreen at 110+ columns opens the Sidebar 42 wide', async ($, on) => {
  const clock = mock.clock(on)
  const opens = recordOpens(on)
  await sessionMode($, { columns: 120, rows: 40, isFullscreen: true })
  await clock.settle()
  expect(opens).toEqual([{ id: 'sidebar', title: 'Sidebar', columns: 42 }])
})

test('a wide terminal asks 53 columns', async ($, on) => {
  const clock = mock.clock(on)
  const opens = recordOpens(on)
  await sessionMode($, { columns: 170, rows: 40, isFullscreen: true })
  await clock.settle()
  expect(opens.map((open) => open.columns)).toEqual([53])
})

test('below 110 columns or off fullscreen nothing opens', async ($, on) => {
  const clock = mock.clock(on)
  const opens = recordOpens(on)
  await sessionMode($, { columns: 109, rows: 40, isFullscreen: true })
  await sessionMode($, { columns: 200, rows: 40, isFullscreen: false })
  await clock.settle()
  expect(opens).toEqual([])
})

test('an open Sidebar is not opened again', async ($, on) => {
  const clock = mock.clock(on)
  const opens = recordOpens(on, true, ['sidebar'])
  await sessionMode($, { columns: 120, rows: 40, isFullscreen: true })
  await clock.settle()
  expect(opens).toEqual([])
})

test('an open that waits is asked again from the person’s prompt', async ($, on) => {
  const clock = mock.clock(on)
  const opens = recordOpens(on, false)
  on('prompt.submit', ($, e) => ({ text: e.text }))
  await sessionMode($, { columns: 120, rows: 40, isFullscreen: true })
  await clock.settle()
  await $.prompt.submit({ text: 'hi', wait: false, origin: { kind: 'composer' } })
  await clock.settle()
  expect(opens.map((open) => open.id)).toEqual(['sidebar', 'sidebar'])
})

test('seated inline, the Sidebar draws nothing and closes', async ($, on) => {
  const clock = mock.clock(on)
  const closes: unknown[] = []
  on('ui.close', ($, e) => {
    closes.push(e)
    return { value: undefined }
  })
  const pane = await $.ui.mount({ ...PANE, props: paneProps('inline') })
  expect(await pane.drawn()).toEqual({ type: 'Box' })
  await clock.settle()
  expect(closes).toEqual([{ id: 'sidebar', origin: { kind: 'plugin' } }])
})

// The kit has no driver for `ui.close`: the person's close mark is hand-written,
// straight to the plugin's hook.
test('the person can’t close the Sidebar; a plugin close passes', async () => {
  let close: ((...args: unknown[]) => unknown) | undefined
  const record = (event: string, _matcher: unknown, hook: (...args: unknown[]) => unknown) => {
    if (event === 'ui.close') close = hook
  }
  register(record as unknown as On, {})
  const next = () => 'closed'
  expect(await close?.({}, { id: 'sidebar', origin: { kind: 'person' } }, next)).toEqual({ deny: expect.any(String) })
  expect(await close?.({}, { id: 'sidebar', origin: { kind: 'plugin' } }, next)).toBe('closed')
})

test('a wheel tick scrolls the sections and the engine’s window stays', async ($, on) => {
  // 6 body rows leave 4 for the 5 section headers once the padding takes 2.
  const pane = await $.ui.mount({ ...PANE, props: paneProps('dock', 6) })
  expect(await pane.find({ text: '↓ more' })).toBeDefined()
  expect(await pane.find({ text: '↑ more' })).toBeUndefined()
  const moved = await $.ui.scroll({
    component: 'Pane',
    requestId: 'sidebar',
    offset: 1,
    by: 1,
    bodyRows: 6,
    contentRows: 6,
    origin: { kind: 'person' },
  })
  expect(moved).toEqual({})
  await pane.redraw()
  expect(await pane.find({ text: '↑ more' })).toBeDefined()
})

test('a section starts from <id>_folded and folds on a press', { options: { mcp_folded: true } }, async ($) => {
  const pane = await $.ui.mount({ ...PANE, props: paneProps('dock') })
  expect((await pane.find({ key: 'fold-mcp' }))?.text).toBe('▸')
  expect((await pane.find({ key: 'fold-todo' }))?.text).toBe('▾')
  await pane.press({ key: 'fold-mcp' })
  await pane.press({ key: 'fold-todo' })
  expect((await pane.find({ key: 'fold-mcp' }))?.text).toBe('▾')
  expect((await pane.find({ key: 'fold-todo' }))?.text).toBe('▸')
})

const STATUS = [
  '# branch.oid c1e879e48fada468970e942e80559adfe77c8713',
  '# branch.head main',
  '# branch.upstream origin/main',
  '# branch.ab +1 -0',
  '? new',
].join('\n')

// Answers the git runs, the cwd, HOME, the manifest read, the version and the usage beneath the plugin.
function host(on: On, git: { runs: string[][]; status: string; exitCode?: number; slow?: () => Promise<void> }) {
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('session.cwd', () => ({ value: '/home/a/Projects/x' }))
  on('env.get', () => ({ value: '/home/a' }))
  on('session.version', () => ({ value: { version: '2.1.288' } }))
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200000 }, rateLimits: [] } }))
  on('fs.read', () => ({ value: '{ "version": "0.0.0" }' }))
  on('process.run', async ($, e) => {
    git.runs.push([...e.argv])
    await git.slow?.()
    const stdout = e.argv.includes('status') ? git.status : ''
    return { value: { exitCode: git.exitCode ?? 0, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
}

const statusRuns = (runs: string[][]) => runs.filter((argv) => argv.includes('status')).length

test('git refreshes at session start, every 5 s and after a file-changing tool', async ($, on) => {
  const clock = mock.clock(on)
  const git = { runs: [] as string[][], status: STATUS }
  host(on, git)
  on('tool.call', () => ({ result: { stdout: '', stderr: '' } }))
  await $.session.start({ cwd: '/home/a/Projects/x', surface: 'terminal', isInteractive: true })
  await clock.settle()
  expect(statusRuns(git.runs)).toBe(1)

  const pane = await $.ui.mount({ ...PANE, props: paneProps('dock') })
  expect(await pane.find({ text: '~/Projects/x' })).toBeDefined()
  expect(await pane.find({ text: '⎇ main' })).toBeDefined()
  expect(await pane.find({ text: 'ctui 0.0.0' })).toBeDefined()
  expect(await pane.find({ text: 'claude-cli 2.1.288' })).toBeDefined()

  await clock.advance(4000)
  expect(statusRuns(git.runs)).toBe(1)
  await clock.advance(1000)
  expect(statusRuns(git.runs)).toBe(2)

  await $.tool.call({ tool: 'Read', file_path: '/home/a/Projects/x/a' })
  await clock.settle()
  expect(statusRuns(git.runs)).toBe(2)
  git.status = STATUS.replace('main', 'next')
  await $.tool.call({ tool: 'Bash', command: 'git switch next' })
  await clock.settle()
  expect(statusRuns(git.runs)).toBe(3)
  await pane.redraw()
  expect(await pane.find({ text: '⎇ next' })).toBeDefined()
})

test('outside a repo the header is the path alone', async ($, on) => {
  const clock = mock.clock(on)
  host(on, { runs: [], status: '', exitCode: 128 })
  await $.session.start({ cwd: '/srv/x', surface: 'terminal', isInteractive: true })
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, props: paneProps('dock') })
  expect(await pane.find({ text: '~/Projects/x' })).toBeDefined()
  expect(await pane.find({ text: /⎇/ })).toBeUndefined()
})

test('a file change while git runs refreshes once that run ends', async ($, on) => {
  const clock = mock.clock(on)
  const git = { runs: [] as string[][], status: STATUS, slow: () => clock.sleep(100) }
  host(on, git)
  on('tool.call', () => ({ result: { stdout: '', stderr: '' } }))
  await $.session.start({ cwd: '/home/a/Projects/x', surface: 'terminal', isInteractive: true })
  await clock.settle()
  await $.tool.call({ tool: 'Edit', file_path: '/home/a/Projects/x/a', old_string: 'a', new_string: 'b' })
  expect(statusRuns(git.runs)).toBe(1)
  await clock.advance(300)
  expect(statusRuns(git.runs)).toBe(2)
})
