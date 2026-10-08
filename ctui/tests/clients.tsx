import type { ClientSurface, ElementTable } from 'claude-code'

import FoldRow, { type FoldRowProps } from '../hooks/foldrow'
import Press, { type PressProps } from '../hooks/press'
import type { SidebarInput } from '../hooks/sidebar'

// A test plugin loads no surface module, so each Sidebar `Client` draws as
// the tree its module draws at rest: `press.tsx` or `foldrow.tsx`.
export function clientsAsTrees(ui: ElementTable): SidebarInput['ui'] {
  if (!('Client' in ui)) throw new Error('the Sidebar draws on the terminal')
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
  // The kit hands `module` as a path, not the source literal.
  const draws: Record<string, (props: unknown) => ReturnType<typeof Press>> = {
    'press.tsx': (props) => Press(props as PressProps, surface()),
    'foldrow.tsx': (props) => FoldRow(props as FoldRowProps, surface()),
  }
  return {
    ...ui,
    Client: ({ module, props }) => {
      const draw = draws[module.split('/').pop()!]
      if (!draw) throw new Error(`no stub for the Client module ${module}`)
      return draw(props)
    },
  }
}
