import type { ClientSurface } from 'claude-code'
import { expect, test } from 'claude-code/testing'

import Spinner from '../plugins/todo/spinner'

// The Todo spinner's surface module, drawn in a test Pane through a surface
// that holds its state and lets the test fire its `every` ticks.
test('each every tick steps to the next frame and wraps after ⠲', async ($, on) => {
  const ticks: { ms: number; fn: () => void }[] = []
  let state: number | undefined
  let surface: ClientSurface<number> | undefined
  on('ui.render', { component: 'Pane', requestId: 'unit' }, async ($, e) => {
    const ui = $.ui.resolve(e)
    surface ??= {
      elements: ui,
      get state() {
        return state
      },
      setState: (next: number) => {
        state = next
      },
      every: (ms: number, fn: () => void) => {
        ticks.push({ ms, fn })
        return () => {}
      },
    } as unknown as ClientSurface<number>
    return <ui.Box>{Spinner({ frames: ['⠴', '⠦', '⠖', '⠲'], ms: 100, color: 'warning' }, surface)}</ui.Box>
  })
  const pane = await $.ui.mount({
    plugin: 'test',
    surface: 'terminal',
    component: 'Pane',
    requestId: 'unit',
    props: {
      title: 'Sidebar',
      isFocused: false,
      bodyColumns: 42,
      placement: 'dock',
      scroll: { offset: 0, bodyRows: 4 },
      view: {},
    },
  })
  const frame = async () => {
    const text = await pane.find({ type: 'Text' })
    return [text?.text, text?.props.color]
  }
  expect(await frame()).toEqual(['⠴', 'warning'])
  const drawn = []
  for (let i = 0; i < 4; i++) {
    ticks[0]!.fn()
    await pane.redraw()
    drawn.push((await frame())[0])
  }
  expect(drawn).toEqual(['⠦', '⠖', '⠲', '⠴'])
  expect(ticks.map((tick) => tick.ms)).toEqual([100])
})
