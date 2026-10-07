import { expect, test } from 'claude-code/testing'

import { colors } from '../plugins/colors'
import { plugins } from '../plugins'

// Mounts every Sidebar plugin's view in a Pane, as the Sidebar does, with no
// data loaded yet: each view's rows must draw on the terminal surface.
test('every Sidebar plugin view draws with empty data', async ($, on) => {
  let current = plugins[0]
  let rows = 0
  on('ui.render', { component: 'Pane' }, async ($, e) => {
    const ui = $.ui.resolve(e)
    // 38: a header row's width at 42 columns.
    const view = current?.view({}, ui, { enable: true }, 38, colors()) ?? []
    rows = view.length
    return <ui.Box flexDirection="column">{view}</ui.Box>
  })
  for (const plugin of plugins) {
    current = plugin
    const pane = await $.ui.mount({
      plugin: 'ctui',
      surface: 'terminal',
      component: 'Pane',
      requestId: plugin.id,
      props: {
        title: 'Sidebar',
        isFocused: false,
        bodyColumns: 42,
        placement: 'dock',
        scroll: { offset: 0, bodyRows: 30 },
        view: {},
      },
    })
    const drawn = (await pane.drawn()) as { children?: unknown[] }
    expect(drawn.children ?? [], plugin.id).toHaveLength(rows)
    await pane.unmount()
  }
})
