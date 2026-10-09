# ctui

ctui is a skin for the Claude Code terminal UI. It docks a sidebar beside the transcript with git, context, limits, todo, skills, MCP, and agents-and-shells sections, and it restyles the lines under the prompt input. It also raises short toasts when a subagent or a background shell starts, finishes, or fails.

Tested with Claude Code 2.1.292 ([all tested versions](COMPATIBILITY.md)).

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

## Commands

- `/ctui` opens the ctui menu at once, even while Claude is replying. **Themes** lists `inherit` (the default, which follows your Claude Code theme) and every bundled theme by name, with a filter field: type to narrow the list, pick to switch. Esc goes back one level, and closes the menu at the top.
- **Plugins** in the same menu lists the sidebar sections in their order: `x` turns the focused one on or off, `k`/`j` move it up or down (saved a second after the last move), and Enter opens its settings.

If another command already holds `/ctui`, ctui says so in a toast once per session; change its settings in `/config` instead. Each section and the toasts also have a row in `/config`. Settings are saved to your user `settings.json`, so a change applies to every session.

## Task tools

The todo section shows Claude's task list. Claude Code gives Claude the Task tools (TaskCreate, TaskList, TaskUpdate) by default only on some models; Opus 5.x and Sonnet 5.x don't get them. So ctui turns them on for each session by setting `CLAUDE_CODE_ENABLE_TODO_TOOLS=1`, and subagents and anything the session starts inherit it. To turn this off, set **Task tools** to off under ctui in `/config`. ctui leaves the variable alone when you set it yourself, for example in the `env` block of `settings.json`.

## What ctui watches

ctui runs as a mod in every Claude Code session where the plugin is enabled. It watches Bash tool calls and subagent events to show background shells and agents, watches Claude's task tool calls, and runs them for Claude while the sidebar is docked, and reads the session's task list for the todo section, watches which skills and commands the chat invokes, and reads the skill and command lists and, after a resume, the transcript, for the skills section, runs `git` in the working directory for the sidebar header, reads the names of your MCP servers and the ones you turned off from `~/.claude.json` (or `$CLAUDE_CONFIG_DIR/.claude.json`), the `.mcp.json` files from the working directory up, your settings and the managed MCP settings, and which server a finished MCP tool call came from, to show where each server comes from (never a server's config, which can hold secrets), and, with the `inherit` theme and a custom Claude Code theme, reads that theme's file from `~/.claude/themes/` to tint the sidebar. It makes no network calls and sends nothing anywhere.

## Known differences

Some parts of the design renders are Claude Code's own and stay as Claude Code draws them: the sidebar's frame and close button, the prompt box, the permission-mode pill, the main background, and the rows of tools other than Read, Edit, Write and Bash. See [the full list](https://github.com/a1exk-dev/claude-tui/blob/main/docs/spec/v0.1.md#known-differences-from-the-renders).

## License

MIT. The Themes in `themes/` are generated from the built-in theme palettes of [Omarchy](https://github.com/basecamp/omarchy) 4.0.4, also MIT-licensed; both notices are in [LICENSE](LICENSE).
