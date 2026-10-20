import type { ClientSurface, ElementTable } from 'claude-code'

import FoldRow from '../hooks/foldrow'
import Press from '../hooks/press'
import type { SidebarInput } from '../hooks/sidebar'
import Spinner from '../plugins/todo/spinner'

// A test plugin loads no surface module, so each Sidebar `Client` draws as
// the tree its module draws at rest: `press.tsx`, `foldrow.tsx` or
// `spinner.tsx` on its first frame.
export function clientsAsTrees(table: ElementTable): SidebarInput['ui'] {
  if (!('Client' in table)) throw new Error('the Sidebar draws on the terminal')
  const { Client: _, ...ui } = table
  const surface = <S,>() =>
    ({
      elements: ui,
      state: undefined,
      setState: () => {},
      columns: 0,
      rows: 0,
      every: () => () => {},
      onPointer: () => () => {},
      onKey: () => () => {},
      post: () => {},
    }) as unknown as ClientSurface<S>
  return {
    ...ui,
    press: (_key, props) => Press(props, surface()),
    foldRow: (_key, _width, props) => FoldRow(props, surface()),
    sweep: (_key, props) => Spinner(props, surface()),
  }
}
