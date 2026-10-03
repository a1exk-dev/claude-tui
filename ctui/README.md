# ctui

ctui is a skin for the Claude Code terminal UI. It docks a sidebar beside the transcript with git, context, limits, MCP, todo, and agents-and-shells sections, and it restyles the lines under the prompt input. It also raises short toasts when a subagent or a background shell starts, finishes, or fails.

Tested with Claude Code 2.1.288.

## Install

```text
/plugin marketplace add a1exk-dev/claude-tui
/plugin install ctui@claude-tui
```

## Commands

- `/ctui:theme [theme]` switches the sidebar theme. `inherit`, the default, follows your Claude Code theme.
- `/ctui:plugins:enable [plugin]` and `/ctui:plugins:disable [plugin]` turn a sidebar section on or off.

With no argument, each command opens a list to pick from. Each section and the toasts also have a row in `/config`. Settings are saved to your user `settings.json`, so a change applies to every session.

## What ctui watches

ctui runs as a mod in every Claude Code session where the plugin is enabled. It watches Bash tool calls and subagent events to show background shells and agents, and it runs `git` in the working directory for the sidebar header. It makes no network calls and sends nothing anywhere.

## License

MIT
