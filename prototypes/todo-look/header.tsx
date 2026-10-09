// PROTOTYPE — throwaway (map "ctui 0.5.0 Todo list", ticket "How should the
// Todo section look?"). Question 4: what does the Todo title row show at its
// right, expanded and folded?
// Chosen so far: row style A (today's); done rows stay in Claude's order;
// cap 8. Each variant draws a mock title row expanded (▼) and folded (▶) for
// one sample list (2 of 5 done, "Writing tests for power and modulo" current).
import type { RenderNode } from 'claude-code'

import type { Colors } from '../colors'
import type { SidebarPlugin } from '../plugin'

const COUNT = '2/5'
const CURRENT = 'Writing tests for power and modulo'

// A mock of the real title row: arrow, bold `Todo:`, the right side muted.
const title = (ui: any, c: Colors, width: number, arrow: string, right?: string): RenderNode => {
  const { Box, Text } = ui
  return (
    <Box width={width} height={1}>
      <Text color={c.muted}>{arrow}</Text>
      <Text bold color={c.main} wrap="truncate-end">
        {' '}
        Todo:
      </Text>
      <Box flexGrow={1} justifyContent="flex-end" paddingLeft={1}>
        {right ? (
          <Text color={c.muted} wrap="truncate-end">
            {right}
          </Text>
        ) : null}
      </Box>
    </Box>
  )
}

const VARIANTS: [string, string | undefined, string | undefined][] = [
  ['A · count; folded count · current (today)', COUNT, `${COUNT} · ${CURRENT}`],
  ['B · nothing (OpenCode)', undefined, undefined],
  ['C · count only', COUNT, COUNT],
  ['D · count; folded current only', COUNT, CURRENT],
]

const plugin: SidebarPlugin = {
  id: 'todo',
  title: 'Todo',
  slot: 'section',
  needs: ['todo'],
  view: (_data, ui, _cfg, width, c) => {
    const { Text } = ui
    return VARIANTS.flatMap(([label, expanded, folded], i) => [
      ...(i ? [<Text> </Text>] : []),
      <Text color={c.accent} bold>
        {label}
      </Text>,
      title(ui, c, width - 2, '▼', expanded),
      title(ui, c, width - 2, '▶︎', folded),
    ])
  },
  count: () => COUNT,
  summary: () => `${COUNT} · ${CURRENT}`,
}

export default plugin
