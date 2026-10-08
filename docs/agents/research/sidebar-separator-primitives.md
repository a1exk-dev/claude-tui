# Separator primitives a Sidebar Pane can draw (Claude Code 2.1.292)

Scope: issue #128, a child of map #126. Which separator primitives the mod renderer draws inside a Sidebar `Pane` on the pinned Claude Code version: `Box` borders, `backgroundColor` on a nested `Box`, box-drawing and block glyphs, and `Text` title styles. Every claim cites a primary source. **Inferred** marks what the sources imply without stating it outright, and **Unverified** marks what needs a live check.

**Source keys**

- **DTS Ln**: `vendor/claude-code-types/claude-code/index.d.ts`, the types the engine writes for 2.1.292 (MEMORY.md, "One pinned Claude Code version").
- **BIN @n**: the bundled engine JavaScript inside `node_modules/@anthropic-ai/claude-code/bin/claude.exe` (2.1.292, built with Bun v1.4.3), at byte offset `n`. Each excerpt is minified, so the offsets let a reader find it. To reproduce, read the file in Python and print `d[n-300:n+600]`.
- **SPIKE**: a one-line `bun -e` run of `Bun.stringWidth` on Bun 1.4.2, one patch release below the engine's 1.4.3.

## 1. Summary

| Primitive | Verdict |
|---|---|
| `borderStyle` presets | **Drawn**: `single`, `double`, `round`, `bold`, `singleDouble`, `doubleSingle`, `classic`, `arrow`, plus Claude Code's own `dashed` and `quote`. |
| Custom `borderStyle` object | **Refused**: a prop value must be a string, number or boolean, so the whole tree fails validation. |
| Unknown `borderStyle` string | **Dropped**: the border is stripped and logged, and the rest of the tree still draws. |
| `borderColor` with a theme key, hex, `rgb()`, `ansi256()`, `ansi:` or a named color | **Drawn**. |
| `borderDimColor` | **Drawn** (boolean). |
| Borders on some sides only (`borderTop`, `borderLeft` and so on) | **Refused**: they are not on the allowlist, so the whole tree fails validation. |
| Border cells against `bodyColumns` | **Taken from inside it**: the tree is laid out at `bodyColumns`, and a border uses one cell on each of its four sides inside that width. |
| `backgroundColor` on any `Box`, nested or root | **Drawn**, with the same color forms as `borderColor`. |
| `─ ━ ╌ ▔ ▁ ▌ ╭ ╮` | **One cell each** to the engine. `truncate-end` handles them like any other one-cell character. |
| `Text`: `bold`, `inverse`, `underline`, `dimColor`, `italic`, `strikethrough`, `color`, `backgroundColor` | **Drawn**. |

## 2. `Box` borders

### 2.1 Allowed props

- The types give `Box` exactly `borderStyle?: string`, `borderColor?: Color` and `borderDimColor?: boolean`, and no per-side border props (DTS L984-986, inside `BoxProps` at L901-990).
- The engine's prop allowlist matches the types. `Box` accepts `...,"borderStyle","borderColor","borderDimColor","backgroundColor","overflow","display","position","top","left","right","bottom"` and nothing else (BIN @206839749).
- The validator returns `` `${type} prop "${name}" is not allowed` `` for any prop missing from the allowlist (BIN @210091642). The types say that "a tree with any other prop fails validation as a whole and the engine's own component is drawn with the original props" (DTS L9298-9301). So `borderTop={false}` and the other per-side props refuse the **whole** Pane tree.
- The engine's own Ink renderer does support per-side borders. It reads `borderTop`, `borderBottom`, `borderLeft` and `borderRight`, each defaulting to on, and per-side colors (BIN @218068966). Claude Code uses these in its own UI, for example `borderStyle:"quote",borderTop:!1,borderBottom:!1,borderRight:!1` for block quotes (BIN @228244110). Mods cannot reach them through the allowlist.

### 2.2 `borderStyle` values

- `borderStyle` is validated against `yYt = new Set(JEs)` (BIN @206838297, rule at `noo.borderStyle`). `JEs` is the key set of the `cli-boxes` presets merged with two of Claude Code's own (BIN @206607163):

| Value | Top | Side | Corners |
|---|---|---|---|
| `single` | `─` | `│` | `┌ ┐ └ ┘` |
| `round` | `─` | `│` | `╭ ╮ ╰ ╯` |
| `bold` | `━` | `┃` | `┏ ┓ ┗ ┛` |
| `double` | `═` | `║` | `╔ ╗ ╚ ╝` |
| `singleDouble` | `─` | `║` | `╓ ╖ ╙ ╜` |
| `doubleSingle` | `═` | `│` | `╒ ╕ ╘ ╛` |
| `classic` | `-` | `\|` | `+` |
| `arrow` | `↓` / `↑` | `→` / `←` | `↘ ↙ ↗ ↖` |
| `dashed` | `╌` | `╎` | spaces |
| `quote` | space | `▎` on the left, space on the right | spaces |

- **Unknown string**: `isUnknownBorder` is `(e,n)=>e==="borderStyle"&&!(typeof n==="string"&&yYt.has(n))` (BIN @210091827). The validator skips such a value (`if(EEn(qt,un))continue;`, BIN @210091642), and a later pass strips `borderStyle` from the props and reports it (`CEn`, BIN @210092865). The border is not drawn, and the rest of the tree is.
- **Custom object**: any prop value that is not a string, number or boolean fails the whole tree with `` `${type} prop "${name}" is ${kind}` `` (BIN @210091642). `StyledElement.props` is typed `Record<string, string | number | boolean>` (DTS L12137). Ink's custom border object is therefore unavailable.
- **`quote` and `dashed` still use all four sides.** Their spaces are border cells. With no per-side props, `quote` costs a blank row above and below and a blank column on the right, in addition to the `▎` (**inferred** from the drawing code at BIN @218068966, which writes all four sides unless a `border<Side>` prop is `false`).

