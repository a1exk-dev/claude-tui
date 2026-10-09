# The `/ctui` menu in the `AbovePrompt` band (research for #194)

> Researched 2026-10-09 against the Claude Code 2.1.292 mod API. Part of the map #193.
> Sources:
> - `d.ts L<n>` = `vendor/claude-code-types/claude-code/index.d.ts` (2.1.292), line `<n>`.
> - `CC:<page> L<n>` = `https://code.claude.com/docs/en/plugins/mods/<page>.md`, fetched 2026-10-09. `L` is the line in that `.md` file.
> - `MEMORY` = the `MEMORY.md` entry "`/ctui` is one instant menu; it survives each settings reload", today's pane-based menu (`ctui/hooks/register.tsx` L596-L1390, `ctui/hooks/menu.tsx`).
> - Labels: **documented** means the d.ts or the docs say it. **inferred** means I read it from how documented pieces combine, or from what the docs leave out. Nothing here was run live.

## 0. Verdict

- **ctui can't give the band the keyboard.** No API focuses the band. Only the person does, with Ctrl+X Tab or a click. `/ctui` can draw the menu in the band at once, even mid-reply, but the keys stay in the prompt until the person focuses the band. This is the deciding finding: the pane menu's "open and type" flow doesn't carry over. See §1.
- **Without focus, only digit hotkeys reach the band**, and only from an empty prompt, after a pause, on Buttons wholly inside the band's visible window. A numbered menu (`1:` to `9:`, `0:`) works without focus. The Themes filter, arrows, `x`/`k`/`j` and Enter don't.
- **Esc raises no event ctui can hook in the band.** It returns the keys to the prompt and the band keeps its tree. `ui.close` exists only for panes. So "Esc steps back a level, then closes" can't be built the pane way. ctui has to close the menu itself, by a Button press or another trigger, and then draw nothing.
- **The band is shared and yields to surveys.** `hasSurvey` tells ctui to step aside. Another mod earlier in the chain can hide ctui's tree, and ctui's tree hides later mods' trees unless it nests `await next(e)`.
- **The 23-row Themes list doesn't fit in fullscreen.** There the band gets at most half the terminal, prompt included, less one row for `n more`. On the main screen it may take the terminal's height. In a band that overflows, Up and Down scroll the band instead of moving between controls, and digit hotkeys arm only on visible rows.
- **Elements behave as in a focused pane once the band holds the keys** (same ring, same `ui.press`/`ui.input`/`ui.select`/`ui.focus`/`ui.scroll` events, `component: 'AbovePrompt'`). The differences are how focus arrives and leaves, the missing close, and sizing.

## 1. Keys from an immediate `/ctui`

| # | Claim | Label | Source |
|---|---|---|---|
| 1.1 | The person focuses the band by a click or Ctrl+X Tab, and can collapse it with Ctrl+X Ctrl+A or `[-]`. No plugin call is listed. | documented | d.ts L10173-10175 |
| 1.2 | `$.ui.focus` moves the ring only in a site that already holds the keys. A site that doesn't hold them, or where another plugin's element holds the ring, gets `{ deny }`. "The keyboard is the person's to give." | documented | d.ts L2516-2521, L13691-13697, L13793-13795 |
| 1.3 | `$.ui.focus` takes the band's `requestId`, so it works in the band, but only after the person has focused it. | documented | d.ts L13699-13703 |
| 1.4 | `autoFocus` places the ring only "when the site takes the keyboard": a pane opened with `focus`, or the person's chord or click. It doesn't take the keyboard. For the band, that means only the person's chord or click. | documented (props), inferred (band has no `open`) | d.ts L1123-1131, L5465-5472, L10433-10441 |
| 1.5 | `$.ui.open({ focus })` opens panes only. Its `focus` is a request, refused while an element of the band or a pane holds the keys, text is in the composer, or a dialog or survey is up. | documented | d.ts L2450-2472, L7349-7357 |
| 1.6 | No `$.ui` method opens, shows or focuses the band. The band is always there and shared, and a hook draws into it or passes. | documented (docs list the band with no open call), inferred (no method exists: none in `$.ui`) | CC:interface L201-206; d.ts L10169-10178 |
| 1.7 | A mod never reads the keyboard. Outside a focused pane or band, keys go to the prompt, except a digit hotkey on the band. | documented | CC:interface L518 |
| 1.8 | A digit hotkey on a band Button fires when the person types that digit alone into an empty prompt and pauses. Letters don't. | documented | d.ts L1071-1076, L9323-9328; CC:reference L249 |
| 1.9 | A bare digit arms only Buttons wholly inside the band's visible window, never one scrolled out of view. | documented | d.ts L10196-10198 |
| 1.10 | A Button's `action` presses it from the prompt with the person's binding for an engine action, but only a chord or a modified key, while no dialog is up and no engine handler of that action is mounted. A pane's Button wins over the band's. | documented | d.ts L1079-1087, L9331-9338; CC:reference L249 |
| 1.11 | Mid-reply: the band is drawn while a turn runs (`isWorking`), and an immediate command runs mid-reply (MEMORY), so the menu can appear mid-reply. Writing `$.state` that the band's hook read redraws the band, with no `invalidate`. | documented | d.ts L10184-10187, L3943-3955; CC:interface L738 |
| 1.12 | Consequence: `/ctui` would set a `$.state` flag (menu open), and the band hook would draw the menu. The person must press Ctrl+X Tab (or click) before arrows, Enter, letters or the filter work. Digits work earlier, from an empty prompt. | inferred | 1.1-1.11 |

