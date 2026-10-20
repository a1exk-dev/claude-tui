import type { ClientModule } from 'claude-code'

export type SpinnerProps = { frames: string[]; ms: number; color: string }

// The Todo task in progress's glyph: `frames` in turn, one every `ms`, on the
// surface's own frame clock, so the Sidebar doesn't redraw.
const Spinner: ClientModule<SpinnerProps, number> = ({ frames, ms, color }, surface) => {
  if (surface.state === undefined) {
    surface.every(ms, () => surface.setState(((surface.state ?? 0) + 1) % frames.length))
    surface.setState(0)
  }
  const { Text } = surface.elements
  return <Text color={color}>{frames[surface.state ?? 0]}</Text>
}

export default Spinner
