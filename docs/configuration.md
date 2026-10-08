# Configuring ctui

ctui's settings are rows under ctui in `/config`. `/plugin install` also lists them on its "Configure ctui" screen. Claude Code saves them in your user `settings.json`, under `pluginConfigs["ctui@claude-tui"].options`, so a change applies to every session. Each change reloads ctui, and the Sidebar redraws.

The Sidebar docks only in fullscreen (the `"tui": "fullscreen"` setting or `CLAUDE_CODE_NO_FLICKER=1`) in a terminal 110 or more columns wide. Otherwise ctui draws no Sidebar. The toasts, the transcript rows and the line under the prompt work on the main screen too.

## Sidebar plugins

The Sidebar shows its Sidebar plugins in this order. Each one has an `<id>_enable` setting, on by default. `/ctui:plugins:enable [plugin]` and `/ctui:plugins:disable [plugin]` write the same setting; with no name they open a list to pick from. The sections, between the header and the footer, fold and unfold when you click anywhere on their title row: the `▼` or `▶`, the title and its `:`, the space between, or the count or folded summary at the right. Their `<id>_folded` setting picks the fold each new session (and each `/clear`) starts from.

| Id | Shows | Settings (`/config` title) |
|---|---|---|
| `git` | Header: the path, the branch, ahead and behind, staged, modified, untracked and stashed counts, and lines changed. | `git_enable` (Git header) |
| `context` | The context window: a bar, the percent used, and tokens used of the window. | `context_enable` (Context section), `context_folded` (Context folded) |
| `limits` | First a `cost` row: this month's cost against your monthly limit, as a bar and its percent with `62.00$ of 100$` under them. Then the 5-hour and weekly usage limits (or a gateway's `spend` limit), each with a bar, its percent and when it resets. On a Claude plan the cost row is hidden unless `limits_cost` is `on`. With neither, it reads `no limits reported`. Folded, it reads the cost in whole dollars, then each limit's percent: `62$ · 5h 34% · wk 81%`. | `limits_enable` (Limits section), `limits_folded` (Limits folded), `limits_cost` (Limits cost), `limits_cost_monthly` (Limits monthly cost) |
| `mcp` | MCP servers seen this session and the ones you turned off, with their state and tool count. | `mcp_enable` (MCP section), `mcp_folded` (MCP folded) |
| `todo` | Claude's task list. | `todo_enable` (Todo section), `todo_folded` (Todo folded), `todo_tools` (Task tools) |
| `agents` | "Agents & shells": running subagents, background shells and Workflow runs, with their elapsed time. | `agents_enable` (Agents & shells section), `agents_folded` (Agents & shells folded), `agents_toasts` (Agent and shell toasts) |
| `versions` | Footer: the ctui and Claude Code versions. | `versions_enable` (Versions footer) |

## Other settings

