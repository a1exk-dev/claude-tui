# Live checks

Checks that mocks can't reach, run by hand in a signed-in terminal on the pinned Claude Code (`@anthropic-ai/claude-code` in the root `package.json`). Each section lists setup, action and expected result for what it covers. `CONTRIBUTING.md` says which sections a pull request runs.

Run them with `node_modules/.bin/claude --plugin-dir ./ctui` in a fullscreen terminal 110 or more columns wide.

To read a terminal's width, run `tty` in it, then `watch -n0.5 stty size -F <that tty>` from another shell (rows, then columns). Or run the session in tmux at a fixed size (`tmux new-session -x 130 -y 40`) and read it with `tmux capture-pane -p`; tmux doesn't deliver ctrl+x x.

## Sidebar docking

Fullscreen means the `"tui": "fullscreen"` setting or `CLAUDE_CODE_NO_FLICKER=1`. The main screen means `--settings '{"tui":"default"}'`, since fullscreen can be on by default.

| Setup | Action | Expected |
|---|---|---|
| Fullscreen, 144+ columns | Start a session | The Sidebar docks beside the transcript with no prompt sent, 42 columns wide (53 from 160). No `[ ✕ ]` press or key closes it. |
| Fullscreen, 110 to 143 columns, before any prompt has docked the Sidebar on this machine | Start a session, then send a prompt | Nothing docks at start. The prompt docks the Sidebar. A later session at this width docks it at start. |
| Sidebar docked at 150 columns | Widen past 160, then narrow back | The dock moves to 53 columns, then back to 42. |
| Sidebar docked | Narrow the terminal below 110 columns | The Sidebar disappears: no inline block above the prompt. |
| The previous row | Widen back to 110+ columns | The Sidebar docks again. |
| Sidebar docked | Click `✕`; press ctrl+x x; focus the Sidebar and press Esc | The Sidebar stays open each time. |
| Main screen (no fullscreen), 200 columns | Start a session and send a prompt | No Sidebar, no block above the prompt. |

## Sidebar layout and scroll

| Setup | Action | Expected |
|---|---|---|
| Fullscreen, Sidebar docked, in a repo under the home directory with an upstream, one staged, one modified and one untracked file, one stash | Look at the header | Row 1: the path in bold, with `~` for home. Row 2: `⎇ <branch>`. Row 3: `↑<ahead> ↓<behind>`, `+1` in `success`, `!1` in `warning`, `?1` in `inactive`, `≡1` in `suggestion`. Row 4: `+<added>` in `success`, `-<removed>` in `error`, then `lines changed` dim. Colors are theme keys of the current `/theme`. |
| The previous row | Ask Claude to edit a file; separately, change a file from another terminal | The counts and lines change right after the Edit returns, and within 5 s for the outside change. |
| Detached HEAD (`git checkout --detach`) | Wait 5 s | Row 2 reads `⎇ <7-char sha>`. |
| A directory outside any repo | Start a session there | The header is the path alone. |
| Sidebar docked | Look at the body and its frame | Padding: 1 row above and below, 2 columns left and right. Claude Code draws the `│` rule, the `✕` and the row under the body. The footer reads `ctui <plugin.json version>` and `claude-cli 2.1.288`, names dim, on the body's last row, with no update icon. Each section header reads `▾` dim, then its title in bold, with a blank row after each expanded section. |
| Sidebar docked | Click a section's `▾` | It turns `▸` and the section's rows fold. The header and footer have no fold mark. |
| `/config`: set MCP folded on | Start a new session, then run `/clear` | MCP starts folded. Fold another section, run `/clear`: the folds return to the settings. |
| More section rows than fit: an expanded long list, or a shorter terminal. Before the sections have rows of their own, give one stub section's `view` 12 placeholder rows and revert it after. | Check the cap: 4 rows then `▸ 8 more`; click it for every row and `▾ show less`. Then scroll the wheel over the Sidebar, down then up | `↓ more` marks the window's last row. Scrolling moves the sections only; the header and footer stay. `↑ more` shows once scrolled; at the end only `↑ more` shows. |

## Toasts

## Render-site rewrites

## Commands and pickers

## `claude -p`
