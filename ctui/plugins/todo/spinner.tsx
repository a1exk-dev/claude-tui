import type { ClientModule } from 'claude-code'

// PROTOTYPE (prototype/todo-spinner): the in-progress glyph, cycling `frames`
// every `ms` on the surface's own frame clock, so the Sidebar doesn't redraw.
export type SpinnerProps = { frames: string[]; ms: number; color: string }

const Spinner: ClientModule<SpinnerProps, number> = ({ frames, ms, color }, surface) => {
  if (surface.state === undefined) {
    surface.every(ms, () => surface.setState(((surface.state ?? 0) + 1) % frames.length))
    surface.setState(0)
  }
  const { Text } = surface.elements
  return <Text color={color}>{frames[(surface.state ?? 0) % frames.length]}</Text>
}

export default Spinner
