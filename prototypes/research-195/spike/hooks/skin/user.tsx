import type { ElementTable, PromptOrigin, RenderElement } from 'claude-code'

// MEMORY.md "`UserMessage` rewrites draw the person's own prompts only".
const OWN = new Set<PromptOrigin['kind']>(['composer', 'bridge', 'sdk'])

export const isOwnPrompt = (origin: PromptOrigin) => OWN.has(origin.kind)

// The prompt as the engine draws it: `<pasted_content …>` tags and leading
// and trailing newlines removed.
const promptText = (text: string) => text.replace(/<\/?pasted_content\b[^>]*>/g, '').replace(/^\n+|\n+$/g, '')

// The thin `┃` bar beside the panel. The bar is taller than any wrap of the
// text can make the row; the row's `overflow: 'hidden'` clips it.
export function userMessage({ Box, Text }: ElementTable, text: string, right = 0): RenderElement {
  const shown = promptText(text)
  const bar = Array.from({ length: shown.length + 3 }, () => '┃').join('\n')
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
