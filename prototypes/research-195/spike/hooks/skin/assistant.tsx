import type { ElementTable, RenderElement, RenderNode } from 'claude-code'

// Assistant text without the bullet, lined up with the tool rows (map
// decision for #18). `drawn` is the engine's drawing with `isFirstOfReply: false`.
export const assistantMessage = ({ Box }: ElementTable, drawn: RenderNode, right = 0): RenderElement => (
  <Box paddingLeft={2} paddingRight={right}>
    {drawn}
  </Box>
)
