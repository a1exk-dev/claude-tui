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
const paneProps = (placement: 'dock' | 'inline', bodyRows = 30, isFocused = false) => ({
  title: 'Sidebar',
  isFocused,
  bodyColumns: 42,
  placement,
  scroll: { offset: 0, bodyRows },
  view: {},
})

// Records the opens beneath the plugin; `panes` is what `$.ui.panes()` answers,
// and an open `refused` columns wide is another mod's deny.
// Also draws the SessionMode site beneath ctui's observing hook.
function recordOpens(on: On, isPlaced = true, panes: string[] = [], refused?: number) {
  on('ui.render', { component: 'SessionMode' }, ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  const opens: PaneOpenArgs[] = []
  on('ui.open', ($, e) => {
    opens.push(e)
    if (e.columns === refused) return { deny: 'refused by acme' }
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

// The live checks' `docking/width-42-at-150` and `docking/width-53-at-170` each
// open from a fresh session at one width, as the two tests above do. Inside one
// session the docked Pane's own render re-asks, off the transcript's columns
// plus the dock's.
test('widening past 160 asks 53 columns, and narrowing back asks 42 again', async ($, on) => {
  const clock = mock.clock(on)
  const opens = recordOpens(on)
  // 150 columns: the first open asks 42.
  await sessionMode($, { columns: 150, rows: 40, isFullscreen: true })
  await clock.settle()
  // One draw of the docked Pane: the engine hands it the transcript's columns,
  // so the terminal's are those plus the dock's body and its rule.
  const dock = async (transcript: number, bodyColumns: number) => {
    const pane = await $.ui.mount({
      ...PANE,
      props: { ...paneProps('dock'), bodyColumns },
      viewport: { columns: transcript, rows: 40, isFullscreen: true },
    })
    await clock.settle()
    await pane.unmount()
  }
  await dock(107, 42) // 150 columns
  await dock(127, 42) // widened to 170
  await dock(96, 53) // narrowed back to 150
  expect(opens.map((open) => open.columns)).toEqual([42, 53, 42])
})

// The test above asserts that nothing opens below 110; the Sidebar the engine
// dropped there docks again once the terminal is wide enough. No live check
// walks that transition.
test('narrowed below 110 and widened back, the Sidebar docks again', async ($, on) => {
  const clock = mock.clock(on)
  const panes = ['sidebar'] // docked at 150 columns
  const opens = recordOpens(on, true, panes)
  await sessionMode($, { columns: 109, rows: 40, isFullscreen: true })
  await clock.settle()
  expect(opens).toEqual([])
  // Below 110 the engine drops the pane: `$.ui.panes()` lists it no more.
  panes.length = 0
  await sessionMode($, { columns: 120, rows: 40, isFullscreen: true })
  await clock.settle()
  expect(opens.map((open) => open.columns)).toEqual([42])
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
  // Not the whole node: the engine stamps its own `part` on a hook's returned root.
  const drawn = await pane.drawn()
  expect(drawn).toMatchObject({ type: 'Box' })
  expect('children' in drawn).toBe(false)
  await clock.settle()
  expect(closes).toEqual([{ id: 'sidebar', origin: { kind: 'plugin' } }])
})

test('a close another mod refuses on the inline placement changes nothing and toasts nothing', async ($, on) => {
  const clock = mock.clock(on)
  const toasts: string[] = []
  on('ui.toast', (_, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  let refused = 0
  on('ui.close', () => {
    refused++
    return { deny: 'refused by acme' }
  })
  const pane = await $.ui.mount({ ...PANE, props: paneProps('inline') })
  await clock.settle()
  expect(refused).toBe(1)
  const drawn = await pane.drawn()
  expect(drawn).toMatchObject({ type: 'Box' })
  expect('children' in drawn).toBe(false)
  expect(toasts).toEqual([])
})

// Nothing asks the width again: the render hook records the width it asked
// for before the open, so each later draw sees no change to make.
test('a resize another mod refuses leaves the dock at its old width for the session', async ($, on) => {
  const clock = mock.clock(on)
  const opens = recordOpens(on, true, [], 53)
  await sessionMode($, { columns: 150, rows: 40, isFullscreen: true })
  await clock.settle()
  // Widened to 170 columns, the dock still 42: three draws of it.
  for (let draw = 0; draw < 3; draw++) {
    const pane = await $.ui.mount({ ...PANE, props: paneProps('dock'), viewport: { columns: 127, rows: 40, isFullscreen: true } })
    await clock.settle()
    await pane.unmount()
  }
  expect(opens.map((open) => open.columns)).toEqual([42, 53])
})

// The kit has no driver for `ui.close`: the person's close mark is hand-written,
// straight to the plugin's hook.
test('the person can’t close the Sidebar; a plugin close passes', async () => {
  let close: ((...args: unknown[]) => unknown) | undefined
  const record = (event: string, matcher: { id?: string }, hook: (...args: unknown[]) => unknown) => {
    if (event === 'ui.close' && matcher.id === 'sidebar') close = hook
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
    bodyRows: 8,
    contentRows: 8,
    origin: { kind: 'person' },
  })
  expect(moved).toEqual({})
  await pane.redraw()
  expect(await pane.find({ text: '↑ more' })).toBeDefined()
})

test('a section starts from <id>_folded and folds on a press', { options: { mcp_folded: true } }, async ($) => {
  const pane = await $.ui.mount({ ...PANE, props: paneProps('dock') })
  expect((await pane.find({ in: 'fold-mcp' }))?.text).toBe('▶\uFE0E')
  expect((await pane.find({ in: 'fold-todo' }))?.text).toBe('▼')
  await pane.pointer({ type: 'down', x: 0, y: 0, button: 'left', in: 'fold-mcp' })
  await pane.pointer({ type: 'down', x: 0, y: 0, button: 'left', in: 'fold-todo' })
  expect((await pane.find({ in: 'fold-mcp' }))?.text).toBe('▼')
  expect((await pane.find({ in: 'fold-todo' }))?.text).toBe('▶\uFE0E')
})

// The sections in drawn order, by their title rows' keys.
const sectionsOf = async (pane: { findAll(query: { type: 'Client' }): Promise<{ key?: string }[]> }) =>
  (await pane.findAll({ type: 'Client' })).flatMap(({ key }) => /^foldrow-(\w+)$/.exec(key ?? '')?.slice(1) ?? [])

test('with no order set, the sections draw in registry order between the header and footer', async ($, on) => {
  mock.clock(on)
  const pane = await $.ui.mount({ ...PANE, props: paneProps('dock', 60) })
  expect(await sectionsOf(pane)).toEqual(['context', 'limits', 'todo', 'skills', 'mcp', 'agents'])
})

test(
  'the order setting reorders the sections; a disabled one stays out',
  { options: { order: 'agents,mcp,nope', todo_enable: false } },
  async ($, on) => {
    mock.clock(on)
    const pane = await $.ui.mount({ ...PANE, props: paneProps('dock', 60) })
    expect(await sectionsOf(pane)).toEqual(['agents', 'mcp', 'context', 'limits', 'skills'])
  },
)

test('a fold arrow draws muted, and accent under the pointer', async ($) => {
  const pane = await $.ui.mount({ ...PANE, props: paneProps('dock') })
  const color = async () => (await pane.find({ in: 'fold-mcp' }))?.props.color
  expect(await color()).toBe('inactive')
  await pane.pointer({ type: 'enter', x: 0, y: 0, in: 'fold-mcp' })
  expect(await color()).toBe('suggestion')
  await pane.pointer({ type: 'leave', x: 0, y: 0, in: 'fold-mcp' })
  expect(await color()).toBe('inactive')
})

test('while the Sidebar holds the focus, fold arrows are Buttons the keyboard reaches', async ($) => {
  const pane = await $.ui.mount({ ...PANE, props: paneProps('dock', 30, true) })
  expect((await pane.find({ type: 'Button', key: 'fold-mcp' }))?.props).toMatchObject({ label: '▼', dimColor: true })
  await pane.press({ key: 'fold-mcp' })
  expect((await pane.find({ key: 'fold-mcp' }))?.text).toBe('▶\uFE0E')
})

// #110: a click anywhere on a title row folds its section. The title and the
// count or summary are one `foldrow-<id>` Client, under the same key whether
// or not the Sidebar holds the focus.
test('a click on a title row folds and unfolds its section', async ($) => {
  const pane = await $.ui.mount({ ...PANE, props: paneProps('dock') })
  expect((await pane.find({ in: 'foldrow-mcp', type: 'Text' }))?.text).toBe(' MCP:')
  await pane.pointer({ type: 'down', x: 20, y: 0, button: 'left', in: 'foldrow-mcp' })
  expect((await pane.find({ in: 'fold-mcp' }))?.text).toBe('▶\uFE0E')
  await pane.pointer({ type: 'down', x: 2, y: 0, button: 'left', in: 'foldrow-mcp' })
  expect((await pane.find({ in: 'fold-mcp' }))?.text).toBe('▼')
})

// Left to `flexGrow`, the region took the arrow's cell too and pushed the
// count into the right padding (#83, 2.1.292).
test('a title row takes the section row less the arrow’s cell', async ($) => {
  const pane = await $.ui.mount({ ...PANE, props: paneProps('dock') })
  // 42 columns less 4 of padding and the arrow's cell.
  expect((await pane.find({ key: 'foldrow-mcp' }))?.props).toMatchObject({ width: 37, flexGrow: 1 })
})

// The pure Sidebar leaves each Client placeholder nested inside its title row's Box;
// the render hook draws each one there as its Client, under the placeholder's key and props.
test('a Client placeholder nested in a title row draws as its Client in place', async ($) => {
  const pane = await $.ui.mount({ ...PANE, props: paneProps('dock') })
  const [row] = (await pane.findAll({ type: 'Box' })).filter(({ children }) => JSON.stringify(children).includes('"foldrow-mcp"')).slice(-1)
  expect(row?.children).toMatchObject([
    { type: 'Client', props: { key: 'fold-mcp', module: 'hooks/press.tsx', props: { label: '▼', scope: 'foldrow-mcp' } } },
    { type: 'Client', props: { key: 'foldrow-mcp', module: 'hooks/foldrow.tsx', width: 37, flexGrow: 1, props: { title: 'MCP', scope: 'foldrow-mcp' } } },
  ])
})

test('while the Sidebar holds the focus, the first click on a title row folds', async ($) => {
  const pane = await $.ui.mount({ ...PANE, props: paneProps('dock', 30, true) })
  expect((await pane.find({ key: 'foldrow-todo' }))?.type).toBe('Client')
  await pane.pointer({ type: 'down', x: 2, y: 0, button: 'left', in: 'foldrow-todo' })
  expect((await pane.find({ key: 'fold-todo' }))?.text).toBe('▶\uFE0E')
  expect((await pane.find({ key: 'foldrow-todo' }))?.type).toBe('Client')
})

test('a title row lights in accent as one with its fold arrow, with no underline', async ($) => {
  const pane = await $.ui.mount({ ...PANE, props: paneProps('dock') })
  // The surface applies a `hover` while the pointer is anywhere in its scope.
  const scope = 'foldrow-mcp'
  const row = (await pane.drawn({ in: 'foldrow-mcp' })) as { hover: unknown; children: { hover: unknown }[] }
  expect(row).toMatchObject({
    type: 'Box',
    children: [{ type: 'Text', props: { bold: true, color: 'text' } }, { type: 'Box' }],
  })
  expect(row.hover).toEqual({ scope })
  expect(row.children[0]?.hover).toEqual({ scope, color: 'suggestion' })
  expect(await pane.drawn({ in: 'fold-mcp' })).toMatchObject({
    type: 'Text',
    props: { color: 'inactive' },
    hover: { scope, color: 'suggestion' },
  })
})

test('after a wheel tick, a click on a moved title folds that section', async ($) => {
  // 8 body rows leave 6 for the sections, each title after the first 4 rows
  // with its blank rows and rule; a tick drops Context.
  const pane = await $.ui.mount({ ...PANE, props: paneProps('dock', 8) })
  const titles = async () =>
    (await pane.findAll({ type: 'Client' })).map((client) => client.key).filter((key) => key?.startsWith('foldrow-'))
  await $.ui.scroll({
    component: 'Pane',
    requestId: 'sidebar',
    offset: 1,
    by: 1,
    bodyRows: 8,
    contentRows: 8,
    origin: { kind: 'person' },
  })
  await pane.redraw()
  expect((await titles())[0]).toBe('foldrow-limits')
  await pane.pointer({ type: 'down', x: 2, y: 0, button: 'left', in: 'foldrow-limits' })
  // Only Limits folded.
  const arrows = (await pane.findAll({ type: 'Client' })).filter((client) => client.key?.startsWith('fold-'))
  const folded = await Promise.all(arrows.map(async ({ key }) => [key, (await pane.find({ in: key! }))?.text]))
  expect(folded.filter(([, arrow]) => arrow === '▶\uFE0E')).toEqual([['fold-limits', '▶\uFE0E']])
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
  on('session.version', () => ({ value: { version: '2.1.300' } }))
  on('agent.list', () => ({ value: [] }))
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200000 }, rateLimits: [] } }))
  on('fs.read', () => ({ value: '{}' }))
  on('fs.exists', () => ({ value: false }))
  on('fs.stat', () => {
    throw new Error('ENOENT')
  })
  on('tool.list', () => ({ value: [] }))
  on('process.run', async ($, e) => {
    git.runs.push([...e.argv])
    await git.slow?.()
    const stdout = e.argv.includes('status') ? git.status : ''
    return { value: { exitCode: git.exitCode ?? 0, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
}

// The branch row's Devicons glyph, `dev-git_branch` (#136).
const BRANCH = '\ue725'

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
  expect(await pane.find({ text: `${BRANCH} main` })).toBeDefined()
  expect(await pane.find({ text: 'ctui: local, inherit' })).toBeDefined()
  expect(await pane.find({ text: 'claude cli: 2.1.300' })).toBeDefined()

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
  expect(await pane.find({ text: `${BRANCH} next` })).toBeDefined()
})

// The three commands `ctui/README.md` "What ctui watches" writes out.
test('a git refresh runs only the three read-only commands the README names', async ($, on) => {
  const clock = mock.clock(on)
  const git = { runs: [] as string[][], status: STATUS }
  host(on, git)
  await $.session.start({ cwd: '/home/a/Projects/x', surface: 'terminal', isInteractive: true })
  await clock.settle()
  expect(git.runs.filter((argv) => argv[0] === 'git').sort()).toEqual([
    ['git', '--no-optional-locks', 'diff', '--numstat', 'HEAD'],
    ['git', '--no-optional-locks', 'stash', 'list'],
    ['git', '--no-optional-locks', 'status', '--porcelain=v2', '--branch'],
  ])
})

// A `git_enable` or `versions_enable` an earlier ctui saved stays in settings.json.
test(
  'the git header and versions footer draw whatever an old setting says',
  { options: { git_enable: false, versions_enable: false } },
  async ($, on) => {
    const clock = mock.clock(on)
    host(on, { runs: [], status: STATUS })
    await $.session.start({ cwd: '/home/a/Projects/x', surface: 'terminal', isInteractive: true })
    await clock.settle()
    const pane = await $.ui.mount({ ...PANE, props: paneProps('dock') })
    expect(await pane.find({ text: `${BRANCH} main` })).toBeDefined()
    expect(await pane.find({ text: 'claude cli: 2.1.300' })).toBeDefined()
  },
)

test('outside a repo the header is the path alone', async ($, on) => {
  const clock = mock.clock(on)
  host(on, { runs: [], status: '', exitCode: 128 })
  await $.session.start({ cwd: '/srv/x', surface: 'terminal', isInteractive: true })
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, props: paneProps('dock') })
  expect(await pane.find({ text: '~/Projects/x' })).toBeDefined()
  expect(await pane.find({ text: /[\ue725\ue702\ue728]/ })).toBeUndefined()
})

test('on a detached HEAD the branch row shows the glyph and the short sha', async ($, on) => {
  const clock = mock.clock(on)
  const status = '# branch.oid 63568e2e396d887fc74b6f1d1f21f4c539c12044\n# branch.head (detached)'
  host(on, { runs: [], status })
  await $.session.start({ cwd: '/home/a/Projects/x', surface: 'terminal', isInteractive: true })
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, props: paneProps('dock') })
  expect(await pane.find({ text: `${BRANCH} 63568e2` })).toBeDefined()
})

test('a clean repo with no upstream shows the branch row alone, with no lone glyph', async ($, on) => {
  const clock = mock.clock(on)
  host(on, { runs: [], status: '# branch.oid c1e879e48fada468970e942e80559adfe77c8713\n# branch.head main' })
  await $.session.start({ cwd: '/home/a/Projects/x', surface: 'terminal', isInteractive: true })
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, props: paneProps('dock') })
  expect(await pane.find({ text: `${BRANCH} main` })).toBeDefined()
  expect(await pane.find({ text: /[\ue702\ue728]/ })).toBeUndefined()
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
