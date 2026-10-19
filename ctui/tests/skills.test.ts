import { expect, test } from 'claude-code/testing'

import { addSkill, dirSource, skillDirs, skillName, skillsFromMessages, sortedSkills, sourceOf, stated } from '../hooks/skills'

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

// #396: a skill with `disable-model-invocation: true` is in neither the skill
// listing nor, as a project skill, anywhere the command list can say so.
test('a skill the model can’t invoke takes its source from the event, else its folder', () => {
  // The command list calls every file-backed command `user`.
  const commands = [...COMMANDS, { name: 'wayfinder', description: '', source: 'user' as const }]
  expect(sourceOf('wayfinder', FRONTMATTER, commands)).toBe('user')
  expect(sourceOf('wayfinder', FRONTMATTER, commands, { source: 'projectSettings' })).toBe('project')
  expect(sourceOf('wayfinder', FRONTMATTER, commands, { source: 'plugin', pluginName: 'kit' })).toBe('kit')
  expect(sourceOf('wayfinder', FRONTMATTER, commands, { place: 'project' })).toBe('project')
  // An event that states no source reads `built-in`: the lookup decides.
  expect(sourceOf('tdd', FRONTMATTER, commands, { source: 'built-in' })).toBe('user')
  // The command list's plugin outranks a folder.
  expect(sourceOf('kit:notes', FRONTMATTER, commands, { place: 'project' })).toBe('kit')
})

test('the source a skill.prompt states, when it states one', () => {
  expect(stated({ skill: 'a', text: '', source: 'projectSettings' })).toEqual({ source: 'projectSettings', pluginName: undefined })
  expect(stated({ skill: 'a', text: '', source: 'plugin', pluginName: 'kit' })).toEqual({ source: 'plugin', pluginName: 'kit' })
  expect(stated({ skill: 'a', text: '' })).toEqual({ source: undefined, pluginName: undefined })
})

test('a skill folder is user under the config dir, project in another .claude', () => {
  const config = '/home/a/.claude'
  const text = (dir: string) => `Base directory for this skill: ${dir}\n\nDo the thing.`
  const dirs = skillDirs([
    text('/srv/x/.claude/skills/wayfinder'),
    'no skill here',
    text('/home/a/.claude/skills/notes'),
    text('/home/a/.claude/plugins/cache/kit/skills/review'),
  ])
  expect([...dirs.keys()]).toEqual(['wayfinder', 'notes', 'review'])
  expect([...dirs.values()].map((dir) => dirSource(dir, config))).toEqual(['project', 'user', undefined])
  expect(dirSource('/srv/x/.claude/commands/deploy', config)).toBe('project')
  expect(dirSource(undefined, config)).toBeUndefined()
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
