import type { On, RenderPropsOf, TurnStepInput } from 'claude-code'
import { type Engine, expect, mock, test } from 'claude-code/testing'

// Scenario: the line under the prompt and the turn footer (docs/spec/v0.1.md
// slice 9) through register.tsx's hooks, with this test's own hooks beneath
// ctui standing in for the engine.

type World = { model: string; settings: Record<string, unknown> }

// Records the props each site reached the engine with, and draws it as the Text `engine`.
function host(on: On, world: World) {
  const seen: { SessionMode: RenderPropsOf['SessionMode'][]; TurnDuration: RenderPropsOf['TurnDuration'][] } = {
    SessionMode: [],
    TurnDuration: [],
  }
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('session.end', (_, e) => ({ sessionId: e.sessionId }))
  on('session.cwd', () => ({ value: '/srv/x' }))
  on('session.version', () => ({ value: { version: '2.1.288' } }))
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200000 }, rateLimits: [] } }))
  on('session.model', () => ({ value: world.model }))
  on('settings.read', () => ({ value: world.settings }))
  on('process.run', () => ({
    value: { exitCode: 128, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false },
  }))
  on('fs.exists', () => ({ value: false }))
  on('fs.stat', () => {
    throw new Error('ENOENT')
  })
  on('fs.read', () => ({ value: '{ "version": "0.0.0" }' }))
  on('env.get', () => ({ value: '1' }))
  on('tool.list', () => ({ value: [] }))
  on('agent.list', () => ({ value: [] }))
  on('ui.panes', () => ({ value: [] }))
  on('command.run', () => ({}))
  on('classic.UserPromptSubmit', () => ({}))
  on('classic.Stop', () => ({}))
  on('turn.step', async function* (_, e) {
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn', usage: null }
  })
  on('turn.complete', (_, e) => ({ text: e.answer }))
  on('ui.render', ($, e) => {
    if (e.component === 'SessionMode' || e.component === 'TurnDuration') {
      ;(seen[e.component] as unknown[]).push(e.props)
    }
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })
  return seen
}

const OPUS = 'claude-opus-5-5'
const start = ($: Engine) => $.session.start({ cwd: '/srv/x', surface: 'terminal', isInteractive: true })

const step = async ($: Engine, fields: Partial<TurnStepInput> = {}) => {
  const stream = $.turn.step({ turnId: 't1', index: 0, model: OPUS, messageCount: 1, ...fields })
  for await (const _ of stream);
}

const prompt = ($: Engine, permission_mode: string) =>
  $.classic.UserPromptSubmit({ prompt: 'hi', permission_mode })

const complete = ($: Engine, durationMs: number, reason: 'answer' | 'aborted' = 'answer') =>
  $.turn.complete({ answer: '', durationMs, isAborted: reason === 'aborted', turnId: 't1', reason })

const footer = ($: Engine, durationMs: number, requestId?: string) =>
  $.ui.mount({
    plugin: 'ctui',
    surface: 'terminal',
    component: 'TurnDuration',
    ...(requestId && { requestId }),
    props: { word: 'Baked', durationMs },
  })

const sessionMode = async ($: Engine, columns: number) => {
  const site = await $.ui.mount({
    plugin: 'ctui',
    surface: 'terminal',
    component: 'SessionMode',
    props: { modes: [] },
    viewport: { columns, rows: 40, isFullscreen: false },
  })
  return site
}

test("a finished turn's footer starts with its mode and model", async ($, on) => {
  const clock = mock.clock(on)
  const seen = host(on, { model: OPUS, settings: {} })
  await start($)
  await prompt($, 'acceptEdits')
  await step($, { model: 'claude-sonnet-5-5' })
  await complete($, 12000)
  await clock.settle()
  await footer($, 12000)
  expect(seen.TurnDuration).toEqual([{ word: 'accept edits · claude-sonnet-5-5 · Baked', durationMs: 12000 }])
})

// On 2.1.288 the footer of a turn a task notification opened can count from
// an earlier start (8975 ms for a 2900 ms turn; 2m 24s for a 3 s one).
test('a footer drawn right after its turn, with another duration, reads that turn', async ($, on) => {
  const clock = mock.clock(on)
  const seen = host(on, { model: OPUS, settings: {} })
  await start($)
  // A footer from before ctui loaded, drawn already.
  const old = await footer($, 55000, 'old')
  await prompt($, 'acceptEdits')
  await step($)
  await complete($, 2900)
  const fresh = await footer($, 144000, 'new')
  // The old one redrawn in the same moment stays plain.
  await old.redraw()
  await clock.settle()
  // A redraw later, as on scroll, still finds the new one.
  await clock.advance(10_000)
  await fresh.redraw()
  const words = (durationMs: number) =>
    new Set(seen.TurnDuration.filter((props) => props.durationMs === durationMs).map(({ word }) => word))
  expect(words(144000)).toEqual(new Set([`accept edits · ${OPUS} · Baked`]))
  expect(words(55000)).toEqual(new Set(['Baked']))
})

