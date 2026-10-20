import type { On, RenderNode } from 'claude-code'
import { type Engine, expect, test } from 'claude-code/testing'

import type { SidebarInput } from '../hooks/sidebar'
import { colors } from '../plugins/colors'
import { frozenSweep, lead, MARKS, SWEEP, sweeping, tally } from '../plugins/marks'
import { clientsAsTrees } from './clients'

// The Sidebar's shared circle vocabulary: each mark's codepoint and its one
// colour role, the sweep's frames, and the two helpers every section draws its
// rows and its fold line with.

// The marks, as codepoints, so a changed glyph shows as a number.
test('every mark carries its codepoint and its one role', () => {
  const table = Object.fromEntries(
    Object.entries(MARKS).map(([name, { glyph, role }]) => [name, [glyph.codePointAt(0)?.toString(16), role]]),
  )
  expect(table).toEqual({
    checkbox_marked_circle: ['f0133', 'success'],
    checkbox_blank_circle_outline: ['f0130', 'faint'],
    check_circle_outline: ['f05e1', 'success'],
    alert_circle: ['f0028', 'warning'],
    radiobox_marked: ['f043e', 'warning'],
    close_circle: ['f0159', 'error'],
    minus_circle_outline: ['f0377', 'faint'],
    asterisk_circle_outline: ['f1a27', 'muted'],
  })
})

test('the sweep runs circle_slice_1 to 8, one frame every 100 ms', () => {
  expect(SWEEP.frames.map((frame) => frame.codePointAt(0)?.toString(16))).toEqual([
    'f0a9e',
    'f0a9f',
    'f0aa0',
    'f0aa1',
    'f0aa2',
    'f0aa3',
    'f0aa4',
    'f0aa5',
  ])
  expect(SWEEP.ms).toBe(100)
})

// `lead` and `tally` draw with the caller's element table, so both are read
// back off a test Pane, as a section's own view is.

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

// Draws `node(ui)` in a test Pane and returns it for reading. A `Client` draws
// as the tree its module draws at rest, so the sweep reads as its first frame.
async function draw($: Engine, on: On, node: (ui: SidebarInput['ui']) => RenderNode | undefined) {
  on('ui.render', { component: 'Pane', requestId: 'unit' }, async ($, e) => {
    const ui = clientsAsTrees($.ui.resolve(e))
    return <ui.Box flexDirection="column">{node(ui) ?? null}</ui.Box>
  })
  return $.ui.mount({ ...PANE, plugin: 'test', requestId: 'unit' })
}

test('a row lead is the mark in its role and two spaces before the text', async ($, on) => {
  const c = colors()
  const pane = await draw($, on, ({ Text }) => (
    <Text color={c.main}>
      {lead(Text, MARKS.checkbox_marked_circle, c)}
      Write the parser
    </Text>
  ))
  expect((await pane.find({ type: 'Text', text: /parser/ }))?.text).toBe('󰄳  Write the parser')
  expect((await pane.find({ type: 'Text', text: /^󰄳$/ }))?.props.color).toBe('success')
})

// Motion is the one exception to "one glyph, one colour": the sweep takes the
// role its row is in, so the caller hands it one.
test('a sweeping lead turns in the role it is handed, then the gap and the label', async ($, on) => {
  const c = colors()
  const pane = await draw($, on, (ui) => <ui.Box flexDirection="row">{sweeping(ui, 'spinner-x', 'sentry', c, 'error')}</ui.Box>)
  const frame = new RegExp(`^${SWEEP.frames[0]}$`, 'u')
  expect((await pane.find({ type: 'Text', text: frame }))?.props.color).toBe('error')
  expect((await pane.find({ type: 'Text', text: /sentry/ }))?.text).toBe('  sentry')
})

test('a fold line’s working term freezes the sweep at circle_slice_6 in the row’s own role', () => {
  expect(frozenSweep('error')).toEqual({ glyph: '\u{f0aa3}', role: 'error' })
  expect(SWEEP.frames[5]).toBe(frozenSweep('warning').glyph)
})

test('a tally draws each term’s mark, two spaces, its count, and two between terms', async ($, on) => {
  const c = colors()
  const pane = await draw($, on, ({ Text }) =>
    tally(
      Text,
      [
        { mark: MARKS.checkbox_marked_circle, count: 3 },
        { mark: frozenSweep('warning'), count: 1 },
        { mark: MARKS.checkbox_blank_circle_outline, count: 4 },
      ],
      c,
    ),
  )
  expect((await pane.find({ type: 'Text', text: /󰄳/ }))?.text).toBe('󰄳  3  󰪣  1  󰄰  4')
  const roles = (await pane.findAll({ type: 'Text', text: /^\S {2}\d$/u })).map((term) => term.props.color)
  expect(roles).toEqual(['success', 'warning', 'subtle'])
})

test('a term with no count is left out, and an all-empty tally draws nothing', async ($, on) => {
  const c = colors()
  const terms = [
    { mark: MARKS.checkbox_marked_circle, count: 0 },
    { mark: MARKS.checkbox_blank_circle_outline, count: 2 },
  ]
  const pane = await draw($, on, ({ Text }) => tally(Text, terms, c))
  expect((await pane.find({ type: 'Text', text: /󰄰/ }))?.text).toBe('󰄰  2')
  expect(tally({} as never, [{ mark: MARKS.close_circle, count: 0 }], c)).toBeUndefined()
})
