# Spike: the /ctui menu in the AbovePrompt band (#195)

PROTOTYPE, throw away. Claude Code 2.1.292, `--model haiku`. Checklist: §8 of `docs/agents/research/ctui-menu-band.md`.

- `spike/`: a copy of ctui 0.4.0 with one addition. `/ctuiband` draws today's menu (`menuView`, same hooks) in the `AbovePrompt` band, and `/ctui` still opens today's pane. The band adds a status row above the menu:
  - who holds the keys, polled every 400 ms with `$.ui.focus` on the ring's element (denied with `that site does not hold the keyboard` when the band doesn't hold them)
  - the last band event the engine raised
  - what `$.ui.focus` answered when `/ctuiband` tried to take the keys
  - two digit Buttons below it: `9: back` (the band's Esc substitute) and `0: close`
- `try.sh [1|0]`: runs the spike in your terminal, fullscreen by default, with the installed ctui turned off for that session.
- `run.sh <name> <cols> <rows> <fs>` / `cap.sh <name> <label>`: the tmux harness. Runs: a = 160×45 fullscreen, b = 160×40 fullscreen, c = 120×40 main screen. Logs are `log-<run>.txt`, captures `capture-<run>-<label>.txt`.
- Settings writes go to `pluginConfigs["ctui@inline"]`. `~/.claude/settings.json` was restored after the runs.

## §8 checks

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Keys before Ctrl+X Tab | **None reach the menu.** `$.ui.focus` from `/ctuiband` answers `deny: that site does not hold the keyboard`. Down and Enter go to the prompt. Ctrl+X Tab takes the keys (`ui.focus menu-top (person)`) and opens the top Select. It works mid-reply too. | capture-a-open, -nofocus-keys, -ctrlx-tab, -midreply-held |
| 2 | Esc in the band | **No event.** The keys go back to the prompt and the menu stays drawn at its level, inert. Only the poll notices, within 400 ms. Mid-reply, the first Esc leaves the band and the second interrupts the reply (`Interrupted · What should Claude do instead?`). | log-a 10:12:55, 10:13:38; capture-a-midreply-esc1, -esc2 |
| 3 | Reload while held | **The hold survives** `$.config.set` reloads (`x`, `j`, a Theme pick) and a file hot-reload. The ring keeps its **index**: after `j` moved Limits, `x` toggled Limits. After a **level change** the ring lands on whatever now sits at the old index. After `9: back` it was `9: back` itself, so the next Enter closed the menu. Fixed in the spike with `$.ui.focus` after each level change, which works while held. | log-a 10:13:10–23; log-b 10:14:07 |
| 4 | Non-hotkey letter on a Button row | **Goes to the prompt and drops the hold.** `q` on a Plugins row: `❯ q`, the poll reads not held. With the prompt non-empty, the digit hotkeys are off too. | capture-a-letter-q |
| 5 | Themes, 160×40 fullscreen | `maxRows 15`. Closed: the menu is 6 rows (11 with the spike's rows). Opening the Select adds 9 rows past `maxRows`, and the transcript shrinks to make room. The filter works (`ka` → Kanagawa, Osaka Jade), and so does the pick and its reload. | capture-b-themes-closed, -themes-open, -filter-ka, -picked |
| 6 | A survey while held | **Not checked**: no way to raise one on demand. | — |

## Found along the way

- **Digits work with no focus.** `9` typed into an empty prompt pressed `9: back` with the band unheld (`ui.press band-back`). A digit-only menu would need no focus, but Plugins rows, `x`/`k`/`j`, the filter and Monthly cost aren't digits.
- **Prompt text lands in the menu.** While the band held the keys, typing `/ctui` + Enter went into the Themes Select: type-ahead moved it, Enter picked Osaka Jade, and that saved the setting. Nothing marks the prompt as unfocused except the band's own highlight.
- **The main screen already gets an above-prompt menu.** With `CLAUDE_CODE_NO_FLICKER=0` (and in fullscreen below 110 columns), `/ctui` seats the pane **inline, directly above the prompt**, framed. It takes the keys at once and Esc steps back. Only the docked fullscreen layout puts it in a tab beside the transcript (capture-c-pane-top vs capture-b-pane-top-full).

## Band vs pane

| | Pane (today) | Band |
|---|---|---|
| Where | Docked fullscreen ≥110 cols: a `ctui` tab over the Sidebar. Otherwise inline above the prompt, framed. | Always directly above the prompt, unframed, at the transcript's width. |
| Keys on `/ctui` | Taken at once (`focus: true`). | Never. The person presses Ctrl+X Tab or clicks first. |
| Esc | Back a level (a deny plus re-open). Closes at the top. | Silent: keys back to the prompt, menu left drawn. A second Esc interrupts a running reply. |
| Back / close | Esc | Only Buttons, such as the digit `9`/`0`, or `/ctuiband` again |
| Stray typing | The pane holds every key until Esc. | A non-hotkey letter on a Button row goes to the prompt and drops the hold. Typing into a Select changes the pick. |
| Reload | Survives (#166) | Survives. The ring needs `$.ui.focus` after each level change. |
