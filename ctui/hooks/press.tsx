import type { ClientModule } from 'claude-code'

export type PressProps = { label: string; color: string; hover: string }

// A Sidebar control in a role color: a fold arrow, `▸ N more` or `▾ show
// less`. A Button takes no color, so this surface module draws the label and
// posts a left click to the hooks module, which answers it at `ui.message`.
// The pointer over it draws it in `hover`, as a dim Button lights up.
const Press: ClientModule<PressProps, boolean> = ({ label, color, hover }, surface) => {
  surface.onPointer((e) => {
    if (e.type === 'enter' || e.type === 'leave') surface.setState(e.type === 'enter')
    else if (e.type === 'down' && e.button === 'left') surface.post(null)
  })
  const { Text } = surface.elements
  return (
    <Text color={surface.state ? hover : color} wrap="truncate-end">
      {label}
    </Text>
  )
}

export default Press
