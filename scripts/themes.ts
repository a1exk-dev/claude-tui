// Builds ctui's Themes from the vendored Omarchy palettes: `node scripts/themes.ts`.
// Each Theme is Omarchy's claude.json.tpl filled with one built-in theme. The 7 Sidebar role
// keys come from the #76 chains under the #75 checks, and `composerSidebarBackground` is the
// #80 glass. It also writes the Theme table in docs/configuration.md. `node scripts/check.ts`
// fails when rerunning this would change a Theme or the table.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'

const root = new URL('..', import.meta.url)
const read = (path: string) => readFileSync(new URL(path, root), 'utf8')

const channels = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))

// Omarchy's `mix a b N%`: an sRGB lerp, rounded as its awk does.
export const mix = (a: string, b: string, w: number) => {
  const to = channels(b)
  const mixed = channels(a).map((x, i) => Math.floor(x * (1 - w) + to[i]! * w + 0.5))
  return `#${mixed.map((x) => x.toString(16).padStart(2, '0')).join('')}`
}

// APCA-W3 0.0.98G-4g lightness contrast Lc of text on a background, signed.
const apcaY = (hex: string) => {
  const [r, g, b] = channels(hex).map((c) => (c / 255) ** 2.4) as [number, number, number]
  const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b
  return y < 0.022 ? y + (0.022 - y) ** 1.414 : y
}
export const apca = (text: string, background: string) => {
  const t = apcaY(text)
  const b = apcaY(background)
  if (Math.abs(b - t) < 0.0005) return 0
  if (b > t) {
    const s = (b ** 0.56 - t ** 0.57) * 1.14
    return s < 0.1 ? 0 : (s - 0.027) * 100
  }
  const s = (b ** 0.65 - t ** 0.62) * 1.14
  return s > -0.1 ? 0 : (s + 0.027) * 100
}

// ΔE_OK: the OKLab distance times 100.
const linear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const oklab = (hex: string) => {
  const [r, g, b] = channels(hex).map((c) => linear(c / 255)) as [number, number, number]
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}
export const deltaE = (a: string, b: string) => {
  const to = oklab(b)
  return 100 * Math.hypot(...oklab(a).map((x, i) => x - to[i]!))
}

// A colors.toml: its hex slots, lowercased, and its mode. Other values (Hyprland gradients) drop.
export const parseColors = (toml: string) => {
  const colors: Record<string, string> = {}
  for (const [, key, value] of toml.matchAll(/^(\w+)\s*=\s*"([^"]*)"/gm)) {
    if (key === 'mode') colors.mode = value!
    else if (/^#[0-9a-f]{6}$/i.test(value!)) colors[key!] = value!.toLowerCase()
  }
  return colors
}

// Omarchy's template syntax: `{{ key }}` and `{{ mix a b N% }}`.
export const fill = (template: string, colors: Record<string, string>) => {
  const color = (key: string) => {
    const value = colors[key]
    if (value === undefined) throw new Error(`the template reads ${key}, which the palette lacks`)
    return value
  }
  return template.replace(/\{\{ *(?:mix +(\w+) +(\w+) +([\d.]+)%|(\w+)) *\}\}/g, (_, a, b, percent, key) =>
    key ? color(key) : mix(color(a), color(b), Number(percent) / 100),
  )
}

// The Sidebar roles in resolution order, with their theme keys and #76 chains.
const roles = ['main', 'muted', 'faint', 'success', 'warning', 'error', 'accent'] as const
type Role = (typeof roles)[number]
const keys: Record<Role, string> = {
  main: 'text',
  muted: 'inactive',
  faint: 'subtle',
  success: 'success',
  warning: 'warning',
  error: 'error',
  accent: 'suggestion',
}
// `inactive` is the template's own muted text, mix(foreground, background, 40%).
const chains: Record<Role, string[]> = {
  main: ['foreground'],
  muted: ['inactive', 'light_foreground'],
  faint: ['muted', 'dark_foreground', 'brown'],
  success: ['bright_green', 'green'],
  warning: ['yellow', 'orange'],
  error: ['red', 'bright_red'],
  accent: ['accent', 'blue', 'cyan', 'magenta'],
}

