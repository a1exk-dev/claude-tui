// PROTOTYPE #212, throwaway. Lets the tool run as usual, then sends the person's
// own ctrl+t to the tmux pane, closing the list the call just opened.
import type { Register } from 'claude-code'

export const register: Register = on => {
  for (const tool of ['TaskCreate', 'TaskUpdate'] as const) {
    on('tool.call', { tool }, async ($, e, next) => {
      const done = await next(e)
      if (e.agentId === undefined) {
        const r = await $.process.run(['sh', '-c', 'tmux send-keys -t "$TMUX_PANE" C-t'])
        $.ui.status(`#212 ctrl+t after ${tool}: exit ${r.exitCode}`)
      }
      return done
    })
  }
}
