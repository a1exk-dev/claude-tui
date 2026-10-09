import type { Register } from 'claude-code'

// PROTOTYPE for #220, throwaway. Which nudge makes Opus 5.5 keep a task list?
// R220_V picks the variant: base | compose | submit | pin | pincompose | pinsubmit
const NUDGE = `# Task list
The user follows your progress in a task list shown beside the conversation. For any request that needs 2 or more distinct steps (edits, fixes, checks, delegated agents), your first action is to create one task per step with TaskCreate, before reading files or delegating. Set each task in_progress with TaskUpdate when you start it and completed as soon as it is done. Skip the list only for a single-step request or a pure question.`

let V = 'base'
async function cfg($: any) { V = (await $.env.get('R220_V')) ?? 'base' }
const has = (s: string) => V.includes(s)

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => { await cfg($); return next(e) })
  on('prompt.compose', async ($, e, next) => {
    await cfg($)
    const r = await next(e)
    if (!has('compose') || !e.tools.some((t: string) => t === 'TaskCreate' || t === 'TodoWrite')) return r
    return { sections: [...r.sections, { id: 'r220:nudge', text: NUDGE, scope: 'session' }] }
  })
  on('prompt.submit', async ($, e, next) => {
    await cfg($)
    return has('submit') ? next({ ...e, context: [...(e.context ?? []), NUDGE] }) : next(e)
  })
  on('tool.describe', async ($, e, next) => {
    await cfg($)
    const r = await next(e)
    return has('pin') && /^(TaskCreate|TaskUpdate)$/.test((e as any).tool) ? { ...r, isDeferred: false } : r
  })
}