## 2. Esc and closing

| # | Claim | Label | Source |
|---|---|---|---|
| 2.1 | While a pane or the band holds the keys, Esc returns them to the prompt. `closeOnEscape` (pane only) also closes the pane. | documented | CC:interface L532-543 |
| 2.2 | `ui.close` and `PaneCloseInput` name a pane by the `id` `$.ui.open` gave it. Origins are `plugin`, `person` and `unload`. The band has no id from `open` and no close. | documented | d.ts L6970-6975, L7296-7321, L2473-2486 |
| 2.3 | A Select's and an Input's own docs say Esc always returns to the prompt. | documented | d.ts L5437-5439, L10411-10413 |
| 2.4 | `ui.focus` fires on Tab, arrows, a click, an `autoFocus` take and `$.ui.focus`. Esc isn't listed, so ctui gets no event when Esc hands the keys back. | documented (list), inferred (Esc raises nothing) | d.ts L4025-4036, L13764-13780 |
| 2.5 | A `Client` never receives Escape either: "Escape never arrives: it returns the focus." | documented | d.ts L1401-1403, L1581-1583 |
| 2.6 | A Button `action` can't catch a plain Esc: only chords and modified keys press through `action`. | documented (rule), inferred (Esc not covered) | CC:reference L249 |
| 2.7 | So ctui can't make Esc step back a level, then close. After Esc the menu stays drawn, unfocused, until ctui stops drawing it. Back and close need Buttons (a `role: 'dismiss'` Button, hotkeys such as `b: back`, `q: close`) or another trigger (a pick, `prompt.submit`, a timer). | inferred | 2.1-2.6 |
| 2.8 | `role: 'dismiss'` is a drawing hint only. The terminal draws it as a normal Button; `onPress` still has to close the menu. | documented | d.ts L1113-1122, L9364-9372 |

## 3. Settings reloads (`$.config.set`)

| # | Claim | Label | Source |
|---|---|---|---|
| 3.1 | Each `$.config.set` reloads the mod. Module variables and timers reset; `$.state` survives and drives the redraw. | documented | CC:interface L726-738; CC:api L140; MEMORY |
| 3.2 | After a reload `session.start` runs again. The band hook is re-registered and draws again from `$.state`. | documented | CC:reference L116 |
| 3.3 | The pane menu keeps its pane, placement and focus across a reload because the engine owns the pane (`$.ui.panes()` is "the engine's record, not the module's"). The band also belongs to the engine, but the docs don't say whether the band's ring survives the instant the old module's elements go away. | documented (pane), inferred (band) | d.ts L2487-2499; MEMORY |
| 3.4 | "A ring the person has moved stays where it was put." `autoFocus` and `$.ui.focus` (after `$.clock.after`) restore the ring only while the band still holds the keys. If the reload drops band focus, ctui can't take it back: no "re-open with focus" exists for the band, unlike the pane's Esc fix in MEMORY. | documented (rules), inferred (band outcome) | d.ts L1127-1131, L13793-13795; MEMORY |
| 3.5 | MEMORY saw a pane level with nothing focusable send typed keys to the prompt. Any redraw gap during a reload could do the same in the band. | inferred | MEMORY |

