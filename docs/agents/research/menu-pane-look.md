# What can the `/ctui` menu pane draw in the Sidebar's look? (#198)

Claude Code 2.1.292. Research for map #197. Primary sources:

- **DTS**: `vendor/claude-code-types/claude-code/index.d.ts`, the vendored 2.1.292 types. `Lnnn` cites its lines.
- **R166**: the #166 spike's ANSI captures, `prototypes/research-166/capture-*.ansi` in the main checkout (untracked, throwaway). They show how 2.1.292 drew a docked and an inline menu pane.
- **MEMORY**: the repo's `MEMORY.md`, where it records earlier live checks.

Nothing here was spiked live for this ticket. The points that need a spike are listed at the end.

## 1. Colors: which elements take a color

| Element | Color props | Focus or highlight color |
|---|---|---|
| `Text` | `color`, `backgroundColor`, `dimColor`, `inverse`, and the styles (DTS L12483-12501). Colors are a theme key or a raw color. | None. A Text never takes the focus ring. |
| `Box` | `backgroundColor`, `borderColor` (DTS L984-987) | None |
| `Button` | Only `dimColor` (DTS L1101). `hover` takes the Text set, `color` included, but only while the pointer is over the keyed Box or the `scope` (DTS L1132-1140, L12459-12477). `variant="primary"` draws `[ label ]` in accent, but `plain` overrides it (DTS L1103-1112). | None. "The focus and the pointer still invert it" (DTS L1092-1094). |
| `Select` | None: `key`, `label`, `options` (`value`, `label`), `value`, `autoFocus`, `onSelect` (DTS L10402-10447) | None |
| `Input` | None: `key`, `label`, `placeholder`, `value`, `submitLabel`, `autoFocus`, `onInput`, `onSubmit` (DTS L5441-5483) | None |

The plain-data `Button` element carries the same props and no color (DTS L9302-9339). A `ui.resolve` hook can only hand back a table whose constructors build these props (DTS L3756, L3958-3962), so it can't add a color.

**As drawn (R166).** In the docked menu, a Select's option rows and an Input's text are written with no SGR color, so they show in the terminal's default foreground, not the theme's `text`. The focused option is SGR 7 (inverse) over that default: `\e[7m  Kanagawa\e[0m` (`capture-f-ka-down.ansi`, `capture-g-plugins.ansi`). The Select's collapsed label line (`none ▴`) is drawn in `inactive` (`38;2;148;154;165`). MEMORY ("Sidebar colors inherit the Claude Code theme") adds two #88 findings: a Text color doesn't reach a Button, and a Button inside a Text draws an empty pane.

**Answer.** No `Select`, `Button` or `Input` prop sets a row color, a highlight color or a focus color. The engine's elements always draw unthemed rows with an inverse focus.

### Drawing your own rows

The mod has no general key hook. The `ui.*` events are `render`, `resolve`, `press`, `input`, `select`, `message`, `fault`, `scroll` and `focus` (DTS L3953-4036). `ui.key` exists only in the test harness (DTS L51). Four ways to get keys:

1. **Engine ring plus Text labels (recommended to prototype).** Draw each row as a `Box` row holding a one-glyph `plain` Button keyed `row-<id>` (for example the `›` or a cursor glyph) and a `Text` label beside it, not wrapped in it. `ui.focus` fires before every ring move, on the person's arrows, Tab or click, and names the element taking the ring (DTS L4025-4036, L13729-13756). Keep that key in `$.state` and draw that row's Text in `suggestion` (accent), or `inverse` in accent; draw the others in `text` and `inactive`. Arrows, Tab and Enter stay the engine's, and Enter on the ring raises `ui.press`. The `/ctui` Plugins screen already tracks the ring this way (MEMORY "`/ctui` is one instant menu").
   - Cost: one `$.state` write and one redraw per ring move. Write after `next(e)` (MEMORY).
   - Cost: the glyph Button still draws its own engine inverse in the default foreground. That one cell is not themed.
   - Cost: a click on the Text label hits no Button. The row needs a keyed hover scope, or a `Client`, to take clicks.
2. **Hotkey Buttons.** `j`/`k` (a digit or a lowercase letter only, DTS L1071-1078) move a cursor kept in `$.state`. Rows are pure Text in role colors. Enter needs one focused Button that acts on the cursor row.
   - Cost: arrows don't move the cursor, and each hotkey Button draws `<key>: <label>` and sits in the ring (MEMORY).
   - Cost: the one focused Button shows the engine inverse wherever it sits.
3. **`ui.scroll` as the arrows.** When the tree is taller than `bodyRows`, a focused pane's arrow raises `ui.scroll` with `by` = ±1 (DTS L14148-14155). Answering `{}` without `next` keeps the window still (DTS L4013-4024), and `by` can move a Text cursor.
   - Cost: this works only while the engine has rows to scroll, so the tree must overflow by at least a row. Enter still needs a Button.
   - Cost: a level with nothing focusable sends typed keys to the prompt (MEMORY). Whether arrows still reach the pane then is unverified.
4. **A `Client`.** Its surface module gets every key (`surface.onKey`, arrows and `return` included; Escape never arrives, DTS L1401-1417, L1581-1585) and draws its own colored Text.
   - Not viable for a keyboard menu: the module gets keys only "while a click has given it the focus", and a `Client` never takes the pane's focus ring (MEMORY, #83's live check). `/ctui` opens from the keyboard.

