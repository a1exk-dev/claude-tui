import type { RenderElement, RenderNode } from 'claude-code'

import type { FoldRowProps } from '../hooks/foldrow'
import type { PressProps } from '../hooks/press'
import type { SidebarClients } from './plugin'
import type { SpinnerProps } from './todo/spinner'

// Where a Sidebar `Client` goes, as plain data: which of the three, its key,
// its width and its props. A Sidebar plugin leaves one in its tree, and the
// Sidebar's render hook in register.tsx turns each into its `Client`, the
// only place one is written (MEMORY.md "Sidebar plugins are pure; only
// `register.tsx` touches `$`").
export type ClientMark =
  | { client: 'press'; key: string; props: PressProps }
  | { client: 'foldRow'; key: string; width: number; props: FoldRowProps }
  | { client: 'sweep'; key: string; props: SpinnerProps }

// A mark in a tree: an empty Box that carries it until the hook places its Client.
type Marked = RenderElement & { clientMark: ClientMark }

const leave = (clientMark: ClientMark): RenderElement => {
  const marked: Marked = { type: 'Box', clientMark }
  return marked
}

// The Sidebar's three Client draws, each leaving its mark.
export const clientMarks: SidebarClients = {
  press: (key, props) => leave({ client: 'press', key, props }),
  foldRow: (key, width, props) => leave({ client: 'foldRow', key, width, props }),
  sweep: (key, props) => leave({ client: 'sweep', key, props }),
}

// The mark `node` carries, if it is one.
export const markOf = (node: RenderNode): ClientMark | undefined =>
  typeof node === 'object' && 'clientMark' in node ? (node as Marked).clientMark : undefined
