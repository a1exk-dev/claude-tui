import type { ElementTable, RenderElement } from 'claude-code'

// The `model · effort` label on its own row under the prompt, when it doesn't
// fit beside the hint: Claude Code gives a full-width tree its own row.
export const promptLabelRow = ({ Box, Text }: ElementTable, label: string): RenderElement => (
  <Box width="100%">
    <Text dimColor wrap="truncate-end">
      {label}
    </Text>
  </Box>
)
