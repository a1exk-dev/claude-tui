import type { ClientModule } from 'claude-code'

const Panel: ClientModule = (_props, surface) => {
  const { Text } = surface.elements
  return <Text>panel</Text>
}

export default Panel
