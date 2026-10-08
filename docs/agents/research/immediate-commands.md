# Immediate mod commands for ctui's pickers (Claude Code 2.1.292)

Scope: issue #160, for map #158 (ctui 0.4.0). What a command registered with `$.command.register({ immediate: true })` allows for an instant Theme menu and a Sidebar plugin order picker. Every claim cites a primary source or a spike run. **Unverified** marks what neither settles.

**Source keys**

- **DTS Ln**: the API types the engine lays in a loaded mod, `ctui/.claude-plugin/types/claude-code/index.d.ts` (15,776 lines, Claude Code 2.1.292; gitignored). The bundled `plugin-authoring/types/claude-code.d.ts` is the same API.
- **SKR Ln**: the bundled `plugin-authoring/reference.md` of 2.1.292.
- **S**: the spike `prototypes/research-160/` (gitignored, throwaway): plugin `r160` with a markdown `commands/theme.md` and `commands/hideme.md`, plus a hooks module that registers probe names, opens a Theme `Select` pane and an order pane; `spike-b/` is a second plugin `r160b`. `run.sh <name> <cols> <rows> <fullscreen 1|0> [extra plugin dir]` starts `claude --plugin-dir … --model haiku` in tmux, `cap.sh` captures. Runs a, c, d, f, g fullscreen at 160×45 with the installed ctui 0.3.0 Sidebar beside it; run e on the main screen (`CLAUDE_CODE_NO_FLICKER=0`) at 120×40. Logs `log-<run>.txt`, captures `capture-<run>-<label>.{txt,ansi}`.

## 1. Answer

| Question | Answer |
|---|---|
| Allowed names | Letters, digits, `_`, `-`, up to 64 (DTS L1876-1881). `:` and `.` are refused, so `ctui:theme` can't be registered (S run a). `ctui-theme`, `ctui-order` and mixed case are accepted. |
| Clashes | A built-in name is refused (`"/theme" refused: it is the built-in /theme`). A user or project command of the same name wins: `"/r160-wait" refused: it is the user's /r160-wait` (run f). The first plugin to register a name keeps it: `"/r160-theme" refused: the plugin r160 registered it already` (run g). Nothing reserves a `ctui-` prefix: plugin `r160` registered `ctui-probe` (run a). A plain name never clashes with a `/ctui:*` markdown command, which keeps its own name. |
| Opens at once mid-reply | **Yes.** `/r160-theme` typed while Haiku streamed a story ran its `command.run` at once; `$.ui.open` returned `{ isPlaced: true }`, the Select took the arrows and Enter, the pick closed the pane, and the reply streamed on (run a, `imm-mid`, `imm-picked`). The same command registered without `immediate` was queued with `ctrl+x ctrl+s to send now` and ran at the turn's end (`wait-mid`). |
| Docking and closing | Same as today's `/ctui:theme` picker (MEMORY.md, #22). Fullscreen: a tab `Sidebar  theme` over the Sidebar dock, and the Sidebar returns when it closes (run a). Main screen: an inline bordered block above the prompt (run e, `theme2`). Esc closes it through `closeOnEscape` (`ui.close` origin `person`). The dock kept the Sidebar's width over a requested `columns: 42`: a width the person set wins (DTS L7391-7402). |
| `/` menu and description | **Yes.** Listed from the next keystroke (DTS L3049-3051) with its `description` and `argumentHint`; a `command.describe` hook can rewrite them (run a, `typeahead`). Unlike markdown commands it shows no `(plugin)` tag: `/r160-theme  Switch the ctui sidebar theme (described)` beside `/r160:theme  (r160) Markdown theme command`. |
| Reorder a list | **Yes, with Buttons, not a Select.** One `Button` per row: the arrows walk the focus ring, each move is a `ui.focus` event naming the row's key, and hotkey Buttons (`k` up, `j` down) move the focused row and `$.ui.focus` puts the ring back on it. Three fast `j` presses moved the row three places (run d). Enter-to-grab then arrows also works at a normal pace but loses or reverses moves in a burst. |