test('a footer with no record passes through', async ($, on) => {
  const clock = mock.clock(on)
  const seen = host(on, { model: OPUS, settings: {} })
  await start($)
  await clock.settle()
  await footer($, 4000)
  expect(seen.TurnDuration).toEqual([{ word: 'Baked', durationMs: 4000 }])
})

test('an aborted turn stores nothing', async ($, on) => {
  const clock = mock.clock(on)
  const seen = host(on, { model: OPUS, settings: {} })
  await start($)
  await prompt($, 'default')
  await step($)
  await complete($, 3000, 'aborted')
  await clock.settle()
  await footer($, 3000)
  expect(seen.TurnDuration).toEqual([{ word: 'Baked', durationMs: 3000 }])
})

test('a subagent’s steps leave the turn’s model alone', async ($, on) => {
  const clock = mock.clock(on)
  const seen = host(on, { model: OPUS, settings: {} })
  await start($)
  await prompt($, 'plan')
  await step($)
  await step($, { model: 'claude-haiku-4-5-20251001', agentId: 'a1' })
  await complete($, 5000)
  await clock.settle()
  await footer($, 5000)
  expect(seen.TurnDuration[0]?.word).toBe(`plan mode · ${OPUS} · Baked`)
})

test('the label joins the modes when it fits, or takes its own row', async ($, on) => {
  const clock = mock.clock(on)
  const seen = host(on, { model: OPUS, settings: { effortLevel: 'high' } })
  await start($)
  await clock.settle()
  await sessionMode($, 120)
  expect(seen.SessionMode).toEqual([{ modes: [`${OPUS} · high effort`] }])
  const narrow = await sessionMode($, 50)
  expect(seen.SessionMode).toHaveLength(1)
  expect(await narrow.drawn()).toMatchObject({ type: 'Box', props: { width: '100%' } })
  expect((await narrow.find({ type: 'Text' }))?.text).toBe(`${OPUS} · high effort`)
})

test('effort: seeded from settings, then the latest of a step, /effort and a saved pick', async ($, on) => {
  const clock = mock.clock(on)
  const world: World = { model: OPUS, settings: { effortLevel: 'medium', modelSettings: { [OPUS]: { effortLevel: 'high' } } } }
  const seen = host(on, world)
  await start($)
  await clock.settle()
  const site = await sessionMode($, 200)
  const label = async () => {
    await site.redraw({ modes: [] })
    return seen.SessionMode.at(-1)?.modes.at(-1)
  }
  expect(await label()).toBe(`${OPUS} · high effort`)

  await step($, { effort: 'xhigh' })
  expect(await label()).toBe(`${OPUS} · xhigh effort`)

  await $.command.run({ command: 'effort', args: 'low', origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 150 } })
  expect(await label()).toBe(`${OPUS} · low effort`)

  world.settings = { modelSettings: { [OPUS]: { effortLevel: 'max' } } }
  await clock.advance(1000)
  expect(await label()).toBe(`${OPUS} · max effort`)

  // A model with no effort: the step sends none.
  await step($, { model: 'claude-haiku-4-5-20251001' })
  expect(await label()).toBe(OPUS)
})

test('/model: the label follows the model and keeps the effort', async ($, on) => {
  const clock = mock.clock(on)
  const world: World = { model: OPUS, settings: { modelSettings: { [OPUS]: { effortLevel: 'high' }, 'claude-sonnet-5-5': { effortLevel: 'low' } } } }
  const seen = host(on, world)
  await start($)
  await clock.settle()
  world.model = 'claude-sonnet-5-5'
  await clock.advance(1000)
  await sessionMode($, 200)
  expect(seen.SessionMode.at(-1)?.modes).toEqual(['claude-sonnet-5-5 · high effort'])
})

test('while the Sidebar is docked the label fits the terminal, not the transcript', async ($, on) => {
  const clock = mock.clock(on)
  const seen = host(on, { model: OPUS, settings: { effortLevel: 'high' } })
  on('ui.open', () => ({ value: { isPlaced: true } }))
  await start($)
  await $.ui.mount({
    plugin: 'ctui',
    surface: 'terminal',
    component: 'PromptHint',
    props: { isDraft: false, isWorking: false, hint: '? for shortcuts · ← for agents' },
  })
  await clock.settle()
  // 2 + 24 + 1 + 30 + 2 + 29 = 88: no fit in the 77-column transcript, a fit in the 120-column terminal.
  await (await sessionMode($, 77)).unmount()
  expect(seen.SessionMode).toEqual([])
  await $.ui.mount({
    plugin: 'ctui',
    surface: 'terminal',
    component: 'Pane',
    requestId: 'sidebar',
    props: { title: 'Sidebar', isFocused: false, bodyColumns: 42, placement: 'dock', scroll: { offset: 0, bodyRows: 30 }, view: {} },
    viewport: { columns: 77, rows: 40, isFullscreen: true },
  })
  await clock.settle()
  await sessionMode($, 77)
  expect(seen.SessionMode).toEqual([{ modes: [`${OPUS} · high effort`] }])
})
