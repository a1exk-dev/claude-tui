// PROTOTYPE — throwaway (map "ctui 0.5.0 Todo list", ticket "How should the
// Todo section look?"). Question 5: what does the section show with no tasks,
// and once every task is done?
// Chosen so far: row style A (today's); Claude's order; cap 8; header count,
// folded `count · current`. Each variant mocks the section twice: an empty
// list, then a 4-task list with every task done. "(section hidden)" stands for
// a section the Sidebar leaves out.
import type { RenderNode } from 'claude-code'

import type { Colors } from '../colors'
import type { SidebarPlugin } from '../plugin'

const DONE = ['Add power function', 'Add modulo function', 'Write tests for power and modulo', 'Update README']

const title = (ui: any, c: Colors, width: number, right?: string): RenderNode => {
  const { Box, Text } = ui
  return (
    <Box width={width} height={1}>
      <Text color={c.muted}>▼</Text>
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

type Mock = (ui: any, c: Colors, width: number) => RenderNode[]

const dim = (ui: any, c: Colors, text: string) => (
  <ui.Text color={c.muted} wrap="truncate-end">
    {'  '}
    {text}
  </ui.Text>
)
const hidden = (ui: any, c: Colors) => (
  <ui.Text color={c.faint} italic wrap="truncate-end">
    (section hidden)
  </ui.Text>
)
const doneRows = (ui: any, c: Colors) =>
  DONE.map((task) => (
    <ui.Text wrap="truncate-end">
      {'  '}
      <ui.Text color={c.muted}>✓</ui.Text> <ui.Text color={c.muted}>{task}</ui.Text>
    </ui.Text>
  ))

const VARIANTS: [string, Mock, Mock][] = [
  [
    'A · 0/0, no rows; all done kept (today)',
    (ui, c, w) => [title(ui, c, w, '0/0')],
    (ui, c, w) => [title(ui, c, w, '4/4'), ...doneRows(ui, c)],
  ],
  [
    'B · hidden when empty or all done (OpenCode)',
    (ui, c) => [hidden(ui, c)],
    (ui, c) => [hidden(ui, c)],
  ],
  [
    'C · hint when empty; all done kept',
    (ui, c, w) => [title(ui, c, w), dim(ui, c, 'no tasks yet')],
    (ui, c, w) => [title(ui, c, w, '4/4'), ...doneRows(ui, c)],
  ],
  [
    'D · hint when empty; all done fold to one row',
    (ui, c, w) => [title(ui, c, w), dim(ui, c, 'no tasks yet')],
    (ui, c, w) => [title(ui, c, w, '4/4'), dim(ui, c, '✓ all 4 done')],
  ],
]

const plugin: SidebarPlugin = {
  id: 'todo',
  title: 'Todo',
  slot: 'section',
  needs: ['todo'],
  view: (_data, ui, _cfg, width, c) => {
    const { Text } = ui
    return VARIANTS.flatMap(([label, empty, allDone], i) => [
      ...(i ? [<Text> </Text>] : []),
      <Text color={c.accent} bold>
        {label}
      </Text>,
      <Text color={c.faint}>empty:</Text>,
      ...empty(ui, c, width - 2),
      <Text color={c.faint}>all done:</Text>,
      ...allDone(ui, c, width - 2),
    ])
  },
  count: () => '—',
}

export default plugin
