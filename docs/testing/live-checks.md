# Live checks

Checks that mocks can't reach, run by hand in a signed-in terminal on the pinned Claude Code (`@anthropic-ai/claude-code` in the root `package.json`). Each section lists setup, action and expected result for what it covers. `CONTRIBUTING.md` says which sections a pull request runs.

Run them with `node_modules/.bin/claude --plugin-dir ./ctui` in a fullscreen terminal 110 or more columns wide.

A dock width you dragged or keyed (`dockColumns` in `~/.claude.json`) overrides the 42/53 columns the Sidebar asks for. To check the widths, run with `CLAUDE_CONFIG_DIR` set to a scratch folder holding a copy of `~/.claude/.credentials.json`, and delete the folder after.

To read a terminal's width, run `tty` in it, then `watch -n0.5 stty size -F <that tty>` from another shell (rows, then columns). Or run the session in tmux at a fixed size (`tmux new-session -x 130 -y 40`) and read it with `tmux capture-pane -p`; tmux doesn't deliver ctrl+x x.

A ctui row in `/config` is the `pluginConfigs` entry in `settings.json`. Editing the file while a session runs reloads ctui as `/config` does.

## Sidebar docking

Fullscreen means the `"tui": "fullscreen"` setting or `CLAUDE_CODE_NO_FLICKER=1`. The main screen means `--settings '{"tui":"default"}'`, since fullscreen can be on by default.

| Setup | Action | Expected |
|---|---|---|
| Fullscreen, 144+ columns | Start a session | The Sidebar docks beside the transcript with no prompt sent, 42 columns wide (53 from 160). No `[ ✕ ]` press or key closes it. |
| Fullscreen, 110 to 143 columns, before any prompt has docked the Sidebar on this machine (to reset, remove the `sidebar` entry from `pluginPanes.asked` in `.claude.json` while no session runs) | Start a session, then send a prompt | Nothing docks at start. The prompt docks the Sidebar. A later session at this width docks it at start. |
| Sidebar docked at 150 columns | Widen past 160, then narrow back | The dock moves to 53 columns, then back to 42. |
| Sidebar docked | Narrow the terminal below 110 columns | The Sidebar disappears: no inline block above the prompt. |
| The previous row | Widen back to 110+ columns | The Sidebar docks again. |
| Sidebar docked | Click `✕`; press ctrl+x x; focus the Sidebar and press Esc | The Sidebar stays open each time. |
| Main screen (no fullscreen), 200 columns | Start a session and send a prompt | No Sidebar, no block above the prompt. |

## Sidebar layout and scroll

