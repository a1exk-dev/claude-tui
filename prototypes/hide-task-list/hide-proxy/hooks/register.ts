// PROTOTYPE #212, throwaway. Runs TaskCreate/TaskUpdate as the mod's own
// `$.tool.call`, so the engine's `set_expanded_view` progress (which opens
// Claude Code's task list) never reaches the REPL. Claude reads the same result.
import type { Register } from 'claude-code'

export const register: Register = on => {
  for (const tool of ['TaskCreate', 'TaskUpdate'] as const) {
    on('tool.call', { tool }, async ($, e, next) => {
      if (e.agentId !== undefined) return next(e)
      const ran = await $.tool.call(e)
      $.ui.status(`#212 proxied ${tool}`)
      if (ran.deny !== undefined) return ran
      if (ran.isError) return { deny: ran.text ?? `${tool} failed` }
      return { result: ran.result }
    })
  }
}
