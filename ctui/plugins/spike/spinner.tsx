import type { ClientModule } from 'claude-code'

export type SpinnerProps = { frames: string[]; ms: number; color: string; colors?: string[] }

// THROWAWAY SPIKE for #305. A glyph's frames and its colors turn on the
// surface's own clock, so the Sidebar doesn't redraw. A terminal cell has no
// alpha: a fade is drawn by stepping through the theme's text weights.
const Spinner: ClientModule<SpinnerProps, number> = ({ frames, ms, color, colors }, surface) => {
  if (surface.state === undefined) {
    const steps = Math.max(frames.length, colors?.length ?? 1)
    surface.every(ms, () => surface.setState(((surface.state ?? 0) + 1) % steps))
    surface.setState(0)
  }
  const step = surface.state ?? 0
  const { Text } = surface.elements
  return <Text color={colors?.length ? colors[step % colors.length] : color}>{frames[step % frames.length]}</Text>
}

export default Spinner
