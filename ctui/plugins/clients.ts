import type { RenderElement, RenderNode } from 'claude-code'

import type { FoldRowProps } from '../hooks/foldrow'
import type { PressProps } from '../hooks/press'
import type { SidebarClients } from './plugin'
import type { SpinnerProps } from './todo/spinner'

// A Client placeholder: where a Sidebar `Client` goes, as plain data: which of
// the three, its key, its width and its props. A Sidebar plugin leaves one in
// its tree, and the Sidebar's render hook in register.tsx draws each as its
// `Client`, the only place one is written (MEMORY.md "Sidebar plugins are
// pure; only `register.tsx` touches `$`").
export type ClientPlaceholder =
  | { client: 'press'; key: string; props: PressProps }
  | { client: 'foldRow'; key: string; width: number; props: FoldRowProps }
  | { client: 'sweep'; key: string; props: SpinnerProps }

// A placeholder in a tree: an empty Box that holds it until the hook draws its Client.
type Holder = RenderElement & { clientPlaceholder: ClientPlaceholder }

const holderOf = (clientPlaceholder: ClientPlaceholder): RenderElement => {
  const holder: Holder = { type: 'Box', clientPlaceholder }
  return holder
}

// The Sidebar's three Client draws, each returning its placeholder.
export const clientPlaceholders: SidebarClients = {
  press: (key, props) => holderOf({ client: 'press', key, props }),
  foldRow: (key, width, props) => holderOf({ client: 'foldRow', key, width, props }),
  sweep: (key, props) => holderOf({ client: 'sweep', key, props }),
}

// The placeholder `node` holds, if it holds one.
export const placeholderOf = (node: RenderNode): ClientPlaceholder | undefined =>
  typeof node === 'object' && 'clientPlaceholder' in node ? (node as Holder).clientPlaceholder : undefined