// The #75 checks of one role against the other roles chosen so far, text on `dock`.
const floors: Record<Role, number> = { main: 60, muted: 30, faint: 8, success: 30, warning: 30, error: 30, accent: 30 }
const tiers = [['main', 'muted', 15], ['muted', 'faint', 10]] as const
const statuses: readonly Role[] = ['success', 'warning', 'error']
const passes = (role: Role, hex: string, others: Partial<Record<Role, string>>, dock: string) => {
  const lc = (color: string) => Math.abs(apca(color, dock))
  const set = { ...others, [role]: hex }
  const apart = (from: readonly Role[], min: number) =>
    from.every((other) => other === role || !set[other] || deltaE(hex, set[other]) >= min)
  if (lc(hex) < floors[role]) return false
  if (role === 'main' || role === 'muted' || role === 'faint') {
    return tiers
      .filter(([upper, lower]) => upper === role || lower === role)
      .every(([upper, lower, min]) => !set[upper] || !set[lower] || lc(set[upper]) - lc(set[lower]) >= min)
  }
  return (
    (!set.muted || lc(hex) - lc(set.muted) >= -5) &&
    apart(['main', 'muted'], 8) &&
    (!statuses.includes(role) || apart(statuses, 5))
  )
}

// Each role takes the first chain slot that passes against the roles before it, or else the
// chain's first slot. `flagged` lists the roles that fail against the full set.
const resolve = (slots: Record<string, string>, dock: string) => {
  const chosen: Partial<Record<Role, string>> = {}
  for (const role of roles) {
    const present = chains[role].filter((slot) => slots[slot])
    const slot = present.find((s) => passes(role, slots[s]!, chosen, dock)) ?? present[0]
    if (!slot) throw new Error(`the palette has no ${role} slot`)
    chosen[role] = slots[slot]
  }
  const all = chosen as Record<Role, string>
  return { roles: all, flagged: roles.filter((role) => !passes(role, all[role], all, dock)) }
}

// The #80 glass: mix(background, foreground, 6%), lowered in 0.5% steps until every role that
// passes on Claude Code's base dock passes on the glass too.
const docks = { dark: '#262626', light: '#f5f5f5' }
const glass = (slots: Record<string, string>, mode: 'dark' | 'light') => {
  const base = resolve(slots, docks[mode]).flagged
  // In tenths of a percent: 6%, 5.5%, ...
  for (let permille = 60; ; permille -= 5) {
    const background = mix(slots.background!, slots.foreground!, permille / 1000)
    const result = resolve(slots, background)
    if (permille === 0 || result.flagged.every((role) => base.includes(role))) {
      return { ...result, background, weight: permille / 1000 }
    }
  }
}

// Omarchy's display name: `catppuccin-latte` is "Catppuccin Latte".
const title = (slug: string) => slug.replace(/(^|-)([a-z])/g, (_, dash, c) => dash + c.toUpperCase()).replaceAll('-', ' ')

export const build = () => {
  const template = read('vendor/omarchy/default/themed/claude.json.tpl')
  return readdirSync(new URL('vendor/omarchy/themes', root))
    .sort()
    .map((slug) => {
      const palette = parseColors(read(`vendor/omarchy/themes/${slug}/colors.toml`))
      const mode = palette.mode === 'light' ? 'light' : 'dark'
      // The two keys of Omarchy's alias cascade that the template reads and the palettes leave out.
      const file = JSON.parse(fill(template, { theme_type: mode, selection_background: palette.selection!, ...palette }))
      const result = glass({ ...palette, inactive: file.overrides.inactive }, mode)
      file.name = title(slug)
      for (const role of roles) file.overrides[keys[role]] = result.roles[role]
      file.overrides.composerSidebarBackground = result.background
      return { slug, mode, background: palette.background!, glass: result.weight, flagged: result.flagged, file }
    })
}

// Every generated file, path from the repo root to contents.
const tableStart = '<!-- Generated by `node scripts/themes.ts`. -->'
const tableEnd = '<!-- End of generated table. -->'
export const outputs = () => {
  const themes = build()
  const files = new Map(themes.map((t) => [`ctui/themes/${t.slug}.json`, `${JSON.stringify(t.file, null, 2)}\n`]))
  const table = [
    tableStart,
    '',
    '| Theme | Mode | Terminal background |',
    '|---|---|---|',
    ...themes.map((t) => `| \`${t.slug}\` | ${t.mode} | \`${t.background}\` |`),
    '',
    tableEnd,
  ].join('\n')
  const docs = read('docs/configuration.md')
  const start = docs.indexOf(tableStart)
  const end = docs.indexOf(tableEnd)
  if (start < 0 || end < start) throw new Error(`docs/configuration.md has no "${tableStart}" ... "${tableEnd}" block`)
  files.set('docs/configuration.md', docs.slice(0, start) + table + docs.slice(end + tableEnd.length))
  return files
}

if (import.meta.main) {
  mkdirSync(new URL('ctui/themes', root), { recursive: true })
  for (const [path, contents] of outputs()) writeFileSync(new URL(path, root), contents)
  for (const { slug, flagged } of build()) if (flagged.length) console.log(`${slug}: flagged ${flagged.join(', ')}`)
}