| Setup | Action | Expected |
|---|---|---|
| Fullscreen, Sidebar docked, in a repo under the home directory with an upstream, one staged, one modified and one untracked file, one stash | Look at the header | Row 1: the path in bold `text`, with `~` for home. Row 2: `⎇` in `inactive`, then the branch in `text`. Row 3: `↑<ahead> ↓<behind>` in `text`, `+1` in `success`, `!1` in `warning`, `?1` in `inactive`, `≡1` in `suggestion`. Row 4: `+<added>` in `success`, `-<removed>` in `error`, then `lines changed` in `inactive`. Colors are theme keys of the current `/theme`. |
| The previous row | Ask Claude to edit a file; separately, change a file from another terminal | The counts and lines change right after the Edit returns, and within 5 s for the outside change. |
| Detached HEAD (`git checkout --detach`) | Wait 5 s | Row 2 reads `⎇ <7-char sha>`. |
| A directory outside any repo | Start a session there | The header is the path alone. |
| Sidebar docked | Look at the body and its frame | Padding: 1 row above and below, 2 columns left and right. Claude Code draws the `│` rule, the `✕` and the row under the body. The footer is one row on the body's last row: `ctui <plugin.json version> │ claude-cli <pinned version>`, names in `inactive`, versions in `text`, the `│` in `subtle`, with no update icon. It fits at 42 and at 53 columns. Each section header reads `▾` in `inactive`, then its title in bold `text`, with a blank row after each expanded section. |
| Sidebar docked, `inherit`, a custom theme in `~/.claude/themes/` picked in `/theme` | Change that file's `text`, `inactive` and `subtle` to new colors and save it (or switch Omarchy themes, which rewrites `~/.claude/themes/omarchy.json`); then pick the built-in `dark` theme in `/theme`, then `light` | Within a second each time, every Sidebar row recolors, the main text included: path, branch, section titles and versions follow `text`. No row keeps the terminal's own foreground. |
| Sidebar docked, `/ctui:theme everforest`, `/theme` on built-in `dark` | Look at the body; scroll it, fold a section, widen the terminal past 160 columns and back, and rewrite the active `/theme` file or pick another `/theme` | Every body cell, padding included, shows one flat `#363d41` through each step, with no stripes between rows. The `│` rule column, the `✕` row and the row below keep the `dark` dock color, so a frame shows. |
| The previous row | Pick `Everforest` in `/theme` too | The frame turns `#363d41` and goes away against the body. |
| Sidebar docked, `/ctui:theme catppuccin-latte`, `/theme` on built-in `dark`, then on `Catppuccin Latte` | Look at the body and frame each time | The body is `#e5e7ed` both times. On `dark` the frame shows; on `Catppuccin Latte` it goes away. |
| Sidebar docked, `/ctui:theme inherit`, `/theme` on built-in `dark` | Look at the body | No paint: the body shows the `/theme`'s dock color, the same as the frame. |
| Sidebar docked, `/ctui:theme inherit`, `/theme` on `custom:omarchy` (Omarchy's generated theme) | Look at the body; then switch Omarchy themes (`omarchy theme set tokyo-night`, then `everforest`) | The body is the Omarchy theme's background mixed 6% toward its foreground (`#373e42` for Everforest), one flat color, and takes each new theme's within a second. The frame keeps Claude Code's default dock color. |
| Sidebar docked | Click a section's `▾` | It turns `▸` and the section's rows fold. The header and footer have no fold mark. |
| Sidebar docked, `/ctui:theme flexoki-light`, `/theme` on built-in `dark` | Look at the fold arrows and a capped list's `▸ N more`; hover one, then click it | They draw in the Theme's `#706e69`, not the `/theme`'s grey, and in `#100f0f` under the pointer. A click folds or expands as before. |
| The previous row | Press ctrl+x tab, then Tab, then Enter; then Escape | The arrows turn the `/theme`'s grey while the Sidebar holds the focus. Tab inverts the first arrow, Enter folds its section, and after Escape the arrows are `#706e69` again. |
| `/config`: set MCP folded on | Start a new session, then run `/clear` | MCP starts folded. Fold another section, run `/clear`: the folds return to the settings. |
| Sidebar docked, a new session on a subscription, the built-in `dark` theme (`/theme`), no prompt sent | Look at Context and Limits | Context: an empty bar of `─` in `subtle`, `0%` in `text`, then `0 / <window> tokens` in `inactive` (`1M` on Opus 5.5) with `$0.00` in `inactive` at the right. Limits: `5h`, then `week`, each a label in `text`, a bar and its percent in `text`, the filled `━` cells in the level color (below 60 `success`, below 85 `warning`, else `error`) and the rest `─` in `subtle`; under each bar, in `inactive`, `resets in 3h 27m` (`resets in 6d 7h, Mon 09:00` past a day). |
| The previous row | Send a prompt and wait for the reply | Context fills: `<tokens> / <window> tokens` with thousands commas, the cost grows, the bar has filled cells. Limits percents follow the reply. |
| The previous row | Wait a minute | Each `resets in` counts down by a minute. |
| The previous row | Fold Context and Limits | Their headers read `4% · $0.11` and `5h 44% · wk 20%`, in `inactive`, at the right. |
| The previous row, both expanded | Run `/clear` | Within a second Context reads `0%`, `0 / <window> tokens`, `$0.00`; Limits keeps its windows; the footer still reads `ctui …` and `claude-cli …`. |
| Off a subscription: start with `--settings '{"apiKeyHelper":"echo sk-ant-api03-dummy"}'` (no key prompt, nothing saved) | Look at Limits | It reads `no limits reported`, in `inactive`. |
| Sidebar docked, `CLAUDE_CONFIG_DIR` set to a scratch folder (so `/mcp` writes stay out of `~/.claude.json`), a repo whose approved `.mcp.json` holds three working stdio servers, `MCP_TIMEOUT=10000` | Look at MCP | One row per server, plus one per claude.ai connector on the account: `●` in `success`, the name in `text`, then `N tools` in `inactive` at the right (`1 tool` for one). The header reads `n/n` in `inactive` (`3/3` with no connector). |
| The previous row | Run `/mcp disable <server>` | Within a second its row reads `○` in `subtle` and `off` in `inactive`, moved below the others, and the header counts one `●` fewer (`2/3` with no connector). |
| The previous row | Run `/mcp enable <server>` | Within a second or two the row reads `● N tools` again, back in its first place. A server slower than the 1 s tick reads `◐` and `connecting` in `warning` first. |
| The previous row | Kill one server's process (find its PID with `pgrep -af '<server script>'`, then `kill <pid>`) | Within a second its row reads `◐` and `connecting` in `warning`, then `✕` and `down` in `error` about 10 s after the kill. |
| The previous row, with a claude.ai connector or a plugin's server listed | Send a prompt, then look at its row | The label is its `/mcp` name without `claude.ai ` or `plugin:<plugin>:` (`Claude Docs`). Before the first prompt it reads the tool-name form (`Claude_Docs`). |
| The previous row | Fold MCP | The header's right side reads each state's glyph and count in its color, `●` first: `● 2 ✕ 1 ○ 1`. |
| The previous row | List the processes under `claude` (`pstree -a <pid>`) for 10 s | Only the MCP servers and short `git` runs: no `claude -p` and no `claude mcp list`. |
| Sidebar docked, Task tools on (the default), the default model (Opus 5.5), a new session | Look at Todo, then ask Claude to plan three steps with its task tools and work through them | Before the plan, Todo reads `0/0` in `inactive` with no rows. Rows appear as Claude creates the tasks, in its order: `○` in `subtle` with text in `inactive` for pending; `◐` in `warning` with the task's spinner text (`Running the tests`) in `text` for the one in progress; `✓` with text, both in `inactive`, once done. The header counts done over total (`1/3`). A task created after every task is done starts a fresh list, as Claude Code's own list (ctrl+t) does. |
| The previous row | Fold Todo | The header's right side reads `1/3 · <in progress item>` in `inactive`, or `3/3` once nothing is in progress. |
| The previous row | Exit, then `claude --resume` the session; separately, change a ctui setting in `/config` (a reload) | The same rows return at once, the in-progress row showing its subject after `--resume` and its spinner text after the reload. |
| The previous row | Run `/clear` | Within a second Todo reads `0/0` with no rows. |
| `/config`: ctui Task tools off, then restart the session | Look at Todo | It reads `no task tools on this model` and `turn on ctui Task tools in /config`, in `inactive`, and no count. `/model` to Haiku 4.5: within a second the count `0/0` shows. |
| Task tools on, start with `--tools Bash,Read` | Look at Todo | It reads `no task tools in this session`, in `inactive`. |
| Task tools on, start with `CLAUDE_CODE_ENABLE_TODO_TOOLS=0` set in the shell | Ask Claude to run `echo $CLAUDE_CODE_ENABLE_TODO_TOOLS`; then set Task tools off in `/config` and ask again | It prints `0` both times: ctui keeps the person's value. |
| Task tools on, the variable unset | Ask Claude to run `echo $CLAUDE_CODE_ENABLE_TODO_TOOLS`; set Task tools off in `/config` and ask again | It prints `1`, then nothing. |
| Sidebar docked, a new session | Look at Agents & shells | It reads `nothing running`, in `inactive`, and the header `0 running`. |
| The previous row | Ask Claude to start a background Explore agent that lists the folder, and to run `sleep 20` in the background | A row `◐` in `warning`, `Explore` in `text` then ` · <description>` in `inactive`, its elapsed time in `inactive` at the right (`21s`, `1m 15s`), and a row `◐ $ sleep 20`. The header reads `2 running`. Each row turns `✓` in `success` when it ends and leaves 8 s later. |
| The previous row | Ask Claude to start a general-purpose agent that itself runs `sleep 30` in the background | The shell row sits under the agent as `└ ◐ $ sleep 30`, 2 columns further in. |
| The previous row | Ask Claude to run `sleep 2; exit 3` in the background | It ends as `✗` in `error`, `$ sleep 2; exit 3 · exit code 3`. |
| The previous row | Ask Claude to start a background Explore agent with a description longer than the row, and to run `sleep 70` in the background | The description ends in `…` with a space before the elapsed time. Past a minute the shell's time reads `1m 05s`, never cut. |
| The previous row, with work running | Fold Agents & shells | The header's right side reads `◐ <n> running`, or `nothing running` once all has ended. |
| Background `sleep 120` running | Run `/clear` | Within a second the row is back with its elapsed time still counting, and its end still turns it `✓`. Same after `/resume` to another session. |
| Background `sleep 300` running | Open `/tasks`, stop it with `x`, close the dialog, then send any prompt | Nothing changes until the prompt; then the row reads `✗ $ sleep 300 · killed`, with no toast. |
| `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`, a teammate running (an Agent call with a `name`) | Look at Agents & shells | No row and no toast for the teammate, nor for a TaskStop of it. |
| A Workflow run whose agents run a background shell | Look at Agents & shells | One `◐ ⚙ <workflowName> workflow` row, the shells under it as `└ ◐ $ …`. The run's end turns it `✓` and removes the shells. |
| More section rows than fit: an expanded long list, or a shorter terminal. Before the sections have rows of their own, give one stub section's `view` 12 placeholder rows and revert it after. | Check the cap: 4 rows then `▸ 8 more`; click it for every row and `▾ show less`. Then scroll the wheel over the Sidebar, down then up | `↓ more` marks the window's last row. Scrolling moves the sections only; the header and footer stay. `↑ more` shows once scrolled; at the end only `↑ more` shows. |

## Toasts

In fullscreen, toasts draw at the top right under the title `ctui`. On the main screen, Claude Code draws each one as `ctui: <text>` at the right of the line under the prompt, for its 4 s.

| Setup | Action | Expected |
|---|---|---|
| Fullscreen, Sidebar docked | Ask Claude to start a background Explore agent that lists the folder | A toast `◆ Explore started: <description>`; when it ends, `✓ Explore done · <description> · <elapsed>`. |
| The previous row | Ask Claude to run `sleep 3; echo hi` in the background | `$ sleep 3; echo hi started in background`, then `✓ shell done · sleep 3; echo hi · 3s`. |
| The previous row | Ask Claude to run `sleep 2; exit 3` in the background | `✗ shell failed: exit code 3`. |
| The previous row | Ask Claude to run `sleep 60` in the background, then stop it with TaskStop | `✗ shell killed`. |
| The previous row | Ask Claude to start a Workflow | `◆ workflow started: <workflowName>`, then `✓ workflow done · <workflowName> · <elapsed>`. Shells inside it raise none. |
| The previous row | Ask Claude to start four background agents at once | Toasts come about 2 s apart, at most two on screen. An end goes ahead of starts still waiting, and a start still waiting when its own end comes is dropped; every end shows. |
| A background shell stopped from `/tasks` | Send a prompt | No toast. |
| `/config`: ctui Agent and shell toasts off | Repeat the first row | No toast; the Sidebar rows still show. |
| Main screen (`--settings '{"tui":"default"}'`) | Repeat the first row | The same toast texts, as `ctui: <text>` at the right of the line under the prompt. |

## Render-site rewrites

Run each row in fullscreen and again on the main screen (`--settings '{"tui":"default"}'`).

| Setup | Action | Expected |
|---|---|---|
| Fullscreen, Sidebar docked | Send a prompt long enough to wrap and ask for a one-paragraph reply; ask Claude to run a long Bash command | The prompt panel, the reply and the `$ Bash` row end 2 columns before the Sidebar's `│` rule. On the main screen they span the full width. Rows Claude Code draws alone (tool output under `⎿`, other tools) still reach the rule. |
| A new session | Send a prompt of several lines with a pasted block | The prompt sits in a panel in `userMessageBackground` with a thin `┃` in `promptBorder` down its left edge, one row above it. The bar spans the panel's rows and no later row. The pasted text shows without its tags. |
| The previous row | Ask for a reply with a heading, bold text and a list | The reply has no `●` bullet and starts 2 columns in, the markdown styled as Claude Code styles it. |
| The previous row | Ask Claude to read a file in the cwd, run a two-line Bash command, run `true`, run `ls /nonexistent-dir`, write a new file and edit it | One row each, 2 columns in: `→ Read  <relative path> · N lines`, `$ Bash  <first line> … · N lines`, `$ Bash  true · no output`, `$ Bash  ls /nonexistent-dir · Error: Exit code 2` with the glyph, name and summary in `error`, `← Write  <path> · +N`, `← Edit  <path> · +a -d`, each summary dim. A path outside the cwd is absolute, with `~` for home. Write and Edit keep Claude Code's `⎿` result and diff under the row; on the main screen a Bash call Claude Code didn't fold into a group keeps its `⎿` output too. While a call runs its summary reads `running`. |
| The previous row | Ask Claude to run `sleep 2` in the background | The task notification row stays Claude Code's `● Background command "…" completed (exit code 0)` line, with no bar. |
| The previous row | Ask Claude to run `ping -c 30 127.0.0.1` in the foreground (Claude Code blocks a bare `sleep 30`), then press Esc while it runs | The Bash row reads `· interrupted` in `warning`. |
| The previous row | Press ctrl+o, then ctrl+o again | The transcript view shows the same rows; fullscreen shows each call with its full result under it. |
| The previous row | Ask Claude to create a task with TaskCreate | Claude Code's own `● TaskCreate` row: tools other than Read, Edit, Write and Bash keep theirs. |
| A new session on Haiku 4.5, 120 columns | Look at the line under the prompt | `claude-haiku-4-5-20251001` dim at its right edge, after Claude Code's mode pill and hint. In fullscreen, it stays there once a prompt docks the Sidebar. |
| The previous row | Run `/model claude-opus-5-5`, then `/effort low` | Within a second the label reads `claude-opus-5-5`, then `claude-opus-5-5 · low effort`. |
| The previous row | Press shift+tab to accept edits, then send a prompt | Its footer reads `✻ accept edits · claude-opus-5-5 · <Verb> for Ns · done <time>`. The first turn's footer keeps `manual mode · claude-haiku-4-5-20251001`. |
| The previous row | Ask Claude to start a background agent that fails at once (an agent file in `~/.claude/agents/` whose `model` doesn't exist), then stop | Claude Code reports the failure in a new turn at once. Both turns' footers read `✻ <mode> · <model> · …`. |
| The previous row | Narrow the terminal to 80 columns | The label moves to its own row under the hint, left-aligned. Widening back returns it to the right edge. |
| The previous row | Run `/clear` | The label keeps `· low effort`. |

## Themes

| Setup | Action | Expected |
|---|---|---|
| Fullscreen, Sidebar docked | Run `/theme` | The list holds the 22 Themes by name with `from ctui` at the right, from `Catppuccin` to `White`. |
| The previous row | Pick `Everforest` (dark), then run `/theme` again and pick `Catppuccin Latte` (light) | Each pick recolors all of Claude Code at once: the transcript text, the prompt's rules and the dock. The dock is a flat tint just off the terminal background, `#363d41` for Everforest and `#e5e7ed` for Catppuccin Latte. |

## Commands and pickers

| Setup | Action | Expected |
|---|---|---|
| Fullscreen, Sidebar docked | Run `/ctui:plugins:disable mcp` | No transcript row, not even the command line, and nothing reaches the model. Claude Code prints `● ctui: options changed — reloaded`, and the Sidebar redraws without MCP. |
| The previous row | Run `/ctui:plugins:disable mcp` again; then `/ctui:plugins:enable foo` | `⎿ ctui: mcp is already disabled`, then `⎿ ctui: Unknown plugin "foo". Plugins: git, context, limits, mcp, todo, agents, versions`. |
| The previous row | Run `/ctui:plugins:enable` | A picker docks as a tab over the Sidebar, as wide as the Sidebar, focused, listing `mcp` only. Enter on it closes the picker, the Sidebar returns with MCP, and `● ctui: options changed — reloaded` prints. |
| Every Sidebar plugin enabled | Run `/ctui:plugins:enable` | `⎿ ctui: All Sidebar plugins are already enabled`; no picker. |
| Sidebar docked | Run `/ctui:plugins:disable`, then press Esc | The picker lists all seven plugins in Sidebar order; Esc closes it with no change, and the Sidebar returns. |
| Sidebar docked, `/theme` on built-in `dark` | Run `/ctui:theme`; press Enter | The picker lists 23 rows, `inherit` then the Theme slugs A–Z (`catppuccin` … `white`), with `inherit` selected. Enter closes it with no reload row. Run it again and press Esc: it closes. |
| The previous row | Run `/ctui:theme`, pick `everforest` | The picker closes, Claude Code prints its reload row and no `⎿ ctui:` line. The Sidebar's text recolors to Everforest's (`text` `#d3c6aa`, `inactive` `#918c7e`); the transcript keeps `dark`. |
| The previous row | Run `/ctui:theme`: `everforest` is selected. Pick `inherit` | The Sidebar's text returns to the `dark` theme's colors. |
| The previous row | Run `/ctui:theme inherit`; then `/ctui:theme x` | `⎿ ctui: Sidebar theme is already inherit`, then `⎿ ctui: Unknown theme "x". Themes: inherit, catppuccin, …, white`. |
| A reply streaming | Type `/ctui:plugins:disable todo` and press Enter | It waits for the reply to end (Claude Code offers ctrl+x ctrl+s to send it now), then runs as above. |
| Main screen (`--settings '{"tui":"default"}'`) | Run `/ctui:plugins:disable` | The picker sits inline above the prompt; a pick closes it and writes. |

## `claude -p`

| Setup | Action | Expected |
|---|---|---|
| A shell | `claude -p --plugin-dir ./ctui '/ctui:plugins:disable mcp'`, then the same with `/ctui:theme` and `/ctui:theme x` | `ctui: Can't change ctui settings in claude -p. Use /config in an interactive session.` twice, then `ctui: Unknown theme "x". Themes: inherit, catppuccin, …, white`. No model reply, no settings change. |
