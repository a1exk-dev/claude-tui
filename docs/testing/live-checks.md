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
| Sidebar docked, a new session on a subscription, the built-in `dark` theme (`/theme`), no prompt sent | Look at Context and Limits | Context: an empty bar in `inactive`, `0%` in `success`, then `0 / <window> tokens` dim (`1M` on Opus 5.5) with `$0.00` dim at the right. Limits: `5h`, then `week`, each a label, a bar and its percent, the filled cells and percent in the level color (below 60 `success`, below 85 `warning`, else `error`) and the rest `inactive`; under each bar, dim, `resets in 3h 27m` (`resets in 6d 7h, Mon 09:00` past a day). |
| The previous row | Send a prompt and wait for the reply | Context fills: `<tokens> / <window> tokens` with thousands commas, the cost grows, the bar has filled cells. Limits percents follow the reply. |
| The previous row | Wait a minute | Each `resets in` counts down by a minute. |
| The previous row | Fold Context and Limits | Their headers read `4% · $0.11` and `5h 44% · wk 20%`, dim, at the right. |
| The previous row, both expanded | Run `/clear` | Within a second Context reads `0%`, `0 / <window> tokens`, `$0.00`; Limits keeps its windows. |
| Off a subscription: start with `--settings '{"apiKeyHelper":"echo sk-ant-api03-dummy"}'` (no key prompt, nothing saved) | Look at Limits | It reads `no limits reported`, dim. |
| Sidebar docked, `CLAUDE_CONFIG_DIR` set to a scratch folder (so `/mcp` writes stay out of `~/.claude.json`), a repo whose approved `.mcp.json` holds three working stdio servers, `MCP_TIMEOUT=10000` | Look at MCP | One row per server, plus one per claude.ai connector on the account: `●` in `success`, the name, then `N tools` dim at the right (`1 tool` for one). The header reads `n/n` dim (`3/3` with no connector). |
| The previous row | Run `/mcp disable <server>` | Within a second its row reads `○` and `off` in `inactive`, moved below the others, and the header counts one `●` fewer (`2/3` with no connector). |
| The previous row | Run `/mcp enable <server>` | Within a second or two the row reads `● N tools` again, back in its first place. A server slower than the 1 s tick reads `◐` and `connecting` in `warning` first. |
| The previous row | Kill one server's process (find its PID with `pgrep -af '<server script>'`, then `kill <pid>`) | Within a second its row reads `◐` and `connecting` in `warning`, then `✕` and `down` in `error` about 10 s after the kill. |
| The previous row, with a claude.ai connector or a plugin's server listed | Send a prompt, then look at its row | The label is its `/mcp` name without `claude.ai ` or `plugin:<plugin>:` (`Claude Docs`). Before the first prompt it reads the tool-name form (`Claude_Docs`). |
| The previous row | Fold MCP | The header's right side reads each state's glyph and count in its color, `●` first: `● 2 ✕ 1 ○ 1`. |
| The previous row | List the processes under `claude` (`pstree -a <pid>`) for 10 s | Only the MCP servers and short `git` runs: no `claude -p` and no `claude mcp list`. |
| Sidebar docked, Task tools on (the default), the default model (Opus 5.5), a new session | Look at Todo, then ask Claude to plan three steps with its task tools and work through them | Before the plan, Todo reads `0/0` dim with no rows. Rows appear as Claude creates the tasks, in its order: `○` in `inactive` for pending; `◐` in `warning` with the task's spinner text (`Running the tests`) for the one in progress; `✓` in `inactive` with dim text once done. The header counts done over total (`1/3`). A task created after every task is done starts a fresh list, as Claude Code's own list (ctrl+t) does. |
| The previous row | Fold Todo | The header's right side reads `1/3 · <in progress item>` dim, or `3/3` once nothing is in progress. |
| The previous row | Exit, then `claude --resume` the session; separately, change a ctui setting in `/config` (a reload) | The same rows return at once, the in-progress row showing its subject after `--resume` and its spinner text after the reload. |
| The previous row | Run `/clear` | Within a second Todo reads `0/0` with no rows. |
| `/config`: ctui Task tools off, then restart the session | Look at Todo | It reads `no task tools on this model` and `turn on ctui Task tools in /config`, dim, and no count. `/model` to Haiku 4.5: within a second the count `0/0` shows. |
| Task tools on, start with `--tools Bash,Read` | Look at Todo | It reads `no task tools in this session`, dim. |
| Task tools on, start with `CLAUDE_CODE_ENABLE_TODO_TOOLS=0` set in the shell | Ask Claude to run `echo $CLAUDE_CODE_ENABLE_TODO_TOOLS`; then set Task tools off in `/config` and ask again | It prints `0` both times: ctui keeps the person's value. |
| Task tools on, the variable unset | Ask Claude to run `echo $CLAUDE_CODE_ENABLE_TODO_TOOLS`; set Task tools off in `/config` and ask again | It prints `1`, then nothing. |
| More section rows than fit: an expanded long list, or a shorter terminal. Before the sections have rows of their own, give one stub section's `view` 12 placeholder rows and revert it after. | Check the cap: 4 rows then `▸ 8 more`; click it for every row and `▾ show less`. Then scroll the wheel over the Sidebar, down then up | `↓ more` marks the window's last row. Scrolling moves the sections only; the header and footer stay. `↑ more` shows once scrolled; at the end only `↑ more` shows. |

## Toasts

## Render-site rewrites

## Commands and pickers

## `claude -p`
