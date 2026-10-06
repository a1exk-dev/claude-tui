import type { Turn } from '../../types'
import { modeLabel } from '../format'

// MEMORY.md "The turn footer: prefix the turn's mode and model to Claude Code's `word`".

// The newest finished turn that lasted `durationMs`: the one the footer closes.
export const turnOf = (turns: readonly Turn[] | undefined, durationMs: number) =>
  turns?.findLast((turn) => turn.durationMs === durationMs)

// `accept edits · claude-opus-5-5 · Baked`: the engine draws `for 12s` and the rest after it.
export const turnWord = (word: string, { mode, model }: Turn) => `${modeLabel(mode)} · ${model} · ${word}`
