import type { Register } from 'claude-code'

export const register: Register = (on) => {
  on('ui.render', { component: 'Pane', requestId: 'sidebar' }, ($, e) => {
    const { Box, Client } = $.ui.resolve(e)
    return (
      <Box>
        <Client module="./press.tsx" props={{ label: 'x', color: 'gray', hover: 'white' }} />
      </Box>
    )
  })
}
