import type { On, RenderComponent, RenderPropsOf, RenderViewport } from 'claude-code'
import { type Engine, expect, mock, test } from 'claude-code/testing'

// Scenario: the transcript rewrites through `$.ui.mount`, with this test's own
// hooks beneath ctui standing in for the engine's drawing.

// Records the props each component reached the engine with, and draws it as
// the Text `engine`.
function host(on: On) {
  const seen: Partial<Record<RenderComponent, unknown[]>> = {}
  on('session.cwd', () => ({ value: '/home/me/proj' }))
  on('env.get', (_, e) => ({ value: e.name === 'HOME' ? '/home/me' : undefined }))
  on('ui.render', ($, e) => {
    ;(seen[e.component] ??= []).push(e.props)
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })
  return seen
}

const mount = <C extends RenderComponent>($: Engine, component: C, props: RenderPropsOf[C], viewport?: RenderViewport) =>
  $.ui.mount({ plugin: 'ctui', surface: 'terminal', component, props, ...(viewport && { viewport }) })

// The person's prompt at a transcript `columns` wide, or with no viewport.
const prompt = ($: Engine, text: string, columns?: number) =>
  mount($, 'UserMessage', { text, origin: { kind: 'composer' }, isExpanded: false }, columns === undefined ? undefined : { columns, rows: 40, isFullscreen: true })

// The bar's length in rows.
async function barRows(row: Awaited<ReturnType<typeof prompt>>) {
  const [bar] = await row.findAll({ type: 'Text', text: /^┃/ })
  return bar?.text.split('\n').length
}

const TOOL: RenderPropsOf['ToolUse'] = {
  tool_use_id: 'toolu_1',
  tool: 'Read',
  input: { file_path: '/home/me/proj/src/a.ts' },
  isRunning: false,
  isErrored: false,
  isInterrupted: false,
}

test('assistant text draws without the bullet, 2 columns in', async ($, on) => {
  const seen = host(on)
  const row = await mount($, 'AssistantMessage', { text: '# Title', isFirstOfReply: true })
  expect(seen.AssistantMessage).toEqual([{ text: '# Title', isFirstOfReply: false }])
  expect(await row.drawn()).toMatchObject({ type: 'Box', props: { paddingLeft: 2 }, children: [{ type: 'Text', children: ['engine'] }] })
})

test("the person's prompt draws the ┃ bar and panel, tags and edge newlines removed", async ($, on) => {
  const seen = host(on)
  const row = await mount($, 'UserMessage', {
    text: '\nfix it <pasted_content id="1">log line</pasted_content id="1">\n',
    origin: { kind: 'composer' },
    isExpanded: false,
  })
  expect(seen.UserMessage).toBeUndefined()
  expect(await row.drawn()).toMatchObject({ type: 'Box', props: { marginTop: 1, paddingLeft: 1, overflow: 'hidden' } })
  const [bar] = await row.findAll({ type: 'Text', text: '┃' })
  expect(bar?.props.color).toBe('promptBorder')
  expect(await row.find({ type: 'Text', text: /^fix it log line$/ })).toBeDefined()
  const [, , panel] = await row.findAll({ type: 'Box' })
  expect(panel?.props).toMatchObject({ backgroundColor: 'userMessageBackground', paddingX: 2, paddingY: 1 })
})

// A 107-column transcript leaves the panel 102 cells inside its chrome; a
// quarter of that is 25 cells a row, so 20,000 characters wrap to at most 800 rows.
test("a long prompt's bar is bounded by its wrapped rows, not its characters", async ($, on) => {
  host(on)
  const row = await prompt($, 'x'.repeat(20_000), 107)
  expect(await barRows(row)).toBe(803)
  const [, , panel] = await row.findAll({ type: 'Box' })
  expect(panel?.props).toMatchObject({ backgroundColor: 'userMessageBackground', paddingX: 2, paddingY: 1 })
})

test('with no viewport, the bar is one row per character plus three, as before', async ($, on) => {
  host(on)
  expect(await barRows(await prompt($, 'x'.repeat(20_000)))).toBe(20_003)
  expect(await barRows(await prompt($, 'fix it'))).toBe(9)
})

test('a prompt of many short lines counts each line as its own row', async ($, on) => {
  host(on)
  // 50 lines of 30 characters: 2 rows each at 25 cells a row.
  expect(await barRows(await prompt($, Array.from({ length: 50 }, () => 'y'.repeat(30)).join('\n'), 107))).toBe(103)
})

test('the bar is never longer than one row per character plus three, at any width', async ($, on) => {
  host(on)
  for (const text of ['fix it', 'a\n\n\nb', 'x'.repeat(300)]) {
    for (const columns of [1, 6, 9, 40, 107, 300]) {
      expect(await barRows(await prompt($, text, columns))).toBeLessThanOrEqual(text.length + 3)
    }
  }
  // A 6-column transcript leaves one cell a row: one row per character.
  expect(await barRows(await prompt($, 'fix it', 6))).toBe(9)
})

