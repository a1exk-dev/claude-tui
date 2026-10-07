import { expect, test } from 'claude-code/testing'

import { colors } from '../plugins/colors'

test('under inherit each role draws with its Claude Code theme key', () => {
  expect(colors()).toEqual({
    main: 'text',
    muted: 'inactive',
    faint: 'subtle',
    success: 'success',
    warning: 'warning',
    error: 'error',
    accent: 'suggestion',
  })
})

test("a Theme's override replaces its key; other keys stay key names", () => {
  expect(colors({ text: '#d3c6aa', subtle: '#475258', claude: '#7fbbb3' })).toEqual({
    main: '#d3c6aa',
    muted: 'inactive',
    faint: '#475258',
    success: 'success',
    warning: 'warning',
    error: 'error',
    accent: 'suggestion',
  })
})
