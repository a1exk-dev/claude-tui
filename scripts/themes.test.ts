// Run by `node scripts/check.ts`, or alone: `node --test scripts/`.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { apca, build, deltaE, fill, mix, parseColors } from './themes.ts'

test('mix rounds like Omarchy', () => {
  // catppuccin's `inactive`, mix foreground background 40%, as Omarchy renders it.
  assert.equal(mix('#cdd6f4', '#1e1e2e', 0.4), '#878ca5')
  assert.equal(mix('#000000', '#ffffff', 0.5), '#808080')
})

test('apca matches the APCA-W3 reference values', () => {
  assert.ok(Math.abs(apca('#888888', '#ffffff') - 63.06) < 0.1)
  assert.ok(Math.abs(apca('#ffffff', '#888888') + 68.54) < 0.1)
  assert.ok(Math.abs(apca('#000000', '#aaaaaa') - 58.15) < 0.1)
  assert.equal(apca('#262626', '#262626'), 0)
})

test('deltaE is the OKLab distance times 100', () => {
  assert.ok(Math.abs(deltaE('#000000', '#ffffff') - 100) < 0.01)
  assert.equal(deltaE('#89b4fa', '#89b4fa'), 0)
})

test('parseColors keeps hex slots, lowercased, and the mode', () => {
  const colors = parseColors('mode = "light"\n\n# a comment\naccent = "#205EA6"\nhyprland_active_border = "rgba(26a269ee) 45deg"\n')
  assert.deepEqual(colors, { mode: 'light', accent: '#205ea6' })
})

test('fill substitutes keys and mixes, and refuses unknown keys', () => {
  const colors = { foreground: '#ffffff', background: '#000000' }
  assert.equal(fill('"{{ foreground }}" "{{ mix background foreground 50% }}"', colors), '"#ffffff" "#808080"')
  assert.throws(() => fill('{{ cyan }}', colors), /cyan/)
})

// The roles no chain slot passes, from #76 and #80. A palette or check change shows up here.
const flagged: Record<string, string[]> = {
  catppuccin: [],
  'catppuccin-latte': [],
  ethereal: [],
  everforest: [],
  'flexoki-light': ['success', 'warning', 'error'],
  gruvbox: [],
  hackerman: [],
  kanagawa: ['error'],
  'last-horizon': ['success', 'warning', 'error'],
  lumon: ['error'],
  lupine: [],
  'matte-black': ['warning'],
  miasma: ['success', 'error'],
  nord: ['error'],
  'osaka-jade': [],
  'retro-82': ['success'],
  ristretto: [],
  'rose-pine': ['success'],
  solitude: ['warning'],
  'tokyo-night': ['main', 'muted'],
  vantablack: ['error', 'accent'],
  white: [],
}

test('the bundled Themes flag the roles #76 found, and 10 of 22 pass every role', () => {
  const themes = build()
  assert.deepEqual(Object.fromEntries(themes.map((t) => [t.slug, t.flagged])), flagged)
  assert.equal(themes.filter((t) => t.flagged.length === 0).length, 10)
})

test('the glass steps down only on everforest and miasma', () => {
  const stepped = build().filter((t) => t.glass !== 0.06)
  assert.deepEqual(
    stepped.map((t) => [t.slug, t.glass, t.file.overrides.composerSidebarBackground]),
    [
      ['everforest', 0.055, '#363d41'],
      ['miasma', 0.055, '#2b2b2a'],
    ],
  )
})

test('each Theme is a whole Claude Code theme with the glass dock', () => {
  const template = Object.keys(JSON.parse(readFileSync(new URL('../vendor/omarchy/default/themed/claude.json.tpl', import.meta.url), 'utf8')).overrides)
  for (const { file, mode } of build()) {
    assert.equal(file.base, mode)
    assert.deepEqual(Object.keys(file.overrides), [...template, 'composerSidebarBackground'])
  }
})
