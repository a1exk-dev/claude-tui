# Can the Sidebar paint its own background? (Claude Code 2.1.291)

Scope: issue #79, a task child of map #72 ("Sidebar contrast from Omarchy palettes"). It collects facts only. Whether to reverse `MEMORY.md` "Sidebar colors inherit the Claude Code theme" ("The Sidebar paints no background") is decided in "How the mapping ships" (#78).

**Method.** The `r79` spike mod in `prototypes/research-79/` (gitignored, local only) docks a pane laid out like the Sidebar: a root Box of `height` `scroll.bodyRows` with padding top/bottom 1 and left/right 2, a header, a mod-scrolled list, a fold toggle and a one-row footer. Commands typed in the session (`/pmode`, `/pbg`, `/pscroll`, `/pfold`) switch cases. Claude Code 2.1.291 ran fullscreen in tmux (150×40, `CLAUDE_CODE_NO_FLICKER=1`, truecolor, the installed ctui disabled through `--settings`). Each case was captured with `tmux capture-pane -N -e` and parsed cell by cell for its background. Screenshot of every case: [`sidebar-paint.png`](sidebar-paint.png).

## Answers

| Question | Answer |
|---|---|
| Does `backgroundColor` on the root Box cover the padding? | **Yes.** Every body cell, `bodyColumns` × `bodyRows` (42×34 at 150 columns, 53×34 at 170), takes the color, padding rows and columns included. A hex value and a theme key (`userMessageBackground`) both work. |
| How does it meet the engine chrome? | **No gap inside the body, but a dock-colored frame outside it.** Three strips stay `composerSidebarBackground` (#262626 on base `dark`), and the mod can't paint them: the `│` rule column on the left, the row above the body that holds the `✕`, and the row below the body. A painted body is therefore framed by the dock color on its top, left and bottom, unless the paint equals the dock color. |
| Can each row take its own background? | **Yes.** A lighter top highlight row and a per-row vertical gradient both drew as asked. Rows inside the padding sit in the root's paint. Rows given the full `bodyColumns` width with their own `paddingX` paint edge to edge. |
| Does the paint hold? | **Yes**, through mod-owned scroll, fold, a resize from 150 to 170 columns (reopened at 53) and back to 42, and a live theme change. On a theme-file rewrite (hot reload), a theme-key paint and the dock strips recolored at once. A hex paint stayed as it was. |

## Other facts seen

- **The `✕` row moved.** On 2.1.291 the `✕` sits on its own engine row above the body, and the body starts one row lower. On 2.1.288 (`prototypes/research-8/capture-cover.txt`) the body's first row was the top row, with the `✕` over its last cell. `MEMORY.md` "The Sidebar adapts to the dock's engine chrome" describes 2.1.288, the pinned version. Recheck it on the bump to 2.1.291.
- `$.config.set({ key: 'theme', value: 'light' })` returned `{ value: 'light' }` and wrote the setting, but the running session kept its colors for at least 5 s. This matches #77: a theme change through settings reaches only new sessions. Only a hot-reloaded theme file, or the person's own `/theme` pick, recolors a running session.

## Consequence for "How the mapping ships"

- A painted body can take the #80 glass color with no help from the theme, but the dock frame (rule column, `✕` row, bottom row) keeps the person's `composerSidebarBackground`. It disappears only if that key equals the paint, which means the `/theme` pick or Omarchy's template sets it.
- A theme-key paint follows the person's theme live, as the theme keys do today. A computed hex (from Omarchy's palette) has to be recomputed and redrawn when the theme changes. #77's `watchPaths` / `classic.FileChanged` covers that.