## 2. Background

A root `Box` `backgroundColor` is a Box prop for every pane body (DTS L987). On the Sidebar pane it covers every body cell, padding included (#79), and holds through scroll, fold and a theme-file reload (#87; MEMORY "Sidebar colors inherit…"). The menu is the same `Pane` component, so a root Box paint fills its body the same way.

Two limits:

- The frame outside the body stays the person's dock color: the `│` rule, the tab and `✕` row, and the row below the body. Docked, R166 shows the tab row on `48;2;38;38;38`, Claude Code's grey `#262626`.
- After the focused row's inverse, R166 shows `\e[0m` and then the dock background again. Whether the engine restores a mod Box's `backgroundColor` there, rather than the dock's, and whether Select, Input and Button cells keep the Box paint at all, was not captured. **Needs a spike.**

## 3. Body size, docked and inline

`Pane` props on every render: `bodyColumns`, `placement` (`dock` or `inline`) and `scroll` (`offset`, `bodyRows`) (DTS L10236-10281, L11768-11783).

- **`bodyRows` is the room, not the tree.** It is "the most the frame may take less the engine's (an inline border's two, the tab row while one shows, a dock's row for the close mark)" (DTS L10264-10271).
- **Docked, fullscreen from 110 columns.** The dock runs floor to ceiling beside the transcript and stops above the prompt rows. With the Sidebar and the menu both open, R166 shows the tabs on the close mark's row (`Sidebar  ctui … ✕`), so that one row serves both. #87 measured the Sidebar's `bodyRows` at 34 in a 40-row terminal. The menu should get the same, but that wasn't measured. `bodyColumns` is the dock's width less the rule: the requested `columns` (42 or 53) unless the person dragged the dock (DTS L7391-7402). `rows` is ignored when docked.
- **Inline (main screen, or under 110 columns).** The frame is a rounded border with the `✕` on its top edge (R166 `capture-i-open.txt`). `bodyRows` is the `rows` the open asked for, a third of the screen when left out, up to what the layout spares, less the border's 2 rows (and a tab row, if any). A size the person set wins (DTS L7383-7390). "Inline the frame fits the tree": a short tree shrinks the frame (DTS L10269-10270). `bodyColumns` is the block's width inside the border.
- **To fill the body and pin a footer**, give the root Box `height={e.props.scroll.bodyRows}`, add a flexible spacer, and put the footer last. The Sidebar does this and it was verified live (MEMORY "The Sidebar adapts…"). Inline this makes the frame `bodyRows` tall instead of fitting the tree. Pass `rows` to `$.ui.open` to choose that height. Today `openMenu` passes none (`ctui/hooks/register.tsx` L610), so inline gets a third of the screen.
- **Whole cells.** Boxes are cut to whole cells, so spacers come in whole rows (MEMORY, checked on 2.1.292).

## 4. Title

`id` and `title` are separate fields of `$.ui.open` (DTS L7333-7348). The `id` is pinned and `title` is free text. `/ctui` is registered on its own by `$.command.register({ name: 'ctui', … })` (`ctui/hooks/register.tsx` L596). So `$.ui.open({ id: 'ctui', title: 'Settings', … })` keeps the `ctui` id, its `requestId` matchers and the `/ctui` command, and the tab reads `Settings`. Re-opening an open id with a new title retitles it (DTS L2454, L7336).

The title shows only while more than one pane is open: "with one, the engine draws no title" (DTS L7342, L10237-10243).

- Docked, the Sidebar pane is open too, so the tab row reads `Sidebar  Settings`, the shown tab in bold inverse (R166 shows `\e[1;7m ctui \e[0m`).
- Inline, ctui closes the Sidebar pane (`register.tsx` L1076-1079), so the menu is alone and no title is drawn. A `Settings` heading there has to be the mod's own Text, as the body's dim `ctui` / `ctui › Plugins` line already is (`ctui/hooks/menu.tsx` L126, L229).

## Engine limits for the prototype

- No engine element (`Select`, `Button`, `Input`) takes a row, highlight or focus color. Themed rows need Text drawn by the mod. Every focusable element still draws the engine's inverse in the default foreground on its own cells.
- The mod has no raw key hook. Keyboard rows ride the focus ring (`ui.focus`), hotkey Buttons (one letter or digit, drawn `<key>: <label>`), or `ui.scroll` deltas. A `Client` gets keys only after a click.
- The dock frame (rule, tab and `✕` row, bottom row) keeps the person's dock color. Only the body can be painted.
- The tab title shows only while two or more panes are open, so docked only.
- Inline, the frame grows to `bodyRows` only if the tree is that tall, and that height comes from the `rows` request or a third of the screen.

## Needs a live spike

1. Whether a root Box `backgroundColor` survives under Select, Input and Button cells, and after the inverse's `\e[0m` reset.
2. Approach 1's look: a glyph Button beside an accent Text, the inverse glyph cell, and redraw lag per arrow.
3. Whether arrows raise `ui.scroll` in a focused pane with one Button, or with none (approach 3).
4. The menu pane's `bodyRows` docked beside the open Sidebar, compared with the Sidebar's 34 at 40 rows, and inline with and without `rows`.
5. Whether Buttons inside a `display: "none"` Box leave the focus ring. The types don't say.
