import type { CommandInfo, ContextSkill, SessionMessage } from 'claude-code'

import type { SkillRow } from '../types'

// The `skills` Sidebar plugin's data (MEMORY.md "The `skills` Sidebar plugin
// lists every `skill.prompt`"): pure, from what register.tsx reads.

// The skill listing's engine words, as the row shows them.
const LABELS: Record<string, string> = { userSettings: 'user', projectSettings: 'project', syncedSkills: 'synced' }

// A skill's name as `/skills` lists it, less its `plugin:` prefix.
export const skillName = (name: string) => name.replace(/^[^:]+:/, '')

const prefixOf = (name: string) => /^([^:]+):/.exec(name)?.[1]

// A source in the engine's words, as the row shows it.
const labelOf = (name: string, source: string, pluginName?: string) =>
  source === 'plugin' ? (pluginName ?? prefixOf(name) ?? 'plugin') : (LABELS[source] ?? source)

// What else tells a skill's source: the `skill.prompt` that ran it states
// `source` and `pluginName` (2.1.300 on), and `place` is what `dirSource` reads
// off the folder the skill's text says it was loaded from.
export type SkillHints = { source?: string; pluginName?: string; place?: string }

// The source and plugin a `skill.prompt` states; the floor's event has neither.
export const stated = (e: object): SkillHints => ({
  source: 'source' in e && typeof e.source === 'string' ? e.source : undefined,
  pluginName: 'pluginName' in e && typeof e.pluginName === 'string' ? e.pluginName : undefined,
})

// Where a skill comes from: the `skill.prompt`'s word, else the skill listing,
// else (a markdown command, or a skill the model can't invoke) the command
// list's plugin or built-in, else its folder, else its `plugin:` prefix, else
// `user`. An event's `built-in` is passed over: it is also what a call that
// states no source reads.
// `listed` is `$.session.usage` `skillFrontmatter`, `commands` `$.command.list()`.
export function sourceOf(name: string, listed: readonly ContextSkill[], commands: readonly CommandInfo[], hints: SkillHints = {}) {
  if (hints.source && hints.source !== 'built-in') return labelOf(name, hints.source, hints.pluginName)
  const skill = listed.find((entry) => entry.name === name)
  if (skill) return labelOf(name, skill.source, skill.pluginName)
  const command = commands.find((entry) => entry.name === name)
  if (command?.source === 'plugin') return command.plugin ?? prefixOf(name) ?? 'plugin'
  if (command?.source === 'builtin') return 'built-in'
  return hints.place ?? prefixOf(name) ?? 'user'
}

// Each skill's folder, by its name less any `plugin:` prefix, from the texts
// that load it: the engine opens a skill's text with
// `Base directory for this skill: <folder>`.
export function skillDirs(texts: readonly string[]): Map<string, string> {
  const dirs = new Map<string, string>()
  for (const text of texts) {
    for (const [, dir = ''] of text.matchAll(/^Base directory for this skill: (.+)$/gm)) dirs.set(dir.split('/').pop() ?? '', dir)
  }
  return dirs
}

// A skill folder's source by where it sits: the config dir's `skills/` or
// `commands/` is `user`, any other `.claude/skills/` or `.claude/commands/`
// `project`; elsewhere (a plugin's cache) it tells nothing.
export function dirSource(dir: string | undefined, configDir: string) {
  if (!dir) return undefined
  if (dir.startsWith(`${configDir}/skills/`) || dir.startsWith(`${configDir}/commands/`)) return 'user'
  return /\/\.claude\/(skills|commands)\//.test(dir) ? 'project' : undefined
}

// The list with `row` once: a skill used again changes nothing.
export function addSkill(rows: readonly SkillRow[], row: SkillRow): readonly SkillRow[] {
  return rows.some((held) => held.name === row.name && held.source === row.source) ? rows : [...rows, row]
}

// A–Z by the shown name, then by source.
export const sortedSkills = (rows: readonly SkillRow[]) =>
  [...rows].sort(
    (a, b) =>
      skillName(a.name).localeCompare(skillName(b.name), undefined, { sensitivity: 'base' }) ||
      a.source.localeCompare(b.source),
  )

// The known skills a resumed transcript's main rows show, first use first:
// each Skill tool use, and each typed `<command-name>` (built-ins like
// `/context` leave the same row; a failed Skill call names an unknown skill).
export function skillsFromMessages(messages: readonly SessionMessage[], known: ReadonlySet<string>): string[] {
  const names: string[] = []
  for (const message of messages) {
    for (const use of message.toolUses) {
      if (use.tool === 'Skill' && typeof use.input.skill === 'string' && known.has(use.input.skill)) names.push(use.input.skill)
    }
    for (const [, name = ''] of message.text.matchAll(/<command-name>\/?([^<]+)<\/command-name>/g)) {
      if (known.has(name)) names.push(name)
    }
  }
  return [...new Set(names)]
}
