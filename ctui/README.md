# ctui

ctui is a [mod](https://code.claude.com/docs/en/plugins/mods/overview) for Claude Code: a plugin that changes how Claude Code looks and behaves. It docks a sidebar beside the transcript with git, context, limits, todo, skills, MCP, and agents-and-shells sections, and it restyles the lines under the prompt input. It also raises short toasts when a subagent or a background shell starts, finishes, or fails.

![The sidebar with every section folded](https://raw.githubusercontent.com/a1exk-dev/claude-tui/main/docs/design/sidebar-1-all-folded.png)

![The sidebar with every section expanded](https://raw.githubusercontent.com/a1exk-dev/claude-tui/main/docs/design/sidebar-3-all-expanded.png)

Needs Claude Code 2.1.292 or later. Tested with 2.1.300.

## Install

```text
/plugin marketplace add a1exk-dev/claude-tui
/plugin install ctui@claude-tui
```

The sidebar docks only in fullscreen: set `"tui": "fullscreen"` in `settings.json` or start Claude Code with `CLAUDE_CODE_NO_FLICKER=1`, in a terminal 110 or more columns wide. Below that, or on the main screen, ctui draws no sidebar; the toasts and the restyled rows still show.

## Examples

**Follow a multi-step job in the todo section.** Ask for several things at once, such as "rename a.txt to notes.txt, then create a README.md, then tell me how many lines each file has". With **Task tools** on (the default), Claude makes one task per outcome first, and the todo section lists them: a spinner on the one in progress, a check on each one done.

**Watch background work.** Ask Claude to run something in the background, such as "run `npm test` in the background", or to start a background subagent. A toast says it started (`$ npm test started in background`), a row under Agents & shells shows it running with its elapsed time, and a second toast says when it is done or failed.

**Switch the sidebar's theme.** Type `/ctui`, choose **Themes**, type part of a name to narrow the list, and press Enter on a theme. The sidebar takes its colors at once, and every new session keeps it.

## Terminal setup

**tmux.** Inside tmux, Claude Code draws with the 256-color palette even when your terminal supports true color, so sidebar backgrounds and theme colors turn into the nearest grey. Turn true color back on in the `env` block of your user `settings.json`, then restart Claude Code:

```json
{
  "env": {
    "CLAUDE_CODE_TMUX_TRUECOLOR": "1"
  }
}
```

**Ghostty with a transparent background.** With `background-opacity` below 1, Ghostty draws cells that have their own background color fully opaque, so the sidebar looks like a solid, lighter panel beside the see-through transcript. Add this to `~/.config/ghostty/config` and reload Ghostty, so colored cells take the same opacity:

```ini
background-opacity-cells = true
```

## Configuration

Every setting, the sidebar sections and their options, an example Claude Code theme with the colors ctui uses, and how to set the main background in your terminal are in [the configuration docs](https://github.com/a1exk-dev/claude-tui/blob/main/docs/configuration.md).

## Settings

`/ctui` opens ctui's settings menu at once, even while Claude is replying.

![The Plugins screen of the /ctui menu](https://raw.githubusercontent.com/a1exk-dev/claude-tui/main/docs/design/menu-2-plugins.png)

![The Themes screen of the /ctui menu](https://raw.githubusercontent.com/a1exk-dev/claude-tui/main/docs/design/menu-4-themes.png)

- **Plugins** lists the sidebar sections in their order: `x` turns the focused one on or off, `k`/`j` move it up or down (saved on the menu's next change, opening a plugin, Esc, close, `/ctui` or session end), and Enter opens its settings.
- **Themes** lists `inherit` (the default, which follows your Claude Code theme) and every bundled theme by name, with a filter field: type to narrow the list, pick to switch.

Esc goes back one level, and closes the menu at the top. If another command already holds `/ctui`, ctui says so in a toast once per session; change its settings in `/config` instead. Each section and the toasts also have a row in `/config`. Settings are saved to your user `settings.json`, so a change applies to every session.

## Task tools

The todo section shows Claude's task list. Claude Code gives Claude the Task tools (TaskCreate, TaskList, TaskUpdate) by default only on some models; Opus 5.x and Sonnet 5.x don't get them. So ctui turns them on for each session by setting `CLAUDE_CODE_ENABLE_TODO_TOOLS=1`, and subagents and anything the session starts inherit it. To turn this off, set **Task tools** to off under ctui in `/config`. ctui leaves the variable alone when you set it yourself, for example in the `env` block of `settings.json`.

**Task tools** also keeps TaskCreate and TaskUpdate (or TodoWrite) in Claude's prompt rather than deferred, adds a line to TaskCreate's or TodoWrite's description, and adds a short task-list section to Claude's prompt asking for one task per outcome, so Claude keeps a list for multi-step work on its own. That costs about 1.2k cached tokens per request. Turning **Task tools** off stops both, even when you set the variable yourself. A change fully reaches Claude from the next `/clear` or new session: Claude Code keeps the prompt a conversation started with.

While the sidebar is docked with **Todo** on, ctui runs Claude's own TaskCreate and TaskUpdate calls itself, so the list shows once, in the sidebar, and Claude Code's own list stays hidden.

## Privacy and data

ctui makes no network calls, and nothing it reads leaves your machine. [What ctui watches](#what-ctui-watches) writes out every program it starts.

What ctui stores, and for how long:

- **Cost totals**, only while **Limits cost** is on: for each session that ended this month, its dollar total and its transcript's size and modification time, in ctui's own store, a JSON file under Claude Code's configuration directory. The first scan in a new month deletes the earlier months' totals.
- **Settings** you change in `/ctui`: ctui's own `ctui.*` settings, in your user `settings.json`.
- **Sidebar and menu state**: folded sections, scroll, what each section lists, the turn footers' mode and model, and where you are in the `/ctui` menu. Claude Code holds these for the session only, ctui writes none of them to disk, and `/clear` empties them.

What ctui reads:

- `~/.claude.json` (or `$CLAUDE_CONFIG_DIR/.claude.json`), for the MCP section. That file also holds your sign-in and account data; ctui keeps only the names of your MCP servers (your own and this project's) and the project's list of servers you turned off, never a server's config, which can hold secrets.
- The `.mcp.json` files from the working directory up, and the managed `managed-mcp.json`: server names only.
- Your Claude Code settings, for which project MCP servers you approved and the model's effort, and the managed settings, for the names of managed MCP servers.
- With the `inherit` theme and a custom Claude Code theme, that theme's file from `~/.claude/themes/`, to tint the sidebar.
- The session's messages: to rebuild the skills section when it starts empty (a new process, `/clear` or `/resume`), and, on a model with TodoWrite instead of the Task tools, to fill the todo section. ctui keeps only the names of the skills and commands used, whether each skill's folder is yours or the project's, and the last TodoWrite call's list.
- This month's transcripts' cost lines, only while **Limits cost** is on, through the `grep` under [What ctui watches](#what-ctui-watches).

## What ctui watches

ctui runs as a mod in every Claude Code session where the plugin is enabled. It watches Bash tool calls and subagent events to show background shells and agents, Claude's task tool calls for the todo section, and which skills and commands the chat invokes, with Claude Code's skill and command lists, for the skills section. Once you turn on **Limits cost** in `/config` (it is off by default), and while the Limits cost row shows, it also searches this month's Claude Code transcripts under `~/.claude/projects` (or `$CLAUDE_CONFIG_DIR/projects`) for their cost lines, reads only those lines, and keeps each session's dollar total to add up the month. Set **Limits cost** back to off to stop it. [Privacy and data](#privacy-and-data) lists every file and message ctui reads, what it keeps from each, and for how long.

Some of its hooks run in every session. A submitted prompt and a finished turn give the hook only their permission mode, for the turn footer; a finished tool call gives it only the server the call came from (`mcp_server`), while the `mcp` section is on; and `tool.call` gives it the tool name, to count MCP calls in flight and refresh `git`. Each of these events passes on unchanged, and ctui keeps nothing else from them.

The programs ctui runs are these four, and nothing else:

- `git --no-optional-locks status --porcelain=v2 --branch`
- `git --no-optional-locks stash list`
- `git --no-optional-locks diff --numstat HEAD`
- `grep -h -F '"type":"cost-state"' -- <transcripts>`, where `<transcripts>` are this month's transcript files whose cost ctui hasn't read yet, while the Limits cost row shows

The three `git` commands, run in the working directory for the sidebar header, only read the repository, and take no lock on it. Every argument is fixed text or a file path, never your conversation or a file's text, and the output of all four stays inside ctui, on your machine.

ctui calls Claude Code's tools itself in two cases only: `TaskList`, to read the session's task list for the todo section, and, while the sidebar is docked with **Todo** on, the main conversation's `TaskCreate` and `TaskUpdate` calls, which it runs for Claude so Claude Code's own list stays hidden. A subagent's task calls pass on to Claude Code unchanged.

ctui changes two kinds of settings only: its own `ctui.*` settings, when you change one in `/ctui`, and `CLAUDE_CODE_ENABLE_TODO_TOOLS`, which it sets for the session while **Task tools** is on.

Its `tool.describe` hook changes what Claude reads about its tools in two ways. With **Task tools** on, it keeps the tools that start and update a task list (`TaskCreate` and `TaskUpdate`, or `TodoWrite`) in the prompt rather than deferred, and adds one line to `TaskCreate`'s or `TodoWrite`'s description asking Claude to make a list for a request with two or more outcomes. It also reads each MCP tool's server name, to name that server's row as `/mcp` does. With **Task tools** on, its `prompt.compose` hook adds a short section to Claude's prompt asking for one task per outcome a request names.

These hooks change what Claude Code draws or does:

- **Closing the sidebar.** You can't close the sidebar yourself (`ui.close`); only ctui's own close passes.
- **Scrolling the sidebar.** ctui takes the sidebar's scroll (`ui.scroll`) and moves its sections itself; Claude Code's own scroll never runs.
- **The `/ctui` menu.** Its hidden hotkeys are denied focus, so the keyboard stays on the rows (`ui.focus`). Esc in a submenu goes back a level instead of closing the menu (`ui.close`); at the top, Esc closes it. A key press on a row (`ui.press`) and text in the Monthly cost field or the Themes filter (`ui.input`) pass on to Claude Code first; ctui then opens the screen, writes the `ctui.*` setting, moves a section in the order or filters the Themes they ask for.
- **Tool groups** are drawn expanded, so each call shows as its own row.
- **Transcript rows** are restyled: Claude's replies, your own prompts, the Read, Edit, Write and Bash rows, the line under the prompt (`model · effort` added) and each turn's footer (its mode and model added).
- **Task calls.** While the sidebar is docked with **Todo** on, the main conversation's `TaskCreate` and `TaskUpdate` calls run as ctui's, as above; a subagent's pass on.
- **`/ctui`** is answered by ctui.

These hooks read their event and pass it on unchanged:

- A background Bash call's result: its command's first line, which shows in the toast and under Agents & shells.
- A Workflow call's result: the run's id, name and `transcriptDir`, where ctui checks which run a background shell's agent belongs to. It looks only for that agent's transcript file, and reads none.
- Task notifications (`prompt.submit` and `session.append`): their text is parsed for the task's id, status and summary, to end its row and raise its toast. Only tasks ctui already shows are matched.
- A subagent's start and failure (`agent.spawn`, `StopFailure`): its type, description and error word. A `TaskStop` or `TodoWrite` result: the task's id, or the list.
- An invoked skill or command: its name, its source, and the folder line its text opens with.
- Each model step and `/effort`: the model and effort level, for the line under the prompt. A `/cd`: the new working directory.
- A prompt you type: it reopens the sidebar when an earlier open waited for room.

## Troubleshooting

**No sidebar.** The sidebar docks only in fullscreen (`"tui": "fullscreen"` in `settings.json`, or `CLAUDE_CODE_NO_FLICKER=1`) and in a terminal at least 110 columns wide; narrower, or on the main screen, ctui draws none. Claude Code docks a pane ctui opens on its own only from 144 columns: between 110 and 143, the sidebar opens with your first prompt, and from then on it docks from 110.

**`/ctui` opens something else.** Another plugin's command already holds `/ctui`, and ctui says so in a toast once per session. Change ctui's settings under ctui in `/config` instead.

**The todo section says `no task tools on this model`.** **Task tools** is off: turn it on under ctui in `/config`.

**Some parts don't work under an organization's management.** Where an organization manages Claude Code, Claude Code skips some of ctui's hooks; see **Managed Claude Code** below for what that turns off.

## Known differences

Some parts of the design renders are Claude Code's own and stay as Claude Code draws them: the sidebar's frame and close button, the prompt box, the permission-mode pill, the main background, and the rows of tools other than Read, Edit, Write and Bash. See [the full list](https://github.com/a1exk-dev/claude-tui/blob/main/docs/configuration.md#known-differences-from-the-renders).

**Managed Claude Code.** Where an organization manages Claude Code (managed settings, or a Team or Enterprise sign-in), Claude Code skips 7 of ctui's hooks. Then the skills section stays empty, Claude gets no task-list instruction, the turn footer drops its mode, MCP sources don't update after `/cd` or a finished call, and a failed agent shows no reason. `claude plugin validate` lists the skipped hooks.

## Support

For help and bug reports, open an issue in [GitHub Issues](https://github.com/a1exk-dev/claude-tui/issues). Report a security problem privately through [GitHub private vulnerability reporting](https://github.com/a1exk-dev/claude-tui/security/advisories/new), not in a public issue.

## License

MIT. The Themes in `themes/` are generated from the built-in theme palettes of [Omarchy](https://github.com/basecamp/omarchy) 4.0.4, also MIT-licensed; both notices are in [LICENSE](LICENSE).
