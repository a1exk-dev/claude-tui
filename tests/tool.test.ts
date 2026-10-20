import type { RenderPropsOf } from 'claude-code'
import { expect, test } from 'claude-code/testing'

import { toolLine } from '../hooks/skin/tool'

const where = { cwd: '/home/me/proj', home: '/home/me' }

const call = (tool: string, input: unknown, state: Partial<RenderPropsOf['ToolUse']> = {}): RenderPropsOf['ToolUse'] => ({
  tool_use_id: 'toolu_1',
  tool,
  input,
  isRunning: false,
  isErrored: false,
  isInterrupted: false,
  ...state,
})

const read = (state: Partial<RenderPropsOf['ToolUse']> = {}) => call('Read', { file_path: '/home/me/proj/src/a.ts' }, state)

test('tools other than Read, Edit, Write and Bash pass through', () => {
  expect(toolLine(call('Agent', { prompt: 'x' }), where)).toBeUndefined()
  expect(toolLine(call('mcp__x__y', {}), where)).toBeUndefined()
})

test('a path in the cwd is relative; outside it is absolute with ~ for home', () => {
  expect(toolLine(read(), where)).toMatchObject({ glyph: '→', tool: 'Read', subject: 'src/a.ts' })
  expect(toolLine(call('Read', { file_path: '/home/me/.claude/settings.json' }), where)?.subject).toBe('~/.claude/settings.json')
  expect(toolLine(call('Write', { file_path: '/tmp/x.txt' }), where)).toMatchObject({ glyph: '←', subject: '/tmp/x.txt' })
  expect(toolLine(call('Edit', { file_path: '/home/me/proj-b/a.ts' }), where)?.subject).toBe('~/proj-b/a.ts')
})

test('a Bash subject is the command, or its first line and … when it has more', () => {
  expect(toolLine(call('Bash', { command: 'npm test' }), where)).toMatchObject({ glyph: '$', tool: 'Bash', subject: 'npm test' })
  expect(toolLine(call('Bash', { command: 'cd x\nnpm test' }), where)?.subject).toBe('cd x …')
})

test('no summary while waiting for permission; `running` while it runs', () => {
  expect(toolLine(read(), where)?.summary).toBeUndefined()
  expect(toolLine(read({ isRunning: true }), where)).toEqual({ glyph: '→', tool: 'Read', subject: 'src/a.ts', summary: 'running' })
})

test('Read counts the lines it read', () => {
  const output = (numLines: number) => ({ type: 'text', file: { filePath: '/home/me/proj/src/a.ts', content: '', numLines, startLine: 1, totalLines: 90 } })
  expect(toolLine(read({ output: output(40) }), where)?.summary).toBe('40 lines')
  expect(toolLine(read({ output: output(1) }), where)?.summary).toBe('1 line')
})

test('Edit and Write count added and removed lines from the patch; a created file counts its lines', () => {
  const patch = [{ oldStart: 1, oldLines: 2, newStart: 1, newLines: 3, lines: [' a', '-b', '+c', '+d'] }]
  const edit = call('Edit', { file_path: '/home/me/proj/a.ts' }, { output: { filePath: '/home/me/proj/a.ts', structuredPatch: patch } })
  expect(toolLine(edit, where)?.summary).toBe('+2 -1')
  const update = call('Write', { file_path: '/home/me/proj/a.ts' }, { output: { type: 'update', content: 'c\nd\n', structuredPatch: patch } })
  expect(toolLine(update, where)?.summary).toBe('+2 -1')
  const create = call('Write', { file_path: '/home/me/proj/b.ts' }, { output: { type: 'create', content: 'a\nb\nc\n', structuredPatch: [] } })
  expect(toolLine(create, where)?.summary).toBe('+3')
})

test('Bash counts stdout plus stderr lines, else `no output`', () => {
  const bash = (stdout: string, stderr: string) => call('Bash', { command: 'ls' }, { output: { stdout, stderr, interrupted: false } })
  expect(toolLine(bash('a\nb\n', 'warn'), where)?.summary).toBe('3 lines')
  expect(toolLine(bash('a', ''), where)?.summary).toBe('1 line')
  expect(toolLine(bash('', ''), where)?.summary).toBe('no output')
})

test('an interrupted call reads `interrupted` in warning', () => {
  expect(toolLine(read({ isInterrupted: true, isErrored: true, output: 'Interrupted by user' }), where)).toMatchObject({
    summary: 'interrupted',
    tone: 'warning',
  })
})

test('an errored call shows the output\'s first line in error', () => {
  const failed = call('Bash', { command: 'false' }, { isErrored: true, output: 'Error: Exit code 1\nmore' })
  expect(toolLine(failed, where)).toMatchObject({ summary: 'Error: Exit code 1', tone: 'error' })
})
