import { expect, test } from 'claude-code/testing'

import { plugins } from '../plugins'

// Mounts every Sidebar plugin's view in a Pane, as register.tsx will, with no
// data loaded yet: each view must draw on the terminal surface.
test('every Sidebar plugin view draws with empty data', async ($, on) => {
  let current = plugins[0]
  on('ui.render', { component: 'Pane' }, async ($, e) => {
    const ui = $.ui.resolve(e)
    return <ui.Box>{current?.view({}, ui, {})}</ui.Box>
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
    expect(await pane.find({ type: 'Text' }), plugin.id).toBeDefined()
    await pane.unmount()
  }
})