| Setting (`/config` title) | Default | What it does |
|---|---|---|
| `limits_cost` (Limits cost) | `auto` | Opens the Limits section with a `cost` row: this month's cost (see [The month's cost](#the-months-cost)) against `limits_cost_monthly`. `auto` hides it on a Claude plan (when Claude Code reports a 5-hour or weekly limit) and shows it everywhere else, behind a gateway too; `on` always shows it, `off` never does. When Claude Code reports no cost, there is no cost row. |
| `limits_cost_monthly` (Limits monthly cost) | 100 | The limit, in USD, the cost row measures against. Over it, the bar fills in the error color and the percent passes 100: `134%`, `134.00$ of 100$`. `0` means no limit: the bar stays empty, there is no percent, and the line under it reads the cost alone, `62.00$`. |
| `todo_tools` (Task tools) | on | Claude Code gives Claude the Task tools (TaskCreate, TaskList, TaskUpdate) by default only on some models; Opus 5.x and Sonnet 5.x don't get them. With this on, ctui sets `CLAUDE_CODE_ENABLE_TODO_TOOLS=1` for each session, and subagents and anything the session starts inherit it. ctui leaves the variable alone when you set it yourself, for example in the `env` block of `settings.json`. With it off, the Todo section reads `no task tools on this model` on such models. It is independent of `todo_enable`. |
| `agents_toasts` (Agent and shell toasts) | on | A one-line toast when a subagent, a background shell or a Workflow run starts, finishes or fails. In fullscreen it shows at the top right; on the main screen Claude Code shows it as `ctui: <text>` at the right of the line under the prompt. Toasts come at most one every 2 s. The Sidebar rows show either way. |
| `theme` (Sidebar theme) | `inherit` | `inherit` colors the Sidebar from your current Claude Code theme. When that theme is a custom one that sets no Sidebar background (such as Omarchy's), ctui paints the Sidebar body with the theme's background tinted 6% toward its text, and follows the theme file as it changes; Claude Code's frame around the Sidebar keeps its default color. The other options are the 22 bundled Themes, one per built-in Omarchy theme: `catppuccin`, `catppuccin-latte`, `ethereal`, `everforest`, `flexoki-light`, `gruvbox`, `hackerman`, `kanagawa`, `last-horizon`, `lumon`, `lupine`, `matte-black`, `miasma`, `nord`, `osaka-jade`, `retro-82`, `ristretto`, `rose-pine`, `solitude`, `tokyo-night`, `vantablack`, `white`. A Theme recolors the Sidebar's text and paints its body with the Theme's `composerSidebarBackground`; the rest of Claude Code keeps your `/theme`. Claude Code still draws the Sidebar's frame (the `│` rule, the `✕` row and the row below the body) in your `/theme`'s dock color, so a frame shows around the tint. `/ctui:theme [theme]` writes it. To change all of Claude Code's colors, pick the same Theme in `/theme` too, which also makes the frame match the body. Or use a CLI theme as below. |

## The month's cost

The Limits `cost` row adds up every Claude Code session on this computer since the 1st of the month at 00:00 local time, including sessions where ctui didn't run. Each session that has ended counts with the total Claude Code wrote into its transcript (`projects/*/*.jsonl` in `CLAUDE_CONFIG_DIR`, or `~/.claude`), and the session you're in counts with its live cost, as `/cost` shows it. A session counts whole in the month its transcript was last written, so one that runs past midnight on the 1st counts in the new month.

ctui reads the transcripts when a session starts, after `/clear` or `/resume`, and every minute, and only while the row shows. It keeps each session's total in its own store, so a total stays counted after Claude Code deletes old transcripts (after 30 days by default), and it drops last month's totals when the month turns. There's no price table and no network call. The row appears once the first read is done; when a read fails, it shows the totals already kept plus the live cost and tries again a minute later.

The total misses:

- sessions that were killed or crashed, which never write their total;
- `claude -p` and SDK runs, which never write one either;
- other sessions still running: each counts once it ends, runs `/clear` or switches with `/resume`.

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
| `success` | Git `+staged` and `+added` lines, a bar's fill below 50%, MCP `●`, a finished agent or shell `✓`. |
| `warning` | Git `!modified`, a bar's fill from 50% to 85%, MCP `!` and `◐`, the in-progress task `◐`, a running agent or shell `◐`, an interrupted tool row. |
| `error` | Git `-removed` lines, a bar's fill from 85%, MCP `✕`, a failed agent or shell `✗`, a failed tool row. |
| `suggestion` | Git `≡stashes`. |
| `inactive` | The Git glyphs leading the branch, changeset and lines-changed rows, Git `?untracked` and "lines changed", the fold arrows, section counts and folded summaries, tokens, cost and reset times, MCP `N tools` and `off`, done tasks and pending task text, agent details and elapsed times, `▸ N more` and `↑ more`/`↓ more`, the versions labels. |
| `subtle` | The `─` rules between Sidebar sections and the `═` rule under the git header, the empty `─` part of each bar, MCP `○`, the pending task `○`, the `│` in the versions footer. |
| `promptBorder` | The `┃` bar beside your prompts in the transcript. Claude Code also colors the prompt's `─` rules with it. |
| `userMessageBackground` | The panel behind your prompts in the transcript. |
| `composerSidebarBackground` | The Sidebar's background. Claude Code paints the dock with it, and only a theme picked in `/theme` sets it. |

`base` supplies every key the file leaves out. Keys outside this list (`claude`, `diffAdded`, ...) color the rest of Claude Code; add them to the same `overrides` if you want.

## Main background

Claude Code draws the transcript on your terminal's own background, and no theme key changes it. To match the renders, set your terminal's background to `#0a0a0a`.

With a ctui Theme, set the terminal to that Theme's background instead, for the glass look: the Sidebar's background is the Theme's background tinted slightly toward its text color, so it stands just off the transcript.

<!-- Generated by `node scripts/themes.ts`. -->

| Theme | Mode | Terminal background |
|---|---|---|
| `catppuccin` | dark | `#1e1e2e` |
| `catppuccin-latte` | light | `#eff1f5` |
| `ethereal` | dark | `#060b1e` |
| `everforest` | dark | `#2d353b` |
| `flexoki-light` | light | `#fffcf0` |
| `gruvbox` | dark | `#282828` |
| `hackerman` | dark | `#0b0c16` |
| `kanagawa` | dark | `#1f1f28` |
| `last-horizon` | dark | `#0c0b0c` |
| `lumon` | dark | `#16242d` |
| `lupine` | light | `#fafafa` |
| `matte-black` | dark | `#121212` |
| `miasma` | dark | `#222222` |
| `nord` | dark | `#2e3440` |
| `osaka-jade` | dark | `#111c18` |
| `retro-82` | dark | `#05182e` |
| `ristretto` | dark | `#2c2525` |
| `rose-pine` | light | `#faf4ed` |
| `solitude` | dark | `#101315` |
| `tokyo-night` | dark | `#1a1b26` |
| `vantablack` | dark | `#000000` |
| `white` | light | `#ffffff` |

<!-- End of generated table. -->

The snippets below use `#0a0a0a`; put the Theme's background in its place.

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
