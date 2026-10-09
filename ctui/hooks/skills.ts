import type { CommandInfo, ContextSkill, SessionMessage } from 'claude-code'

import type { SkillRow } from '../types'

// The `skills` Sidebar plugin's data (MEMORY.md "The `skills` Sidebar plugin
// lists every `skill.prompt`"): pure, from what register.tsx reads.

// The skill listing's engine words, as the row shows them.
const LABELS: Record<string, string> = { userSettings: 'user', projectSettings: 'project', syncedSkills: 'synced' }

// A skill's name as `/skills` lists it, less its `plugin:` prefix.
export const skillName = (name: string) => name.replace(/^[^:]+:/, '')

const prefixOf = (name: string) => /^([^:]+):/.exec(name)?.[1]

// Where a skill comes from: the skill listing, else (a markdown command) the
// command list, else its `plugin:` prefix, else `user`.
// `listed` is `$.session.usage` `skillFrontmatter`, `commands` `$.command.list()`.
export function sourceOf(name: string, listed: readonly ContextSkill[], commands: readonly CommandInfo[]) {
  const skill = listed.find((entry) => entry.name === name)
  if (skill) return skill.source === 'plugin' ? (skill.pluginName ?? prefixOf(name) ?? 'plugin') : (LABELS[skill.source] ?? skill.source)
  const command = commands.find((entry) => entry.name === name)
  if (command?.source === 'plugin') return command.plugin ?? prefixOf(name) ?? 'plugin'
  if (command?.source === 'builtin') return 'built-in'
  return prefixOf(name) ?? 'user'
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
