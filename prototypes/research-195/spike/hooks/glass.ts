// The Sidebar's glass (#80): a theme's background mixed 6% toward its
// foreground, one flat color (MEMORY.md "Sidebar colors inherit the Claude
// Code theme").

const channels = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
const HEX = /^#[0-9a-f]{6}$/i

// Omarchy's `mix a b N%`: an sRGB lerp, each channel rounded half up.
export function mix(a: string, b: string, w: number) {
  const to = channels(b)
  const mixed = channels(a).map((x, i) => Math.floor(x * (1 - w) + to[i]! * w + 0.5))
  return `#${mixed.map((x) => x.toString(16).padStart(2, '0')).join('')}`
}

// The glass ctui paints under `inherit` for a custom `/theme`'s overrides.
// Omarchy's template writes the theme's background to `inverseText` and its
// foreground to `text`. A theme that sets `composerSidebarBackground` already
// colors the whole dock, so it gets none.
export function inheritGlass(overrides: Readonly<Record<string, unknown>>): string | undefined {
  const { composerSidebarBackground, inverseText, text } = overrides
  if (composerSidebarBackground !== undefined) return undefined
  if (typeof inverseText !== 'string' || typeof text !== 'string' || !HEX.test(inverseText) || !HEX.test(text)) {
    return undefined
  }
  return mix(inverseText, text, 0.06)
}

// The file of a user custom theme, `custom:<name>`, in Claude Code's config
// dir. Built-in themes have none; a plugin's theme (`custom:<plugin>:<slug>`)
// isn't read.
export function themeFile(theme: unknown, configDir: string): string | undefined {
  const name = typeof theme === 'string' ? /^custom:([^:]+)$/.exec(theme)?.[1] : undefined
  return name === undefined ? undefined : `${configDir}/themes/${name}.json`
}