## 4. Surveys and other mods

| # | Claim | Label | Source |
|---|---|---|---|
| 4.1 | `hasSurvey` is true while a survey holds the band, and a hook should yield (return `next(e)`). | documented | d.ts L10180-10183 |
| 4.2 | Surveys use plain digit Buttons (`1: Yes`), and an empty prompt's bare digit answers them. When two Buttons share a hotkey, the later one wins. A ctui digit menu drawn next to a survey would clash with it. | documented | d.ts L1074-1076, L1088-1090, L9326-9328 |
| 4.3 | `$.ui.open({ focus })` is refused while a survey is up. | documented | d.ts L7353-7355 |
| 4.4 | The band is one instance shared by every mod. A hook's tree replaces what later mods draw. To keep theirs, nest `await next(e)` in a Box. | documented | d.ts L10173; CC:interface L202-204 |
| 4.5 | Chain order: org/prepend mods, then installed mods (a mod before its `dependencies`), then `appendPlugins`, then built-in mods. The first mod is outermost and decides whether later ones draw at all. | documented | CC:events L287-298 |
| 4.6 | So an earlier installed mod that draws its own band tree without `next(e)` hides ctui's menu, and ctui's menu hides later mods unless it nests `next(e)`. | inferred | 4.4-4.5 |
| 4.7 | With another mod's element holding the band's ring, ctui's `$.ui.focus` is denied. The ring is shared across mods' elements in one site. | documented | d.ts L13695-13696, L13793-13795 |
| 4.8 | A `ui.press`/`ui.input`/`ui.select` hook of an earlier mod runs before ctui's callback and may rewrite or answer it. That's the same as in a pane. | documented | CC:interface L512; d.ts L3964-3989 |

## 5. Size: `maxRows`, scrolling, `n more`

| # | Claim | Label | Source |
|---|---|---|---|
| 5.1 | `maxRows`: in fullscreen, what the bottom slot has left above the prompt, and that slot is capped at half the terminal's rows, prompt included. Otherwise (main screen) it's the terminal's height. | documented | d.ts L10188-10199 |
| 5.2 | A tree of at most `maxRows` shows whole. A taller one scrolls in a window of `scroll.bodyRows` = `maxRows` − 1 (the `n more` row). | documented | d.ts L10193-10195, L10209-10215 |
| 5.3 | The window is engine-owned, moved by the wheel and, while the band is focused, by the person's keys (arrows, Page Up/Down, Home/End). `$.ui.scroll({ to: { key }, in: <band id> })` and `ui.scroll` hooks work in the band. | documented | d.ts L10209-10215, L2500-2514, L4013-4024, L14076-14102; CC:interface L537-540 |
| 5.4 | While a drawing overflows, Up and Down scroll the site instead of moving between controls. Tab still walks the ring. | documented | CC:interface L536-537 |
| 5.5 | `bodyColumns` is the column's width less 5 (the `[-]`). Beside a docked Pane, which is ctui's Sidebar in fullscreen, the column is the transcript's, not the terminal's. | documented | d.ts L10200-10208 |
| 5.6 | Unlike a pane (`rows` request inline), the band takes no size request. ctui can only read `maxRows` and fit its tree. | documented (pane `rows`), inferred (band has no request) | d.ts L7382-7389 |
| 5.7 | Themes today is a filter Input, then a Select of `inherit` plus 22 Themes (23 options), then a hint. That's about 25 rows if the Select draws every option. In fullscreen on a 40-row terminal, `maxRows` ≤ 20 less the prompt, so the list scrolls. On the main screen it would usually fit. | inferred (Select height per option not documented) | MEMORY; `ctui/themes/` (22 files); 5.1-5.2 |
| 5.8 | Whether the window follows the highlighted option inside a focused Select isn't documented. The engine keeps "a held element" in view (SiteScroll), but a Select is one element. | inferred | d.ts L11773-11775 |
| 5.9 | Plugins (5 rows + a 1-row hint) and a plugin's screen (≤ 4 rows + hint) fit in almost any `maxRows`, so Up/Down still move the ring there. The `n more` row and digit-arming limits only matter for Themes. | inferred | MEMORY; 5.1-5.4 |
| 5.10 | Band redraws are throttled to 30/s in the terminal (expanded band). A collapsed band (Ctrl+X Ctrl+A) is a person's choice that ctui can't read or undo: there's no prop for it. | documented (rate, collapse), inferred (no prop) | d.ts L2340-2343, L10173-10175; CC:reference L290 |

