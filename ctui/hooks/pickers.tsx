import type { ElementTable, RenderElement, RenderSurface } from 'claude-code'

export type PickerInput = {
  ui: ElementTable<Exclude<RenderSurface, 'mobile'>> // the surfaces that draw a Select
  key: string // the Select's key: the `ui.select` matcher's `element`
  title: string
  options: readonly string[]
  value?: string
}

// A picker pane's body: a dim title over a focused `Select`. The pick is
// handled by register.tsx's `ui.select` hook.
export function picker({ ui, key, title, options, value }: PickerInput): RenderElement {
  const { Box, Text, Select } = ui
  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Text dimColor>{title}</Text>
      <Select
        key={key}
        options={options.map((option) => ({ value: option }))}
        {...(value !== undefined && { value })}
        autoFocus
        // Required; register.tsx's `ui.select` hook handles the pick.
        onSelect={() => undefined}
      />
    </Box>
  )
}