### 2.3 `borderColor` and `borderDimColor`

- Validation: `color`, `backgroundColor` and `borderColor` must match `/^[#a-zA-Z0-9_().,% -]{1,40}$/`, with the message "must be a color (a theme key, a name, or hex)" (BIN @206840717). `borderDimColor` must be a boolean (set `Gur`, BIN @206838297).
- Rendering: every mod `Box` is drawn by one themed Box component, whether plain (`d=o.type==="Box"?s:n`, BIN @228268139), keyed (`Ft` → `s`) or with hover (`_t` → `s`) (BIN @228249813). The props pass first through `Oe`, which maps the 18 ANSI color names (`red`, `gray`, `blueBright`, …) to fixed hex values (`U9n`/`ayn`, BIN @211931946; `Nt=["color","backgroundColor","borderColor"]`, BIN @228249813). The themed Box `kt` then resolves `borderColor`, each per-side border color and `backgroundColor` through `j()` (BIN @221836836). `j()` passes `#…`, `rgb(…)`, `ansi256(…)` and `ansi:…` through unchanged, maps a key of the active theme to the theme's value, and returns `undefined` for anything else, which draws no color.
- So a theme key (the `ThemeKey` list at DTS L12510, or any other key the theme holds, DTS L12503-12508) follows the person's theme. An unknown key is silently uncolored, not refused. ctui's own palette role names are not engine theme keys and must be resolved to hex first. ctui already does this for `input.background` (`ctui/hooks/sidebar.tsx`).
- `borderDimColor` dims the border string with `ge.dim` (`Kr(...)` and `if(I)le=ge.dim(le)`, BIN @218068966).

### 2.4 Border cells and `bodyColumns`

- `Pane.bodyColumns` is "Cells across the body, inside the frame, none under a mark of the engine's" (DTS L10251-10254). The engine passes it as `bodyColumns:Co`, the width the Pane tree is laid out in (BIN @232749273).
- A mod border is a Yoga border inside that tree. The content width is `getComputedWidth() - padding(left,right) - border(left,right)` (`J1`, BIN @218066500 region). A bordered Box therefore leaves `bodyColumns - 2` columns for its content and costs two rows. The border does not widen the pane (**inferred** from Yoga semantics and `J1`; **unverified** live).
- A border's top-edge title (Ink's `borderText`) exists in the renderer (BIN @218068966), but `borderText` is not on the allowlist, so a mod cannot use it.

## 3. `backgroundColor` on a nested `Box`

- `backgroundColor?: Color` is a `Box` prop (DTS L987) and is on the engine allowlist (BIN @206839749). Nothing restricts it to the root. The validator checks every element in the tree the same way, recursing into children (BIN @210092118).
- It renders through the same themed Box, so it takes the same values as `borderColor`: a theme key, hex, `rgb()`, `ansi256()`, `ansi:` or a named color mapped to hex (§2.3). The border string is drawn on the Box's background too (`ks(J,y)`, BIN @218068966).
- ctui already sets `backgroundColor` on the pane root (`ctui/hooks/sidebar.tsx`), and the skin sets `backgroundColor="userMessageBackground"` on a nested Box (`ctui/hooks/skin/user.tsx`).
- **Unverified**: whether a nested background fills the full row width or only the Box's laid-out area. Ink paints the Box's computed rectangle, which depends on `flexGrow` and `width`.

## 4. Box-drawing and block glyphs

- The engine measures every string with `ae(e) = Bun.stringWidth(e, { ambiguousIsNarrow: true })` (BIN @204621575).
- SPIKE: with `ambiguousIsNarrow: true`, `─ ━ ╌ ▔ ▁ ▌ ╭ ╮ ▎ ┃ …` each measure **1**. With it `false`, all but `╌` measure 2, because Unicode gives them East Asian Width "A" (ambiguous). `╌` is "N" (narrow).
- `truncate-end`: `pu` maps `truncate-end` to `p0(text, width, "end")`. `p0` keeps `Sr(text, 0, width-1)` and appends `zde = "…"` (`…`). `Sr` slices with `Bun.sliceAnsi` and shrinks the slice until `ae(slice)` fits (BIN @217931668, BIN @217930952). There is no glyph-specific path, so a rule of `─` cut by `truncate-end` ends in `…` like any other text. To draw an exact-width rule, make it `bodyColumns` (or the Box's inner width) characters long so it is never cut.
- **Caveat (unverified live)**: in a terminal set to draw ambiguous-width characters as wide (some CJK locales or terminal options), these glyphs take two cells while the engine counts one, so rows misalign. This is a property of the terminal, not of the engine.

## 5. `Text` title styles

- `TextProps` lists `color`, `backgroundColor`, `dimColor`, `bold`, `italic`, `underline`, `strikethrough`, `inverse` and `wrap` (DTS L12483-12501). The engine's `Text` allowlist is the same set (BIN @206839749). The engine checks the booleans (`Gur`, BIN @206838297) and the color forms (§2.3).
- The themed Text `n` takes the same props (BIN @221837367), and its colors resolve like the Box's. Styles are applied in order: inverse, strikethrough, underline, italic, bold, dim, then foreground and background color (`sGe`, BIN @209604518).
- A `hover` can override every one of these on a `Text` except `wrap` (DTS L12459-12477; hover allowlist `eoo.Text`, BIN @206838297).

## 6. Open for the live check

1. A nested `backgroundColor` fill: whether the band fills the full pane width (§3).
2. `quote` and `dashed` spacing in the dock: the blank rows and column they add (§2.2).
3. Ambiguous-width glyphs on the person's terminal (§4).
