# Configuring ctui

ctui's settings are rows under ctui in `/config`. `/plugin install` also lists them on its "Configure ctui" screen. Claude Code saves them in your user `settings.json`, under `pluginConfigs["ctui@claude-tui"].options`, so a change applies to every session. Each change reloads ctui, and the Sidebar redraws.

The Sidebar docks only in fullscreen (the `"tui": "fullscreen"` setting or `CLAUDE_CODE_NO_FLICKER=1`) in a terminal 110 or more columns wide. Otherwise ctui draws no Sidebar. The toasts, the transcript rows and the line under the prompt work on the main screen too.

## Sidebar plugins

The Sidebar shows its Sidebar plugins in this order. Each one has an `<id>_enable` setting, on by default. `/ctui:plugins:enable [plugin]` and `/ctui:plugins:disable [plugin]` write the same setting; with no name they open a list to pick from. The sections, between the header and the footer, can be folded by clicking `▾`. Their `<id>_folded` setting picks the fold each new session (and each `/clear`) starts from.

| Id | Shows | Settings (`/config` title) |
|---|---|---|
| `git` | Header: the path, the branch, ahead and behind, staged, modified, untracked and stashed counts, and lines changed. | `git_enable` (Git header) |
| `context` | The context window: a bar, the percent used, tokens used of the window, and the session's cost. | `context_enable` (Context section), `context_folded` (Context folded) |
| `limits` | The 5-hour and weekly usage limits, each with a bar, its percent and when it resets. Off a subscription it reads `no limits reported`. | `limits_enable` (Limits section), `limits_folded` (Limits folded) |
| `mcp` | MCP servers seen this session and the ones you turned off, with their state and tool count. | `mcp_enable` (MCP section), `mcp_folded` (MCP folded) |
| `todo` | Claude's task list. | `todo_enable` (Todo section), `todo_folded` (Todo folded), `todo_tools` (Task tools) |
| `agents` | "Agents & shells": running subagents, background shells and Workflow runs, with their elapsed time. | `agents_enable` (Agents & shells section), `agents_folded` (Agents & shells folded), `agents_toasts` (Agent and shell toasts) |
| `versions` | Footer: the ctui and Claude Code versions. | `versions_enable` (Versions footer) |

## Other settings

| Setting (`/config` title) | Default | What it does |
|---|---|---|
| `todo_tools` (Task tools) | on | Claude Code gives Claude the Task tools (TaskCreate, TaskList, TaskUpdate) by default only on some models; Opus 5.x and Sonnet 5.x don't get them. With this on, ctui sets `CLAUDE_CODE_ENABLE_TODO_TOOLS=1` for each session, and subagents and anything the session starts inherit it. ctui leaves the variable alone when you set it yourself, for example in the `env` block of `settings.json`. With it off, the Todo section reads `no task tools on this model` on such models. It is independent of `todo_enable`. |
| `agents_toasts` (Agent and shell toasts) | on | A one-line toast when a subagent, a background shell or a Workflow run starts, finishes or fails. In fullscreen it shows at the top right; on the main screen Claude Code shows it as `ctui: <text>` at the right of the line under the prompt. Toasts come at most one every 2 s. The Sidebar rows show either way. |
| `theme` (Sidebar theme) | `inherit` | `inherit` colors the Sidebar from your current Claude Code theme. It is the only option in 0.1. `/ctui:theme [theme]` writes it. To change ctui's colors, use a CLI theme as below. |

## Colors: an example CLI theme

ctui draws with Claude Code's theme colors, so it follows the theme you pick in `/theme`. To give it the colors of the ctui renders, save this as `~/.claude/themes/ctui-dark.json` and pick **ctui dark** in `/theme`, or set `"theme": "custom:ctui-dark"` in `settings.json`. It changes these colors for all of Claude Code, not only for ctui.

```json
{
  "name": "ctui dark",
  "base": "dark",
  "overrides": {
    "text": "#eeeeee",
    "success": "#7fd88f",
    "warning": "#f5a742",
    "error": "#e06c75",
    "suggestion": "#9d7cd8",
    "inactive": "#808080",
    "subtle": "#484848",
    "promptBorder": "#7fd88f",
    "userMessageBackground": "#141414",
    "composerSidebarBackground": "#141414"
  }
}
```

| Key | Where ctui uses it |
|---|---|
| `text` | The Sidebar's main text: the path, the branch, `↑N ↓N`, section titles, bar percents, the Limits labels, MCP names, the task in progress, agent names, the versions. |
| `success` | Git `+staged` and `+added` lines, a bar's fill below 60%, MCP `●`, a finished agent or shell `✓`. |
| `warning` | Git `!modified`, a bar's fill from 60% to 85%, MCP `!` and `◐`, the in-progress task `◐`, a running agent or shell `◐`, an interrupted tool row. |
| `error` | Git `-removed` lines, a bar's fill from 85%, MCP `✕`, a failed agent or shell `✗`, a failed tool row. |
| `suggestion` | Git `≡stashes`. |
| `inactive` | The `⎇`, Git `?untracked` and "lines changed", the fold arrows, section counts and folded summaries, tokens, cost and reset times, MCP `N tools` and `off`, done tasks and pending task text, agent details and elapsed times, `▸ N more` and `↑ more`/`↓ more`, the versions labels. |
| `subtle` | The empty `─` part of each bar, MCP `○`, the pending task `○`, the `│` in the versions footer. |
| `promptBorder` | The `┃` bar beside your prompts in the transcript. Claude Code also colors the prompt's `─` rules with it. |
| `userMessageBackground` | The panel behind your prompts in the transcript. |
| `composerSidebarBackground` | The Sidebar's background. Claude Code paints the dock with it, and only a theme picked in `/theme` sets it. |

`base` supplies every key the file leaves out. Keys outside this list (`claude`, `diffAdded`, ...) color the rest of Claude Code; add them to the same `overrides` if you want.

## Main background

Claude Code draws the transcript on your terminal's own background, and no theme key changes it. To match the renders, set your terminal's background to `#0a0a0a`:

**Ghostty**, `~/.config/ghostty/config`:

```ini
background = #0a0a0a
```

**Kitty**, `~/.config/kitty/kitty.conf`:

```ini
background #0a0a0a
```

**Alacritty**, `~/.config/alacritty/alacritty.toml`:

```toml
[colors.primary]
background = "#0a0a0a"
```

**WezTerm**, `~/.wezterm.lua`:

```lua
config.colors = { background = '#0a0a0a' }
```

**foot**, `~/.config/foot/foot.ini` (`[colors]` before foot 1.24):

```ini
[colors-dark]
background=0a0a0a
```

**iTerm2**: Settings → Profiles → Colors, click **Background** and enter `0a0a0a`.

**Windows Terminal**, `settings.json`, for every profile:

```json
{
  "profiles": {
    "defaults": {
      "background": "#0a0a0a"
    }
  }
}
```

## Known differences from the renders

Claude Code draws some parts itself, and the mods API can't reach others: the Sidebar's frame, the prompt box, the mode pill and a few tool rows. The full list is in [the build spec](spec/v0.1.md#known-differences-from-the-renders).
