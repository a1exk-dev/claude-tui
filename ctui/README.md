# ctui

ctui is a skin for the Claude Code terminal UI. It docks a sidebar beside the transcript with git, context, limits, MCP, todo, and agents-and-shells sections, and it restyles the lines under the prompt input. It also raises short toasts when a subagent or a background shell starts, finishes, or fails.

Tested with Claude Code 2.1.288 ([all tested versions](COMPATIBILITY.md)).

## Install

```text
/plugin marketplace add a1exk-dev/claude-tui
/plugin install ctui@claude-tui
```

## Commands

- `/ctui:theme [theme]` switches the sidebar theme. `inherit`, the default, follows your Claude Code theme.
- `/ctui:plugins:enable [plugin]` and `/ctui:plugins:disable [plugin]` turn a sidebar section on or off.

With no argument, each command opens a list to pick from. Each section and the toasts also have a row in `/config`. Settings are saved to your user `settings.json`, so a change applies to every session.

## Task tools

The todo section shows Claude's task list. Claude Code gives Claude the Task tools (TaskCreate, TaskList, TaskUpdate) by default only on some models; Opus 5.x and Sonnet 5.x don't get them. So ctui turns them on for each session by setting `CLAUDE_CODE_ENABLE_TODO_TOOLS=1`, and subagents and anything the session starts inherit it. To turn this off, set **Task tools** to off under ctui in `/config`. ctui leaves the variable alone when you set it yourself, for example in the `env` block of `settings.json`.

## What ctui watches

ctui runs as a mod in every Claude Code session where the plugin is enabled. It watches Bash tool calls and subagent events to show background shells and agents, watches Claude's task tool calls and reads the session's task list for the todo section, and runs `git` in the working directory for the sidebar header. It makes no network calls and sends nothing anywhere.

## License

MIT
