import { expect, test } from 'claude-code/testing'

import { addSkill, skillName, skillsFromMessages, sortedSkills, sourceOf } from '../hooks/skills'

// The `skills` Sidebar plugin's data (#175): each skill's source, the list's
// dedupe and order, and the rebuild from a resumed transcript's main rows.

// `$.session.usage` `skillFrontmatter` and `$.command.list()` as 2.1.292 gave them (#159).
const FRONTMATTER = [
  { name: 'tdd', source: 'userSettings', tokens: 1 },
  { name: 'deploy', source: 'projectSettings', tokens: 1 },
  { name: 'kit:review', source: 'plugin', pluginName: 'kit', tokens: 1 },
  { name: 'plugin-authoring', source: 'built-in', tokens: 1 },
  { name: 'team-style', source: 'syncedSkills', tokens: 1 },
]
const COMMANDS = [
  { name: 'context', description: '', source: 'builtin' as const },
  { name: 'kit:notes', description: '', source: 'plugin' as const, plugin: 'kit' },
  { name: 'standup', description: '', source: 'user' as const },
]

test('a skill’s source, from the skill listing, else the command list, else its prefix', () => {
  const source = (name: string) => sourceOf(name, FRONTMATTER, COMMANDS)
  expect(['tdd', 'deploy', 'kit:review', 'plugin-authoring', 'team-style'].map(source)).toEqual([
    'user',
    'project',
    'kit',
    'built-in',
    'synced',
  ])
  // Markdown commands that reach the model.
  expect(['kit:notes', 'standup'].map(source)).toEqual(['kit', 'user'])
  expect(source('acme:lint')).toBe('acme')
})

test('one row per skill and source; a repeat changes nothing', () => {
  const once = addSkill([], { name: 'tdd', source: 'user' })
  expect(addSkill(once, { name: 'tdd', source: 'user' })).toBe(once)
  expect(addSkill(once, { name: 'kit:tdd', source: 'kit' })).toHaveLength(2)
})

test('rows sort A–Z by the name without its plugin prefix, then by source', () => {
  const rows = [
    { name: 'pr:review', source: 'pr' },
    { name: 'tdd', source: 'user' },
    { name: 'code:review', source: 'code' },
    { name: 'Artifacts', source: 'built-in' },
  ]
  expect(sortedSkills(rows).map((row) => `${skillName(row.name)} ${row.source}`)).toEqual([
    'Artifacts built-in',
    'review code',
    'review pr',
    'tdd user',
  ])
})

test('a resumed transcript gives its known Skill tool uses and typed skills, never built-ins', () => {
  const messages = [
    { role: 'user' as const, text: '<command-message>tdd</command-message>\n<command-name>/tdd</command-name>', toolUses: [] },
    { role: 'user' as const, text: '<command-name>/context</command-name>', toolUses: [] },
    {
      role: 'assistant' as const,
      text: '',
      toolUses: [
        { tool_use_id: 'a', tool: 'Skill', input: { skill: 'kit:review' } },
        { tool_use_id: 'c', tool: 'Skill', input: { skill: 'no-such-skill' } },
        { tool_use_id: 'b', tool: 'Bash', input: { command: 'ls' } },
      ],
    },
    { role: 'user' as const, text: '<command-name>/tdd</command-name>', toolUses: [] },
  ]
  expect(skillsFromMessages(messages, new Set(['tdd', 'kit:review']))).toEqual(['tdd', 'kit:review'])
})