## 6. Elements and hotkeys: band vs pane

| # | Claim | Label | Source |
|---|---|---|---|
| 6.1 | The band keeps a focus ring and a scroll window like a pane body: `UiFocusComponent` and `UiScrollComponent` are both `'Pane' \| 'AbovePrompt'`. | documented | d.ts L13715-13719, L14115-14119 |
| 6.2 | Button, Input and Select share one ring (`abovePrompt:focus`). Enter presses, submits or picks. An Input takes every printable key while focused. | documented | d.ts L5437-5439, L10411-10413; CC:interface L532-539 |
| 6.3 | Letter and digit hotkeys work while "the plugin's site holds the focus": the band after Ctrl+X Tab or a click, or a focused Pane. Hotkeys are lowercased, and the later of two Buttons with the same hotkey wins. | documented | d.ts L1071-1078, L9322-9330 |
| 6.4 | The band adds one capability a pane lacks: a bare digit from an empty prompt. | documented | d.ts L1074-1076; CC:reference L249 |
| 6.5 | Pane-only keys: Ctrl+X then an arrow (resize), Ctrl+X X (close), Esc + `closeOnEscape` (close). | documented | CC:interface L541-543 |
| 6.6 | `ui.press`, `ui.input`, `ui.select`, `ui.focus` and `ui.scroll` carry `component: 'AbovePrompt'` and the band's `requestId`, so ctui's hooks re-key from `{ component: 'Pane', requestId: MENU_PANE }` to `{ component: 'AbovePrompt' }`. MEMORY's rule "`await next(e)` before writing menu state" applies unchanged. | documented (fields), inferred (rule carries over) | d.ts L3964-3989, L13729-13738, L14129-14138 |
| 6.7 | The band's `requestId` is "the band's one id"; its literal value isn't documented. | documented (exists), unknown (value) | d.ts L13734-13737, L14135-14137 |
| 6.8 | `AbovePrompt` is raised on terminal and desktop only. `Pane` is raised on every surface. | documented | d.ts L10177, L10234 |

## 7. What only a live spike can settle

1. After `/ctui` draws the menu, does anything other than Ctrl+X Tab or a click focus the band? For example: an `autoFocus` element on first draw, `$.ui.focus` while the prompt is empty, or `$.ui.focus` right after the person's command. Expected: denied (1.2).
2. Does a click focus the band on the main screen (non-fullscreen), where mouse tracking may be off?
3. The band's `requestId` string (log `e.requestId` in `ui.render`).
4. Does Esc in a focused band raise any hookable event (`ui.focus` with no `element`, a `ui.render` with changed props)? Does the menu stay drawn after it?
5. Across one `$.config.set` reload, with the band focused: does the band keep the keys and the ring on the same key? Does `autoFocus` or a delayed `$.ui.focus` put it back? Check this for a Themes pick, `x` on a Plugins row, and the 1 s order write.
6. Digit hotkeys from an empty prompt: how long is "pauses"? Does it work mid-reply? Does a digit meant for ctui go to the prompt when a survey also draws?
7. Does a focused Select of 23 options in an overflowing fullscreen band keep the highlighted option in view? What does `n more` say? Do digit hotkeys and the Input filter still work while it scrolls?
8. `maxRows` and `bodyColumns` at 42 and 53 rows, fullscreen with the Sidebar docked, and on the main screen.
9. What happens when ctui keeps drawing while `hasSurvey` is true: does the engine hide ctui's tree, or draw both?
10. Does Ctrl+X Tab go to the band or to the docked Sidebar pane first, and how does it cycle between them?
11. A Button `action` bound to a chord (for example Ctrl+X X is pane-only; try an unused action) as a close or back key while the band isn't focused.
