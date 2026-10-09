import type { On } from 'claude-code'
import { type Engine, expect, mock, test } from 'claude-code/testing'

import { colors } from '../plugins/colors'
import skills from '../plugins/skills'
import type { SkillRow } from '../types'
import { clientsAsTrees } from './clients'

// The `skills` Sidebar plugin (#175): its view with sample rows, and
// scenarios where `skill.prompt` and a resumed transcript fill it through
// register.tsx's hooks.

const ROWS: SkillRow[] = [
  { name: 'tdd', source: 'user' },
  { name: 'pr:review', source: 'pr' },
  { name: 'code:review', source: 'code' },
  { name: 'anthropic-skills:artifact-capabilities', source: 'anthropic-skills' },
  { name: 'git-guardrails-claude-code', source: 'user' },
]

const PANE = {
  surface: 'terminal',
  component: 'Pane',
  props: {
    title: 'Sidebar',
    isFocused: false,
    bodyColumns: 42,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

// Draws the view's rows in a test Pane, `width` cells wide as a section row is.
async function draw($: Engine, on: On, rows: SkillRow[], width = 36) {
  on('ui.render', { component: 'Pane', requestId: 'unit' }, async ($, e) => {
    const ui = clientsAsTrees($.ui.resolve(e))
    return <ui.Box flexDirection="column" width={width}>{skills.view({ skills: rows }, ui, { enable: true }, width, colors())}</ui.Box>
  })
  return $.ui.mount({ ...PANE, plugin: 'test', requestId: 'unit' })
}

// Each skill row's name and source: a Box spreading the two.
async function rowsOf(pane: Awaited<ReturnType<typeof draw>>) {
  const boxes = await pane.findAll({ type: 'Box' })
  return Promise.all(
    boxes
      .filter((box) => box.props.justifyContent === 'space-between')
      .map(async (box) => box.text.replace(/\s+/g, ' ')),
  )
}

test('rows: the name without its prefix, the source at the right; A–Z, then by source', async ($, on) => {
  const pane = await draw($, on, ROWS)
  expect(await rowsOf(pane)).toEqual([
    'artifact-capabilitiesanthropic-skills',
    'git-guardrails-claude-codeuser',
    'reviewcode',
    'reviewpr',
    'tdduser',
  ])
  const name = await pane.find({ type: 'Text', text: 'tdd' })
  const source = await pane.find({ type: 'Text', text: 'anthropic-skills' })
  expect([name?.props.color, name?.props.wrap, source?.props.color]).toEqual(['text', 'truncate-end', 'inactive'])
})

test('a long name truncates; the source stays whole', async ($, on) => {
  const pane = await draw($, on, [{ name: 'a-very-long-skill-name-that-does-not-fit', source: 'anthropic-skills' }], 30)
  const source = await pane.find({ type: 'Text', text: 'anthropic-skills' })
  expect(source).toBeDefined()
  // The source sits in a Box that never shrinks; only the name's Text truncates.
  const boxes = await pane.findAll({ type: 'Box' })
  expect(boxes.some((box) => box.props.flexShrink === 0 && box.text === 'anthropic-skills')).toBe(true)
})

test('the header counts the rows, open and folded; an empty chat reads 0 and no skills used yet', async ($, on) => {
  const ui = {} as never
  expect(skills.count?.({ skills: ROWS }, ui, { enable: true }, 36, colors())).toBe('5')
  expect(skills.summary?.({ skills: ROWS }, ui, { enable: true }, 36, colors())).toBe('5')
  expect(skills.count?.({ skills: [] }, ui, { enable: true }, 36, colors())).toBe('0')
  const pane = await draw($, on, [])
  const empty = await pane.find({ type: 'Text', text: 'no skills used yet' })
  expect(empty?.props.color).toBe('subtle')
})

// Scenario: the Sidebar through register.tsx's hooks.

type World = {
  messages?: { role: 'user' | 'assistant'; text: string; toolUses: { tool_use_id: string; tool: string; input: Record<string, unknown> }[] }[]
}

// The world beneath the plugin: the skill listing, the commands, the transcript.
function host(on: On, world: World = {}) {
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('session.cwd', () => ({ value: '/srv/x' }))
  on('session.version', () => ({ value: { version: '2.1.292' } }))
  on('env.get', () => ({ value: '/home/a' }))
  on('env.set', () => ({ value: undefined }))
  on('agent.list', () => ({ value: [] }))
  on('fs.read', () => ({ value: '{ "version": "0.0.0" }' }))
  on('session.usage', () => ({
    value: {
      startedAt: 0,
      context: {
        window: 200000,
        // A /context breakdown, trimmed to the skill listing.
        breakdown: {
          categories: [],
          totalTokens: 0,
          maxTokens: 200000,
          rawMaxTokens: 200000,
          autocompactSource: 'model-default',
          percentage: 0,
          gridRows: [],
          model: 'claude-opus-5-5',
          memoryFiles: [],
          mcpTools: [],
          agents: [],
          isAutoCompactEnabled: true,
          apiUsage: null,
          skills: {
            totalSkills: 2,
            includedSkills: 2,
            tokens: 2,
            skillFrontmatter: [
              { name: 'tdd', source: 'userSettings', tokens: 1 },
              { name: 'kit:review', source: 'plugin', pluginName: 'kit', tokens: 1 },
            ],
          },
        },
      },
      rateLimits: [],
    },
  }))
  on('command.list', () => ({ value: [{ name: 'context', description: '', source: 'builtin' }] }))
  on('session.messages', () => ({ value: world.messages ?? [] }))
  on('skill.prompt', (_, e) => ({ text: e.text }))
  // The other sections' loaders, empty.
  on('tool.list', () => ({ value: [] }))
  on('fs.exists', () => ({ value: false }))
  on('fs.stat', () => {
    throw new Error('ENOENT')
  })
  on('settings.read', () => ({ value: {} }))
  on('process.run', () => ({
    value: { exitCode: 128, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false },
  }))
}

const start = ($: Engine) => $.session.start({ cwd: '/srv/x', surface: 'terminal', isInteractive: true })
const sidebar = ($: Engine) => $.ui.mount({ ...PANE, plugin: 'ctui', requestId: 'sidebar' })

// The section's rows: the Text runs inside each skill row's spread Box.
async function sectionRows(pane: Awaited<ReturnType<typeof sidebar>>) {
  const boxes = await pane.findAll({ type: 'Box' })
  return boxes
    .filter((box) => box.props.justifyContent === 'space-between' && !/^[●!◐✕○]/.test(box.text))
    .map((box) => box.text.replace(/\s+/g, ' '))
}

test('each skill.prompt adds its skill once, with its source', async ($, on) => {
  const clock = mock.clock(on)
  host(on)
  await start($)
  await clock.settle()
  const pane = await sidebar($)
  expect(await pane.find({ type: 'Text', text: 'no skills used yet' })).toBeDefined()
  await $.skill.prompt({ skill: 'tdd', text: 'Test first.' })
  await $.skill.prompt({ skill: 'kit:review', text: 'Review.' })
  await $.skill.prompt({ skill: 'tdd', text: 'Skill /tdd is already loaded above; instructions unchanged' })
  await clock.settle()
  await pane.redraw()
  expect(await sectionRows(pane)).toEqual(['reviewkit', 'tdduser'])
  expect(await pane.find({ type: 'Text', text: '2', in: 'foldrow-skills' })).toBeDefined()
})

test('a reload keeps the list; /clear empties it', async ($, on) => {
  const clock = mock.clock(on)
  host(on)
  let cleared = false
  on('state.get', async ($, e, next) => (cleared && e.key === 'skills' ? { value: { value: undefined, version: 0 } } : next(e)))
  on('state.set', async ($, e, next) => {
    if (e.key === 'skills') cleared = false
    return next(e)
  })
  await start($)
  await $.skill.prompt({ skill: 'tdd', text: '' })
  await clock.settle()
  await start($) // a settings reload runs session.start again
  await clock.settle()
  const pane = await sidebar($)
  expect(await sectionRows(pane)).toEqual(['tdduser'])
  // `/clear`: a new chat with an empty transcript, $.state emptied.
  cleared = true
  await clock.advance(1000)
  await pane.redraw()
  expect(await pane.find({ type: 'Text', text: 'no skills used yet' })).toBeDefined()
})

test('a resume rebuilds the list from the transcript’s Skill uses and typed skills', async ($, on) => {
  const clock = mock.clock(on)
  host(on, {
    messages: [
      { role: 'user', text: '<command-name>/tdd</command-name>', toolUses: [] },
      { role: 'user', text: '<command-name>/context</command-name>', toolUses: [] },
      { role: 'assistant', text: '', toolUses: [{ tool_use_id: 'a', tool: 'Skill', input: { skill: 'kit:review' } }] },
    ],
  })
  await start($) // `claude --resume`: a new process, $.state empty
  await clock.settle()
  const pane = await sidebar($)
  expect(await sectionRows(pane)).toEqual(['reviewkit', 'tdduser'])
})

test('an in-process /resume rebuilds the list from the resumed transcript', async ($, on) => {
  const clock = mock.clock(on)
  const world: World = {}
  host(on, world)
  let cleared = false
  on('state.get', async ($, e, next) => (cleared && e.key === 'skills' ? { value: { value: undefined, version: 0 } } : next(e)))
  on('state.set', async ($, e, next) => {
    if (e.key === 'skills') cleared = false
    return next(e)
  })
  await start($)
  await $.skill.prompt({ skill: 'kit:review', text: '' })
  await clock.settle()
  // `/resume <id>`: no `session.start`, $.state emptied, the resumed transcript's rows.
  world.messages = [{ role: 'user', text: '<command-name>/tdd</command-name>', toolUses: [] }]
  cleared = true
  await clock.advance(1000)
  const pane = await sidebar($)
  expect(await sectionRows(pane)).toEqual(['tdduser'])
})

test('more than 4 skills cap at 4 rows and ▸ N more', async ($, on) => {
  const clock = mock.clock(on)
  host(on)
  await start($)
  for (const skill of ['a', 'b', 'c', 'd', 'e', 'f']) await $.skill.prompt({ skill, text: '' })
  await clock.settle()
  const pane = await sidebar($)
  expect(await sectionRows(pane)).toEqual(['auser', 'buser', 'cuser', 'duser'])
  expect((await pane.find({ in: 'more-skills' }))?.text).toBe('▸ 2 more')
  expect(await pane.find({ type: 'Text', text: '6', in: 'foldrow-skills' })).toBeDefined()
})

test('skills_enable off draws no Skills section', { options: { skills_enable: false } }, async ($, on) => {
  const clock = mock.clock(on)
  host(on)
  await start($)
  await clock.settle()
  const pane = await sidebar($)
  expect(await pane.find({ type: 'Client', key: 'foldrow-skills' })).toBeUndefined()
})

test('skills_folded starts the section folded', { options: { skills_folded: true } }, async ($, on) => {
  host(on)
  const pane = await sidebar($)
  expect((await pane.find({ in: 'fold-skills' }))?.text).toBe('▶︎')
})
