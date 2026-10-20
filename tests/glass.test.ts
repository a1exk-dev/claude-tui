import { expect, test } from 'claude-code/testing'

import { grey, inheritGlass, mix, themeFile } from '../hooks/glass'

// Omarchy's Tokyo Night as `custom:omarchy`: `inverseText` is the theme's
// background and `text` its foreground; no dock color.
const TOKYO = { text: '#a9b1d6', inverseText: '#1a1b26', inactive: '#707590' }

test('mix rounds each channel half up, as Omarchy does', () => {
  expect(mix('#2d353b', '#d3c6aa', 0.06)).toBe('#373e42')
  expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080')
})

test('a custom theme without a dock color gets its 6% glass', () => {
  expect(inheritGlass(TOKYO)).toBe(mix('#1a1b26', '#a9b1d6', 0.06))
})

test('a theme that colors its own dock, or lacks a hex background or foreground, gets none', () => {
  expect(inheritGlass({ ...TOKYO, composerSidebarBackground: '#363d41' })).toBeUndefined()
  expect(inheritGlass({ text: '#a9b1d6' })).toBeUndefined()
  expect(inheritGlass({ ...TOKYO, inverseText: 'ansi:black' })).toBeUndefined()
})

test('grey keeps the luminance of a dark or light glass on equal channels', () => {
  // Solitude's and Everforest's glass, which 256 colors drew as #5f5f5f, and
  // Catppuccin Latte's, which it drew as #d7ffff.
  expect(grey('#1b1e20')).toBe('#1e1e1e')
  expect(grey('#363d41')).toBe('#3c3c3c')
  expect(grey('#e5e7ed')).toBe('#e7e7e7')
})

test('only a user custom theme names a file; built-in and plugin themes name none', () => {
  expect(themeFile('custom:omarchy', '/home/a/.claude')).toBe('/home/a/.claude/themes/omarchy.json')
  expect(themeFile('dark', '/home/a/.claude')).toBeUndefined()
  expect(themeFile('custom:ctui:everforest', '/home/a/.claude')).toBeUndefined()
  expect(themeFile(undefined, '/home/a/.claude')).toBeUndefined()
})