test('a task notification passes through', async ($, on) => {
  const seen = host(on)
  const props: RenderPropsOf['UserMessage'] = {
    text: 'Background command "sleep 3" completed',
    origin: { kind: 'task-notification' },
    isExpanded: false,
  }
  const row = await mount($, 'UserMessage', props)
  expect(seen.UserMessage).toEqual([props])
  expect(await row.drawn()).toMatchObject({ type: 'Text', children: ['engine'] })
})

test('a Read row draws one glyph row; it follows the call from running to done', async ($, on) => {
  host(on)
  const row = await mount($, 'ToolUse', { ...TOOL, isRunning: true })
  expect((await row.find({ type: 'Text' }))?.text).toBe('→ Read  src/a.ts · running')
  const file = { filePath: '/home/me/proj/src/a.ts', content: '', numLines: 40, startLine: 1, totalLines: 40 }
  await row.redraw({ ...TOOL, output: { type: 'text', file } })
  expect((await row.find({ type: 'Text' }))?.text).toBe('→ Read  src/a.ts · 40 lines')
  expect(await row.drawn()).toMatchObject({ type: 'Box', props: { paddingLeft: 2 } })
})

test('an errored Bash call colors its glyph, name and first line in error', async ($, on) => {
  host(on)
  const row = await mount($, 'ToolUse', {
    ...TOOL,
    tool: 'Bash',
    input: { command: 'exit 3' },
    isErrored: true,
    output: 'Error: Exit code 3\nmore',
  })
  expect((await row.find({ type: 'Text' }))?.text).toBe('$ Bash  exit 3 · Error: Exit code 3')
  const colored = (await row.findAll({ type: 'Text' })).filter((text) => text.props.color === 'error')
  expect(colored.map((text) => text.text)).toEqual(['$ Bash', ' · Error: Exit code 3'])
})

test('other tools pass through', async ($, on) => {
  const seen = host(on)
  const props = { ...TOOL, tool: 'Agent', input: { prompt: 'x' } }
  const row = await mount($, 'ToolUse', props)
  expect(seen.ToolUse).toEqual([props])
  expect(await row.drawn()).toMatchObject({ type: 'Text', children: ['engine'] })
})

test('a tool group unfolds into its calls', async ($, on) => {
  const seen = host(on)
  await mount($, 'ToolGroup', { calls: [], isActive: false, isExpanded: false })
  expect(seen.ToolGroup).toEqual([{ calls: [], isActive: false, isExpanded: true }])
})

// Docks the Sidebar: its Pane render records the dock's width.
async function dock($: Engine) {
  await $.ui.mount({
    plugin: 'ctui',
    surface: 'terminal',
    component: 'Pane',
    requestId: 'sidebar',
    props: { title: 'Sidebar', isFocused: false, bodyColumns: 42, placement: 'dock', scroll: { offset: 0, bodyRows: 30 }, view: {} },
  })
}

test('while the Sidebar is docked, the rows ctui draws end 2 columns before its rule', async ($, on) => {
  mock.clock(on)
  host(on)
  await dock($)
  const reply = await mount($, 'AssistantMessage', { text: 'hi', isFirstOfReply: true })
  expect(await reply.drawn()).toMatchObject({ type: 'Box', props: { paddingLeft: 2, paddingRight: 2 } })
  const prompt = await mount($, 'UserMessage', { text: 'fix it', origin: { kind: 'composer' }, isExpanded: false })
  expect(await prompt.drawn()).toMatchObject({ type: 'Box', props: { paddingLeft: 1, paddingRight: 2 } })
  const tool = await mount($, 'ToolUse', TOOL)
  expect(await tool.drawn()).toMatchObject({ type: 'Box', props: { paddingLeft: 2, paddingRight: 2 } })
})

// Docked, 106 columns less the chrome and the 2-column gap leave 99 cells:
// 24 a row, so 20,000 characters wrap to at most 834 rows.
test("while docked, the prompt's bar is bounded against the panel's narrower width", async ($, on) => {
  mock.clock(on)
  host(on)
  await dock($)
  expect(await barRows(await prompt($, 'x'.repeat(20_000), 106))).toBe(837)
})

test('with no Sidebar docked, the rows keep the full width', async ($, on) => {
  host(on)
  const reply = await mount($, 'AssistantMessage', { text: 'hi', isFirstOfReply: true })
  expect(await reply.drawn()).toMatchObject({ type: 'Box', props: { paddingRight: 0 } })
  const prompt = await mount($, 'UserMessage', { text: 'fix it', origin: { kind: 'composer' }, isExpanded: false })
  expect(await prompt.drawn()).toMatchObject({ type: 'Box', props: { paddingRight: 0 } })
  const tool = await mount($, 'ToolUse', TOOL)
  expect(await tool.drawn()).toMatchObject({ type: 'Box', props: { paddingRight: 0 } })
})