## 2. Names and clashes

- **Rule.** "The command's name without the slash (letters, digits, `_`, `-`; up to 64)" (DTS L1878-1879). The engine's error: `$.command.register takes { name, description, argumentHint?, immediate? }; name is letters, digits, _ or - (up to 64)`, logged for `r160:colon`, `r160:theme`, `dot.name` and a 65-character name (S run a).
- **No namespace.** The name is global. The person runs `/<name>` (DTS L1879); the plugin isn't prefixed. "Registering a name again replaces it; a built-in's name is refused" (DTS L3055). In S, "again" held only for the same plugin. Another plugin's later registration of the same name was refused (run g), and so was a name a project `.claude/commands/r160-wait.md` already held (run f). `command.list()` then reports the project command as `source: "user"`.
- **Consequence for ctui.** A name like `ctui-theme` is only ctui's by convention. If the person has a command or skill of that name, or a plugin loaded earlier took it, `$.command.register` throws and ctui has no instant command. **Unverified:** whether a user skill (`~/.claude/skills/<name>`) blocks it the same way as a project command. The S probe used a project command only.
- **Who answers.** A `command.run` hook on the name runs whichever plugin registered it. Two plugins hooking it both appear in the row prefix: `⎿ r160+r160b: theme: text answer` (run f). The prefix names "the plugins hooking the command" (DTS L1819-1822).
- **Markdown commands stay separate.** `/ctui:theme` and a registered `ctui-theme` coexist; each is its own name (run a: `r160:theme` markdown and `r160-theme` registered both listed).
- **Hiding the markdown fallback.** A `command.describe` hook sees every command, other plugins' and built-ins included (run a logged `ctui:theme` and `theme`). `next({ ...e, isHidden: true })` drops one from the typeahead and `/help`, and the command still runs when typed in full (DTS L1693-1697, L4211-4222). S hid `r160:hideme` that way: it is missing from `typeahead`. The name, `immediate` and provider are read-only (DTS L1699-1717).

## 3. Running mid-reply

- **Contract.** `immediate: true` makes "`/<name>` typed while a turn is in flight run at once instead of waiting for the turn to end". The hook "must not assume the turn's state", and its `{ text }` prints as an idle run's does (DTS L1890-1898). `command.describe` reports `immediate: true` for it (S run a).
- **Observed.** The run fired 3 s into a streaming reply with `origin {kind: "composer"}`, `presentation {isFullscreen: true, columns: 160}`. The pane opened within 10 ms, `ui.panes()` read `isFocused: false` at that instant, and the Select still took `Down Down Enter`: `select catppuccin`, `closed theme` (log-a 19:09:03-19:09:09). The turn kept streaming (`esc to interrupt` stayed).
- **Focus caveat.** `focus` is "a request, not a grant": the pane takes the keys only "while the prompt has the keys over an empty composer" (DTS L7350-7357). Submitting the command empties the composer, so it was granted in S. A dialog up (a permission prompt) would refuse it. The pane then opens without the keyboard until the person presses ctrl+x tab or clicks.

## 4. Docking and closing

Unchanged from the #22 picker: `$.ui.open({ id, focus: true, closeOnEscape: true, columns })` from a command the person typed is placed at any width (DTS L7326-7331).

- Fullscreen (runs a, c, d): the pane is a tab next to `Sidebar` in the dock, `✕` at the right. On close (pick, `s`, or Esc) the Sidebar tab is shown again (`imm-picked`).
- Main screen (run e): a rounded block above the prompt, as wide as the terminal, holding the Select (`capture-e-theme2.txt`).
- Width: the dock ignored `columns: 42` and kept the Sidebar's width. A person-set width wins (DTS L7391-7402). ctui already asks the Sidebar's width.

## 5. The `/` menu

