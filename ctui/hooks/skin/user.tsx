import type { ElementTable, PromptOrigin, RenderElement } from 'claude-code'

// MEMORY.md "`UserMessage` rewrites draw the person's own prompts only".
const OWN = new Set<PromptOrigin['kind']>(['composer', 'bridge', 'sdk'])

export const isOwnPrompt = (origin: PromptOrigin) => OWN.has(origin.kind)

// The prompt as the engine draws it: `<pasted_content …>` tags and leading
// and trailing newlines removed.
const promptText = (text: string) => text.replace(/<\/?pasted_content\b[^>]*>/g, '').replace(/^\n+|\n+$/g, '')

// The panel's chrome in cells: the row's left padding of 1, which the bar
// fills, and the body's horizontal padding of 2 on each side (#450).
const CHROME = 5

// Wide characters and long unbreakable words can leave as little as a quarter
// of a row used, so each line wraps at most once per quarter of the inner
// width (#450).
const FILL = 4

// The bar's length in rows: at least as tall as any wrap of the text can make
// the row, and never more than one row per character plus three, which is the
// length with no `columns`.
function barLength(shown: string, right: number, columns?: number) {
  const most = shown.length + 3
  if (columns === undefined) return most
  const cells = Math.max(1, Math.floor(Math.max(1, columns - CHROME - right) / FILL))
  const rows = shown.split('\n').reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / cells)), 3)
  return Math.min(rows, most)
}

// The thin `┃` bar beside the panel. The bar is taller than any wrap of the
// text can make the row; the row's `overflow: 'hidden'` clips it. `columns` is
// the transcript's width, from the render's viewport.
export function userMessage({ Box, Text }: ElementTable, text: string, right = 0, columns?: number): RenderElement {
  const shown = promptText(text)
  const bar = Array.from({ length: barLength(shown, right, columns) }, () => '┃').join('\n')
  return (
    <Box marginTop={1} paddingLeft={1} paddingRight={right} overflow="hidden">
      <Box position="absolute" top={0} bottom={0} left={0} width={1}>
        <Text color="promptBorder">{bar}</Text>
      </Box>
      <Box flexGrow={1} backgroundColor="userMessageBackground" paddingX={2} paddingY={1}>
        <Text>{shown}</Text>
      </Box>
    </Box>
  )
}
