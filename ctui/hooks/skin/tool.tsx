import type { ElementTable, RenderElement, RenderPropsOf } from 'claude-code'

import { tildify } from '../git'

// MEMORY.md "Tool rows: glyph rows for Read, Edit, Write and Bash; results
// stay Claude Code's".
const GLYPHS = new Map([
  ['Read', '→'],
  ['Edit', '←'],
  ['Write', '←'],
  ['Bash', '$'],
])

export type ToolLine = {
  glyph: string
  tool: string
  subject: string
  summary?: string
  tone?: 'warning' | 'error' // `warning` colors the summary; `error` the glyph, tool and summary
}

// Whether ctui draws this tool's row.
export const hasToolRow = (tool: string) => GLYPHS.has(tool)

type Where = { cwd: string; home: string | undefined }

const lines = (n: number) => `${n} ${n === 1 ? 'line' : 'lines'}`

// Lines of text, a trailing newline not starting another.
const countLines = (text: string) => (text ? text.replace(/\n$/, '').split('\n').length : 0)

// A path in the cwd relative to it; outside it absolute, with `~` for home.
function shortPath(path: string, { cwd, home }: Where): string {
  return path.startsWith(`${cwd}/`) ? path.slice(cwd.length + 1) : tildify(path, home)
}

function subject(tool: string, input: Record<string, unknown>, where: Where): string {
  if (tool === 'Bash') {
    const [first = '', ...rest] = String(input.command ?? '').split('\n')
    return rest.length ? `${first} …` : first
  }
  return shortPath(String(input.file_path ?? ''), where)
}

function patchSummary(patch: { lines: string[] }[]): string {
  const all = patch.flatMap((hunk) => hunk.lines)
  return `+${all.filter((line) => line.startsWith('+')).length} -${all.filter((line) => line.startsWith('-')).length}`
}

function summary(tool: string, output: Record<string, unknown>): string | undefined {
  if (tool === 'Read') {
    const file = output.file as { numLines?: number } | undefined
    return typeof file?.numLines === 'number' ? lines(file.numLines) : undefined
  }
  if (tool === 'Bash') {
    const n = countLines(String(output.stdout ?? '')) + countLines(String(output.stderr ?? ''))
    return n ? lines(n) : 'no output'
  }
  if (output.type === 'create') return `+${countLines(String(output.content ?? ''))}`
  return Array.isArray(output.structuredPatch) ? patchSummary(output.structuredPatch) : undefined
}

// The first line of an error's text, without the engine's `<tool_use_error>` tags.
function firstErrorLine(output: unknown): string | undefined {
  if (typeof output !== 'string') return undefined
  return output
    .replace(/<\/?tool_use_error>/g, '')
    .split('\n')
    .find((line) => line.trim())
}

// The row for a call, or undefined for a tool ctui leaves to Claude Code.
export function toolLine(props: RenderPropsOf['ToolUse'], where: Where): ToolLine | undefined {
  const glyph = GLYPHS.get(props.tool)
  if (!glyph) return undefined
  const line: ToolLine = { glyph, tool: props.tool, subject: subject(props.tool, (props.input ?? {}) as Record<string, unknown>, where) }
  if (props.isInterrupted) return { ...line, summary: 'interrupted', tone: 'warning' }
  if (props.isErrored) return { ...line, summary: firstErrorLine(props.output), tone: 'error' }
  if (props.isRunning) return { ...line, summary: 'running' }
  // No output: waiting for permission.
  if (props.output === undefined || props.output === null || typeof props.output !== 'object') return line
  return { ...line, summary: summary(props.tool, props.output as Record<string, unknown>) }
}

// `→ Read  src/a.ts · 40 lines`, one row cut at the edge.
export function toolRow({ Box, Text }: ElementTable, { glyph, tool, subject, summary, tone }: ToolLine): RenderElement {
  const error = tone === 'error' ? 'error' : undefined
  return (
    <Box paddingLeft={2}>
      <Text wrap="truncate-end">
        <Text color={error}>
          {glyph} {tool}
        </Text>
        {`  ${subject}`}
        {summary ? (
          <Text color={tone} dimColor={!tone}>
            {` · ${summary}`}
          </Text>
        ) : null}
      </Text>
    </Box>
  )
}