- `$.command.register` lists the command "in the typeahead from the next keystroke on" (DTS L3049-3051). `description` is "the one line the typeahead and `/help` show", and `argumentHint` is drawn dim (DTS L1882-1889).
- S `typeahead` and `typeahead-theme`: typing `/theme` lists `/theme` (built-in), `/r160:theme (r160) …`, `/ctui:theme (ctui) …` and `/r160-theme …`. Registered commands carry no `(plugin)` tag, a project command carries `(project)`. So a description like "ctui: switch the Sidebar theme" has to name ctui itself.
- The registration lives for the session: ctui registers in `session.start` on every load (SKR "a slash command"). When the mod isn't loaded, the command doesn't exist, so the markdown `/ctui:theme` stays the fallback that tells the person to update.

## 6. Reordering a list in a pane

What a pane can catch:

- **`Select`** raises only `ui.select` on a pick (DTS L3981-3989, L10443-10446). Moving the highlight raises nothing. A Select can pick a row, not move one.
- **`Button` focus ring.** "Tab and the arrows walk its buttons" in a focused pane (SKR L129). Every ring move is a `ui.focus` event first, with `element` the key now holding it and `origin.kind` `person` or `plugin` (DTS L4025-4036, L13729-13780). `$.ui.focus({ requestId, key })` moves it (DTS L2516-2530).
- **`Button` hotkey.** One digit or one lowercase letter presses it while the pane holds the keys. Shift+w reads as `w`, and two Buttons with one hotkey clash, the later wins (DTS L1071-1078). So `K`/`J` can't be told from `k`/`j`, and ctrl/alt+arrows don't reach a Button.
- **`Client` `onKey`** gets every key (`up`, `down` with `ctrl`/`shift`/`meta`) but only "while a click has given it the focus", and Escape never arrives (DTS L1401-1417, L1581-1585). A Client is outside the pane's focus ring (MEMORY.md, "Sidebar colors…"), so it can't take the keys from `open({ focus })` or the ring.

What S did (`order` pane, runs c and d): rows `row-<id>` as plain Buttons, the first `autoFocus`, then `k: up  j: down  s: save` hotkey Buttons.

- **Hotkeys (works).** `ui.focus` records the last focused row. `j` raises `ui.press` on `down` without moving the ring (no `ui.focus` before the press). The hook swaps the row, calls `$.ui.invalidate('ui.render')`, and 50 ms later `$.ui.focus` on `row-<id>` returns `{}`, with the ring drawn inverse on the moved row (`capture-c-order-j`, `capture-d-fastj`). `k k k k` at 250 ms and `j j j` at once each moved the row one place per press (log-c 19:10:09, log-d 19:10:44).
- **Enter to grab, arrows to carry (fragile).** A row press toggles a grab. While grabbed, the `ui.focus` hook swaps the row with the one the ring heads to, answers `{}`, and refocuses after the redraw. At 400 ms per key, `Up Up Down Down Down` moved `limits` 3→2→1→2→3→4 as asked (log-d 19:10:30-19:10:32). Three Ups in one burst came out as a net single move, one of them backwards (log-d 19:10:37). `ui.focus` carries the target key but no direction, and the ring moves by drawn position while the redraw lags. Landing the ring with `next({ ...e, element: grabbedKey })` instead swallowed every second key (run c).
- Escape closes the pane (`closeOnEscape`), so "cancel" is free. Saving on `s` or a `save` Button then writes the order once.

## 7. What this means for #158

- The instant Theme menu fits: register `ctui-theme` (or another `-` name) with `immediate: true` in `session.start`, answer it with the same picker pane as today, and optionally hide `/ctui:theme` with `command.describe` `isHidden` while keeping it as the not-loaded fallback.
- Plugin order fits as a Button-list pane with letter hotkeys for up/down (and Enter/`s` to save). A Select can't do it, and arrow carrying needs debouncing.
- Surprise: names are global and first come wins. A person's own `/ctui-theme` command, or another plugin loaded earlier, makes `register` throw. ctui needs a fallback line for that (the markdown command still works).
- Surprise: MEMORY.md's reason against immediate commands ("can't contain `:`") holds, but the `/ctui:*` markdown commands can stay registered beside the new names. Whether `/ctui:plugins:enable|disable` move too stays open on the map.
