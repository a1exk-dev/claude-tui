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
| Fullscreen, Sidebar docked, in a repo under the home directory with an upstream, one staged, one modified and one untracked file, one stash | Look at the header | Row 1: the path in bold `text`, with `~` for home. Row 2 is blank. Each git row leads with a Devicons glyph in `inactive` drawn full size in the Nerd Font, then a space, so glyphs line up in column 0 and text in column 2. Row 3: the `dev-git_branch` glyph (`U+E725`), then the branch in `text`. Row 4: the `dev-git` glyph (`U+E702`), then `↑<ahead> ↓<behind>` in `text`, `+1` in `success`, `!1` in `warning`, `?1` in `inactive`, `≡1` in `suggestion`. Row 5: the `dev-git_compare` glyph (`U+E728`), then `+<added>` in `success`, `-<removed>` in `error`, then `lines changed` in `inactive`. Colors are theme keys of the current `/theme`. |
| The previous row | Ask Claude to edit a file; separately, change a file from another terminal | The counts and lines change right after the Edit returns, and within 5 s for the outside change. |
| Detached HEAD (`git checkout --detach`) | Wait 5 s | Row 3 reads the `dev-git_branch` glyph and `<7-char sha>`. |
| A directory outside any repo | Start a session there | The header is the path alone, with no glyph and no blank row under it before the `═` rule's own blank row. |
| Sidebar docked | Look at the body and its frame | Padding: 1 row above and below, 2 columns left and right. Claude Code draws the `│` rule, the `✕` and the row under the body. The footer ends on the body's last row, with no update icon. At 53 columns it is one row, `claude cli: <pinned version> │ ctui: <plugin.json version>, <Theme name>`; at 42 it is two, `claude cli: <pinned version>` then `ctui: <plugin.json version>, <Theme name>`. The Theme name is the one `/theme` lists (`Tokyo Night` after picking it in `/ctui` › Themes), or `inherit`. Labels in `inactive`, versions and the name in `text`, the `│` in `subtle`; nothing truncates. Each expanded section header reads `▼` in `inactive`, then its title and a `:` in bold `text`. A folded header's `▶` draws as a text triangle one cell wide, not an emoji, in Alacritty and in Ghostty. |
| Sidebar docked, every section expanded, at 42 columns and again at 53 (160+ terminal columns) | Look at the sections at rest; fold MCP and Agents & shells; then expand them and scroll the sections down and back | At rest: a `─` rule in `subtle` across the whole body width between every two sections, none above the first or below the last. 1 row of space under each expanded section title before its first row, and 1 row after each expanded section before the rule. A folded title has no space under it, and the rule follows directly. Between the git header and the first section: 1 blank row, a `═` rule in `subtle` across the whole body width, 1 blank row. While scrolled, a title at the window's top keeps its blank row and rule under `↑ more`, the window never ends on a rule or the blank row before it, `↑ more` / `↓ more` stay one row each, and the header, its blank rows and `═` rule, the footer and the padding don't move. |
| Sidebar docked, every section expanded, at 42 columns and again at 53 (160+ terminal columns) | Under `inherit` (picked in `/ctui` › Themes) with `/theme` on built-in `dark`, look at each rule; press ctrl+x tab and look again, then Escape; repeat under Everforest | Each `─` rule and the `═` rule fill exactly the body width: from the body's first column to its last, 2 columns before the frame, with no cell cut off and nothing wrapped onto the next row. Each draws in `subtle`, the `/theme`'s under `inherit` and the Theme's under `everforest`, the same while the Sidebar holds the focus. |
| Sidebar docked, `inherit`, a custom theme in `~/.claude/themes/` picked in `/theme` | Change that file's `text`, `inactive` and `subtle` to new colors and save it (or switch Omarchy themes, which rewrites `~/.claude/themes/omarchy.json`); then pick the built-in `dark` theme in `/theme`, then `light` | Within a second each time, every Sidebar row recolors, the main text included: path, branch, section titles and versions follow `text`. No row keeps the terminal's own foreground. |
| Sidebar docked, Everforest picked in `/ctui` › Themes, `/theme` on built-in `dark` | Look at the body; scroll it, fold a section, widen the terminal past 160 columns and back, and rewrite the active `/theme` file or pick another `/theme` | Every body cell, padding included, shows one flat `#363d41` through each step, with no stripes between rows. The `│` rule column, the `✕` row and the row below keep the `dark` dock color, so a frame shows. |
| The previous row | Pick `Everforest` in `/theme` too | The frame turns `#363d41` and goes away against the body. |
| Sidebar docked, Catppuccin Latte picked in `/ctui` › Themes, `/theme` on built-in `dark`, then on `Catppuccin Latte` | Look at the body and frame each time | The body is `#e5e7ed` both times. On `dark` the frame shows; on `Catppuccin Latte` it goes away. |
| Sidebar docked, Sidebar theme `inherit`, `/theme` on built-in `dark` | Look at the body | No paint: the body shows the `/theme`'s dock color, the same as the frame. |
| Sidebar docked, Sidebar theme `inherit`, `/theme` on `custom:omarchy` (Omarchy's generated theme) | Look at the body; then switch Omarchy themes (`omarchy theme set tokyo-night`, then `everforest`) | The body is the Omarchy theme's background mixed 6% toward its foreground (`#373e42` for Everforest), one flat color, and takes each new theme's within a second. The frame keeps Claude Code's default dock color. |
| Sidebar docked | Click a section's `▼` | It turns `▶` and the section's rows fold. The header and footer have no fold mark. |
| Sidebar docked at 42 columns, then at 53 (150 and 170 terminal columns, no dragged `dockColumns`) | Click a section's bold title, then the blank middle of another title row, then a count at the right (`0/0`, `0 running`); fold one, then press ctrl+x tab and click a title, a blank middle and a count once each | Each first click folds or unfolds that section, at rest and while the Sidebar holds the focus. Every count and folded summary ends in the same column as the body rows, 2 columns before the frame, focused or not. A folded MCP summary keeps `●` in `success`. |
| The previous row, at rest | Move the pointer onto a title row's blank middle, then onto its arrow, then off the Sidebar | Anywhere on the row the arrow and the title, its `:` included, draw in `suggestion`, and nothing underlines; off the row the arrow returns to `inactive` and the title to bold `text`. |
| More section rows than fit (a 22-row terminal) | Scroll the wheel down over a section's title row, then click a title that moved | The sections scroll. The click folds the section under the pointer. |
| Sidebar docked, Flexoki Light picked in `/ctui` › Themes, `/theme` on built-in `dark` | Look at the fold arrows and a capped list's `▸ N more`; hover one, then click it | They draw in the Theme's `#706e69`, not the `/theme`'s grey. Under the pointer a fold arrow draws in the Theme's accent `#205ea6`, and `▸ N more` in `#100f0f`. A click folds or expands as before. |
| The previous row | Press ctrl+x tab, then Tab, then Enter; then Escape | The arrows turn the `/theme`'s grey while the Sidebar holds the focus. Tab inverts the first arrow, Enter folds its section, and after Escape the arrows are `#706e69` again. |
| `/config`: set MCP folded on | Start a new session, then run `/clear` | MCP starts folded. Fold another section, run `/clear`: the folds return to the settings. |
| Sidebar docked, a new session on a subscription, the built-in `dark` theme (`/theme`), no prompt sent, Limits cost `auto` | Look at Context and Limits | Context: an empty bar of `─` in `subtle`, `0%` in `text`, then `0 / <window> tokens` in `inactive` (`1M` on Opus 5.5), and no cost. Limits: no `cost` row; `5h`, then `week`, each a label in `text`, a bar and its percent in `text`, the filled `━` cells in the level color (below 50 `success`, below 85 `warning`, else `error`) and the rest `─` in `subtle`; under each bar, in `inactive`, `resets in 3h 27m` (`resets in 6d 7h, Mon 09:00` past a day). |
| The previous row | Send a prompt and wait for the reply | Context fills: `<tokens> / <window> tokens` with thousands commas, the bar has filled cells. Limits percents follow the reply. |
| The previous row | Wait a minute | Each `resets in` counts down by a minute. |
| The previous row | Fold Context and Limits | Their headers read `4%` and `5h 44% · wk 20%`, in `inactive`, at the right; no cost. |
| The previous row, both expanded | Run `/clear` | Within a second Context reads `0%`, `0 / <window> tokens`; Limits keeps its windows; the footer still reads `claude cli: …` and `ctui: …`. |
| On a subscription, `settings.json` `pluginConfigs["ctui@claude-tui"].options.limits_cost` set to `"on"` | Look at Limits, send a prompt, then fold Limits | First `cost` in `text`, a bar in the level color and `0%` in `text`, its percent under the windows' percents; under it, this month's total as `<total>$ of 100$` in `inactive`; then `5h` and `week`. After the reply the total grows by the reply's cost (`+0.12$`). Folded: `<total, whole dollars>$ · 5h 44% · wk 20%` in `inactive`. |
| Off a subscription: start with `--settings '{"apiKeyHelper":"echo sk-ant-api03-dummy"}'` (no key prompt, nothing saved), Limits cost `auto` | Look at Limits, then fold it | Only the cost row: `cost`, a bar, its percent, and this month's total as `<total>$ of 100$` in `inactive` under it. Folded: `<total, whole dollars>$`. |
| The previous row | `/config`: set Limits monthly cost to `0` | After the reload the bar stays empty, there is no percent, and the line under it reads the total alone, `<total>$`. |
| The previous row | In `settings.json`, set `limits_cost_monthly` to `0.01`, then send a prompt | After the reload the bar is full in `error`, the percent is the real one past 100 (`1200%` at 0.12$), and the line reads `<total>$ of 0.01$`. |
| The previous row | `/config`: set Limits cost off | After the reload Limits reads `no limits reported`, in `inactive`. |
| On a subscription, Limits cost `on`, other sessions ended this month | Start a session and look at Limits | The `cost` line reads the sum of every main transcript's last `cost-state` `totalCostUSD` in `~/.claude/projects/*/*.jsonl` last written this month, the current session's left out, plus `/cost`. Before the first scan ends there is no `cost` row. |
| The previous row, with ctui's store removed (`~/.claude/plugins/store/ctui_inline-*.json` under `--plugin-dir`) and the page cache dropped for `~/.claude/projects` (`posix_fadvise(DONTNEED)` on each file, or `echo 3 > /proc/sys/vm/drop_caches` as root) | Start a session and time the `cost` row's arrival | The row appears within 2 s of the session start, with the same total as the warm run. On 2.1.292, 792 transcripts (395 MiB) took 1.5 s: the grep 0.4 s, the store writes the rest. |
| The previous row, a prompt sent | Run `/clear` and watch the `cost` line, with a probe mod polling `$.session.id()` and `$.session.usage().cost` every 20 ms | The probe never reads the new id with the old cost or the old id with 0: both switch together, right after `session.end` (`clear`). The row hides for about a second, then the total reads as before `/clear` (the old session now counted by its line, the new one at 0), never counted twice. |
| Sidebar docked on a subscription, `/config`: Limits cost off | Look at Limits | After the reload Limits shows `5h` and `week` with their resets and no `cost` row; Context shows no cost either. |
| Sidebar docked, `CLAUDE_CONFIG_DIR` set to a scratch folder (so `/mcp` writes stay out of `~/.claude.json`), a repo whose approved `.mcp.json` holds three working stdio servers, `MCP_TIMEOUT=10000` | Look at MCP | One row per server, plus one per claude.ai connector on the account, A–Z by name: `●` in `success`, the name in `text`, then `project · N tools` in `inactive` at the right (`1 tool` for one; `claude.ai · …` for a connector). The header reads `n/n` in `inactive` (`3/3` with no connector). |
| The previous row | Run `/mcp disable <server>` | Within a second its row reads `○` in `subtle` and `project · off` in `inactive`, moved below the others (A–Z among the `off` rows), and the header counts one `●` fewer (`2/3` with no connector). |
| The previous row | Run `/mcp enable <server>` | Within a second or two the row reads `● N tools` again, back in its A–Z place. A server slower than the 1 s tick reads `◐` and `connecting` in `warning` first. |
| The previous row | Kill one server's process (find its PID with `pgrep -af '<server script>'`, then `kill <pid>`) | Within a second its row reads `◐` and `connecting` in `warning`, then `✕` and `down` in `error` about 10 s after the kill. |
| The previous row, with a claude.ai connector or a plugin's server listed | Send a prompt, then look at its row | The label is its `/mcp` name without `claude.ai ` or `plugin:<plugin>:` (`Claude Docs`). Before the first prompt it reads the tool-name form (`Claude_Docs`). Its source reads `claude.ai`, or the plugin's name. |
| Sidebar docked, a new chat | Look at Skills, between Todo and MCP | The header reads `Skills:` and `0`, and one faint row `no skills used yet`. |
| The previous row, a user skill, a plugin skill and a markdown command installed | Type the user skill as `/name`; ask Claude to use the plugin skill with the Skill tool; ask Claude to start a subagent that uses a skill; run the markdown command; run `/context`; type the user skill again | One row per skill, A–Z, each with its source at the right in `inactive` (`user`, the plugin's name); no `context` row; the second use changes nothing. The header count matches the rows, folded too. A long name truncates with `…`; the source stays whole. |
| The previous row | Change a setting in `/config` (a reload), then run `/compact` | The rows stay. |
| The previous row | Run `/clear` | Within a second the section reads `0` and `no skills used yet`. |
| The previous row, a skill used, then the session quit | `claude --resume <id>` | The resumed chat's typed and Skill-tool skills are back; one used only inside the subagent is not. |
| The previous row, plus a server in `claude mcp add --scope user` and one in `--scope local`, and a server of the same name as a user one passed with `--mcp-config` | Start the session and look at MCP; ask Claude to call one tool of the `--mcp-config` server | The rows read `user · …`, `local · …` and `project · …` by where each is defined. The `--mcp-config` one first reads `user`, and `dynamic` within a second of its tool's run. |
| The previous row | Fold MCP | The header's right side reads each state's glyph and count in its color, `●` first: `● 2 ✕ 1 ○ 1`. |
| The previous row, a second repo where `/mcp disable` turned off a different server | `/cd` into the second repo | Within a second or two the `off` rows are the second repo's, and the first repo's `off` row is gone, with no `connecting` row for it. |
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

## The `/ctui` menu

| Setup | Action | Expected |
|---|---|---|
| `settings.json` `pluginConfigs` for ctui holding `"git_enable": false` and `"versions_enable": false` from an earlier ctui | Start a session, look at the Sidebar, then open `/config` | The session starts with no ctui error; the git header and the footer draw. `/config` lists no Git header or Versions footer row. |
| `/config`: Sidebar order set to `mcp, todo` | Look at the Sidebar | After the reload the sections read MCP, Todo, Context, Limits, Skills, Agents & shells, between the unchanged header and footer. |
| Fullscreen, Sidebar docked | Run `/ctui`, pick `Plugins ›` | `ctui › Plugins`: one row per section in Sidebar order, `✓ Context  ›` and so on, Skills included, no git header or versions footer; under them `enter settings · x: on/off · k: up · j: down · esc back`. The first row has the ring. |
| The previous row | Press Down twice, then `x` | One `● ctui: options changed — reloaded` row; the third section turns `✗` and leaves the Sidebar behind the menu. The menu stays open with the ring on that row. `x` again turns it back. |
| The previous row | Press `j` three times quickly | The row moves down three places at once, the ring staying on it. About a second after the last press, one reload row prints and the Sidebar reorders; the ring is still on the moved row after the reload. |
| The previous row | Press `k`, then Esc within a second | The order is written before the menu goes back to the top level; one reload row. |
| The previous row | Pick `Plugins ›`, press Enter on a row, then Esc | `ctui › Plugins › <title>` opens, also for a section that is off; Esc returns to the list with the ring on that row. |
| The previous row | Pick `Plugins ›`, then Enter on Limits | `ctui › Plugins › Limits`: `Start folded  off`, `Cost          auto`, `Monthly cost: 100`, then `enter change · esc back`. The ring is on `Start folded`; Down walks to `Cost` and into the field (it shows `⏎ submit`), Up back. |
| The previous row | On `Start folded` press Enter; on `Cost` press Enter three times | Each Enter prints one reload row and keeps the ring on its row. `Start folded` reads `on`; Limits in the Sidebar stays expanded until a new session. `Cost` steps `on`, `off`, `auto`. |
| The previous row | In the field type `abc`, Enter; then clear it, type `-5`, Enter; then clear it, type `250`, Enter | `abc`: a toast `Can't set the monthly cost: "100abc" isn't a number`, no reload row, and the field shows `100` again with the ring. `-5`: a toast with the engine's reason, the field shows `100`. `250`: one reload row, the field shows `250` with the ring, and the cost row's limit reads `of 250$`. |
| The previous row | Open Todo's and Agents & shells' screens; press Enter on `Task tools`, then on `Toasts` | Todo lists `Start folded` and `Task tools`, Agents & shells `Start folded` and `Toasts`; each Enter flips its value with one reload row. |
| Sidebar docked, `/theme` on built-in `dark` | Type `/` and look for ctui | The typeahead lists `/ctui` with its description and no `(ctui)` tag; no `/ctui:theme`. |
| The previous row | Run `/ctui themes` | A focused pane docks as a tab over the Sidebar, as wide as the Sidebar: `ctui`, then `Plugins ›` and `Themes ›`. The text after `/ctui` changes nothing. No transcript row. |
| The previous row | Pick `Themes ›` | `ctui › Themes`, a focused filter field, then 23 rows: `inherit`, then the Themes by name A–Z (`Catppuccin` … `White`), with `inherit` selected. |
| The previous row | Type `ever`, press Down, pick `Everforest` | Each keystroke narrows the list; Down moves into it. The pick prints one `● ctui: options changed — reloaded` row and no `⎿ ctui:` line. The menu stays open on Themes with the filter `ever` and the keys; the Sidebar behind it recolors to Everforest's (`text` `#d3c6aa`, `inactive` `#918c7e`); the transcript keeps `dark`. |
| The previous row | Type `xyz` in the filter | The list gives way to `no match`. |
| The previous row | Press Esc; then press Down and Enter | The menu goes back to `Plugins ›` / `Themes ›` with no transcript row and keeps the keys: Down and Enter work without a click. |
| The previous row | Press Esc | The menu closes and the Sidebar returns. |
| The previous row, `Everforest` selected | Run `/ctui`, pick `Themes ›`, pick `inherit` | The Sidebar's text returns to the `dark` theme's colors. Picking the selected Theme again prints no reload row. |
| A reply streaming | Type `/ctui` and press Enter | The menu opens at once; the reply keeps streaming. |
| A project command `.claude/commands/ctui.md` | Start a session | One toast: `/ctui is taken by your own /ctui; change ctui settings in /config`. The Sidebar draws as usual. A settings change in `/config` (reload) raises no second toast. |
| Main screen (`--settings '{"tui":"default"}'`) | Run `/ctui`, pick `Themes ›` | The menu sits inline above the prompt; picks and Esc work as above. |

## `claude -p`

| Setup | Action | Expected |
|---|---|---|
| A shell | `claude -p --plugin-dir ./ctui '/ctui'` | `ctui: Can't change ctui settings in claude -p. Use /config in an interactive session.` No model reply, no settings change. |
