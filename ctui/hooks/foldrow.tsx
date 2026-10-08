import type { ClientModule, JsonValue, RenderElement } from 'claude-code'

// `right` is the count or folded summary: a string, or a plugin's
// `RenderElement` tree (MCP's colored `● 1`), which crosses as plain data.
export type FoldRowProps = {
  title: string
  right: JsonValue
  main: string
  muted: string
  accent: string
  scope: string
}

// A section's title row right of its fold arrow: the bold `<title>:`, then the
// count or folded summary at the right. A left click anywhere on it posts to
// the hooks module, which folds the section at `ui.message`. The row joins the
// arrow's hover `scope`, so the pointer anywhere on either draws both in
// `accent`. It draws under one key at rest and under the focus: a key swapped
// mid-click loses the click (#83).
const FoldRow: ClientModule<FoldRowProps> = ({ title, right, main, muted, accent, scope }, surface) => {
  surface.onPointer((e) => {
    if (e.type === 'down' && e.button === 'left') surface.post(null)
  })
  const { Box, Text } = surface.elements
  return (
    // Fills the region, so the right side ends at the row's right edge.
    <Box width="100%" hover={{ scope }}>
      <Text bold color={main} wrap="truncate-end" hover={{ scope, color: accent }}>
        {' '}
        {title}:
      </Text>
      <Box flexGrow={1} justifyContent="flex-end" paddingLeft={1}>
        {typeof right === 'string' ? (
          <Text color={muted} wrap="truncate-end">
            {right}
          </Text>
        ) : (
          (right as RenderElement | null)
        )}
      </Box>
    </Box>
  )
}

export default FoldRow
