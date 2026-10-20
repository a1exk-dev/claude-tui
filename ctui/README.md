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

**Task tools** also keeps TaskCreate and TaskUpdate (or TodoWrite) and a short task-list instruction in Claude's prompt, so Claude keeps a list for multi-step work on its own. That costs about 1.2k cached tokens per request. Turning **Task tools** off stops both, even when you set the variable yourself. A change fully reaches Claude from the next `/clear` or new session: Claude Code keeps the prompt a conversation started with.

## What ctui watches

ctui runs as a mod in every Claude Code session where the plugin is enabled. It watches Bash tool calls and subagent events to show background shells and agents, watches Claude's task tool calls, and runs them for Claude while the sidebar is docked, and reads the session's task list for the todo section, watches which skills and commands the chat invokes, and reads the skill and command lists and, after a resume, the transcript, for the skills section, runs `git` in the working directory for the sidebar header, reads the names of your MCP servers and the ones you turned off from `~/.claude.json` (or `$CLAUDE_CONFIG_DIR/.claude.json`), the `.mcp.json` files from the working directory up, your settings and the managed MCP settings, and which server a finished MCP tool call came from, to show where each server comes from (never a server's config, which can hold secrets), and, with the `inherit` theme and a custom Claude Code theme, reads that theme's file from `~/.claude/themes/` to tint the sidebar. Once you turn on **Limits cost** in `/config` (it is off by default), and while the Limits cost row shows, it also searches this month's Claude Code transcripts under `~/.claude/projects` (or `$CLAUDE_CONFIG_DIR/projects`) for their cost lines, reads only those lines, and keeps each session's dollar total to add up the month. Set **Limits cost** back to off to stop it. It makes no network calls and sends nothing anywhere.

Some of its hooks run in every session. A submitted prompt and a finished turn give the hook only their permission mode, for the turn footer; a finished tool call gives it only the server the call came from (`mcp_server`), while the `mcp` section is on; and `tool.call` gives it the tool name, to count MCP calls in flight and refresh `git`. Each event passes on unchanged, and ctui stores and sends nothing from them.

The programs ctui runs are these four, and nothing else:

- `git --no-optional-locks status --porcelain=v2 --branch`
- `git --no-optional-locks stash list`
- `git --no-optional-locks diff --numstat HEAD`
- `grep -h -F '"type":"cost-state"' -- <transcripts>`, where `<transcripts>` are this month's transcript files whose cost ctui hasn't read yet, while the Limits cost row shows

The three `git` commands only read the repository, and take no lock on it. Their output and the `grep`'s stay on your machine.

ctui calls Claude Code's tools itself in two cases only: `TaskList`, to read the session's task list for the todo section, and, while the sidebar is docked with **Todo** on, Claude's own `TaskCreate` and `TaskUpdate` calls, which it runs for Claude so Claude Code's own list stays hidden.

ctui changes two kinds of settings only: its own `ctui.*` settings, when you change one in `/ctui`, and `CLAUDE_CODE_ENABLE_TODO_TOOLS`, which it sets for the session while **Task tools** is on.

Its `tool.describe` hook changes what Claude reads about its tools in two ways. With **Task tools** on, it keeps the tools that start and update a task list (`TaskCreate` and `TaskUpdate`, or `TodoWrite`) in the prompt rather than deferred, and adds one line to `TaskCreate`'s or `TodoWrite`'s description asking Claude to make a list for a request with two or more outcomes. It also reads each MCP tool's server name, to name that server's row as `/mcp` does. Apart from the rows it redraws in its own look and the task calls above, every other hook, `agent.spawn` included, passes its event on unchanged.

## Known differences

Some parts of the design renders are Claude Code's own and stay as Claude Code draws them: the sidebar's frame and close button, the prompt box, the permission-mode pill, the main background, and the rows of tools other than Read, Edit, Write and Bash. See [the full list](https://github.com/a1exk-dev/claude-tui/blob/main/docs/configuration.md#known-differences-from-the-renders).

**Managed Claude Code.** Where an organization manages Claude Code (managed settings, or a Team or Enterprise sign-in), Claude Code skips 7 of ctui's hooks. Then the skills section stays empty, Claude gets no task-list instruction, the turn footer drops its mode, MCP sources don't update after `/cd` or a finished call, and a failed agent shows no reason. `claude plugin validate` lists the skipped hooks.

## License

MIT. The Themes in `themes/` are generated from the built-in theme palettes of [Omarchy](https://github.com/basecamp/omarchy) 4.0.4, also MIT-licensed; both notices are in [LICENSE](LICENSE).
