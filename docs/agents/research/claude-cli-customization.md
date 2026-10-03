# Claude Code CLI customization surfaces, mapped to the opencode TUI

> Researched 2026-10-03. Installed Claude Code: **2.1.283** (`claude --version`). Latest in changelog: 2.1.288 (2026-10-02).
> opencode source: `github.com/anomalyco/opencode` (the old `sst/opencode` now redirects here), commit `907b3bc` (2026-10-02).
> Abbreviations:
> - `CC:` = `https://code.claude.com/docs/en/`
> - `d.ts` = [`anthropics/claude-code/mods/types/claude-code.d.ts`](https://github.com/anthropics/claude-code/blob/main/mods/types/claude-code.d.ts). Its header reads "Written by Claude Code 2.1.277" and "EARLY ACCESS: this surface may change" (lines 1-5).
> - `OC:` = opencode repo root.
> - `S` = `OC:packages/tui/src/routes/session/index.tsx`.
> - `P` = `OC:packages/tui/src/component/prompt/index.tsx`.

---

## 0. TL;DR

- **"Claude Mods" is real.** It shipped in **v2.1.287** on 2026-10-01: "Added Claude Mods: plugins may now modify deeper behavior" ([CC:changelog](https://code.claude.com/docs/en/changelog), 2.1.287 entry).
  - A mod is a plugin whose `hooks/hooks.json` names a JS/TS "hooks module" (`register.js`). That module subscribes to events, including `ui.render`, which lets it **restyle or replace parts of the native TUI** and draw new panes ([CC:plugins/mods/overview](https://code.claude.com/docs/en/plugins/mods/overview.md) L9-23, L119-158).
- **It is not CSS.** No doc page, no type declaration and no settings key accepts CSS files, selectors or stylesheets.
  - I grepped every downloaded `CC:` page and `d.ts` for `css`, `stylesheet` and `selector`. The only hits are unrelated: the WebFetch changelog entry, and the Desktop-only `Svg` element's sandboxed frame (`d.ts` 9612-9620).
  - What people may be calling "CSS" is a **CSS-like prop model**. Mods return element trees (`Box`, `Text`, …) whose props are Ink/Yoga flexbox props: `flexDirection`, `gap`, `padding`, `borderStyle`, `borderColor`, `backgroundColor`, `position: 'absolute'`, `display: 'none'`, and `hover` overrides (`d.ts` 611-740, 9681-9721).
  - "Selectors" are `ui.render` matchers such as `{ component: 'Spinner' }` ([CC:plugins/mods/interface](https://code.claude.com/docs/en/plugins/mods/interface.md) L186-188, L210-222).
- **Your installed 2.1.283 predates GA.** The binary already contains the hooks-module engine, but gates it for installed plugins behind the rollout flag `tengu_plugin_hooks_modules`. Its own error text says: "early access: set CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 in its environment to load them" (strings in `~/.local/share/mise/installs/claude/2.1.283/claude`).
  - The docs say mods need **v2.1.287+**, and that the env var is ignored from then on (CC:plugins/mods/overview L97, L111-113).
  - **Action: upgrade before building anything.**
- **What gets you closest to opencode:**
  1. A custom theme JSON (colors).
  2. `tui: "fullscreen"` (input fixed at bottom, mouse support, docked panes).
  3. A mod that docks a 42-column "sidebar" pane and restyles messages, tool rows, spinner, hint line and turn footer.
  4. A status line for the model/agent/usage row.
  5. `keybindings.json` for `ctrl+x` leader-style chords.
- **Biggest hard gaps:**
  - The prompt input box itself cannot be redrawn; only its border color can change.
  - The permission prompt is off limits.
  - There is no main-background, syntax or markdown color token.
  - There is no home-screen or logo render site.
  - A key cannot be bound to a mod command or slash command.
  - Redraws are throttled (10/s, 30/s on some sites), so animations stay slow.

---

## 1. What "Claude mod" actually is (verified)

| Fact | Source |
|---|---|
| Mod = plugin with `.claude-plugin/plugin.json` + `hooks/hooks.json` (`{"modules":["./register.js"]}`) + an ES-module hooks file exporting `register(on, options)` (.js/.mjs/.cjs/.jsx/.ts/.mts/.cts/.tsx) | [CC:plugins/mods/reference](https://code.claude.com/docs/en/plugins/mods/reference.md) L15-27; overview L121-134 |
| Handlers are middleware: `on(event, matcher?, async ($, e, next) => …)`; they can observe, rewrite (`next({...e, props})`) or answer (return a tree, skip `next`) | reference L29-42; overview L174-182 |
| Introduced: 2.1.287, on by default; built-in mods include `/diff`, agents-md, telemetry, sec-default, you-should-know | changelog 2.1.287; overview L95-113, L220-235 |
| Built-in mod sources are public: `anthropics/claude-code/mods/{diff,agents-md,sec-default,telemetry,types}` | `gh api repos/anthropics/claude-code/contents/mods` (listed: agents-md, diff, sec-default, telemetry, types); overview L237-244 |
| Samples: `anthropics/claude-code-playground/claude-code/mods/{token-weather,blast-radius,replay-theater}` | overview L50-62; verified via `gh api` |
| Dev loop: `claude --plugin-dir ./my-mod` reloads the hooks module on save; `/reload-plugins`; `claude plugin validate` lists hooks and calls; `claude plugin test` | reference L278-288 |
| Claude can write a mod for you into `~/.claude/dev-mods/<session-id>/`, with per-session hot reload | [CC:plugins/mods/create](https://code.claude.com/docs/en/plugins/mods/create.md) L28-55 |
| Where drawings show: terminal CLI and Desktop Code tab. Not in VS Code chat, `-p`/SDK or cloud | overview L186-200 |
| Security: mods are unsandboxed and run with your permissions. They **cannot restyle the permission prompt** | overview L64-83; interface L292 |
| Kill switches: `disableAllHooks`, `--safe-mode`, managed `allowManagedModsOnly` | overview L95-107; reference L260-276 |

Your existing note `docs/agents/research/claude-mods.md` §2.4 describes mods consistently with these docs. Its header date ("2025-10-03") looks like a typo for 2026.

### 1.1 Native render sites ("which native items are styleable")

The full list is `RenderComponent` (`d.ts` 7459) and the reference table (CC:plugins/mods/reference L188-216). Prop types are at `d.ts` 7835-8380.

| Site | What it is | Editable props | Surface |
|---|---|---|---|
| `UserMessage` | your prompt row in the transcript | `text` (rewrite); `origin`, `isExpanded`, `task`, `from` read-only | terminal, desktop (`d.ts` 7867) |
| `AssistantMessage` | one text block of a reply | `text`, `isFirstOfReply` | 7919 |
| `ToolUse` / `ToolResult` / `ToolGroup` | tool row, its result, the folded "Read 3 files" line | `tool`, `input`, `isRunning`, `isErrored`, `output`; ToolGroup `isExpanded` | 7944 / 8003 / 8046 |
| `CommandOutput` | slash-command output row | `text` | 8083 |
| `AskUserQuestion` | question dialog; your tree must contain the engine ref exactly once | `questions` | 7841; interface L292 |
| `Spinner` | the animated working line | `word`, `message`, `suffix`, `mode` | terminal only per `d.ts` 8158 (the docs table says terminal+desktop) |
| `ToolProgress` | "(ctrl+b to run in background)" pill | `hint` | terminal (8127) |
| `TurnDuration` | "Baked for 3s" closing line | `word`, `durationMs` | terminal (8187) |
| `InfoNotice` | dim status lines under the logo | `text`, `command` | terminal (8213) |
| `SessionMode` | mode labels at the right of the footer | `modes[]` | 8242 |
| `PromptHint` | hint line under the prompt ("? for shortcuts", "esc to interrupt") | `hint` | terminal (8257) |
| `AbovePrompt` | empty band above the input, owned by mods | (draw a tree) | 8285 |
| `Pane` | mod-opened framed region: **docked beside the transcript in fullscreen from 110 columns**, otherwise inline above the prompt | (draw a tree) | 8338-8380 |

**Not render sites:**
- The prompt input box.
- The startup logo/welcome header (only the `InfoNotice` lines under it).
- The permission prompt.
- The status line row (that is the `statusLine` command).
- Pickers/dialogs (`/model`, `/theme`, `/resume`).
- The todo list.
- The footer badges.

None of these appear in `RenderComponent` (`d.ts` 7459).

### 1.2 Elements and "style" properties

From CC:plugins/mods/reference L218-237, interface L415-432, and `d.ts` 611-740 and 9681-9721.

**`Box`**
- Layout: `flexDirection`, `flexGrow`, `flexShrink`, `flexWrap`, `alignItems`, `alignSelf`, `justifyContent`, `gap`, `columnGap`, `rowGap`.
- Size: `width`, `height`, `minWidth`, `minHeight` (number or string).
- Spacing: `margin*`, `padding*`.
- Border and fill: `borderStyle` (e.g. `'round'`, see CC:plugins/mods/gallery L203-233), `borderColor`, `borderDimColor`, `backgroundColor`.
- Other: `overflow`, `display: 'flex'|'none'`, `position: 'relative'|'absolute'` with `top/left/right/bottom`, and `hover`.
- **No per-side border props** (`borderTop`, `borderLeft`, …). I grepped `d.ts` and found none. opencode's signature one-sided `┃` bar therefore has to be faked with a 1-column `Text`.

**`Text`**
- `color`, `backgroundColor`, `bold`, `italic`, `underline`, `strikethrough`, `dimColor`, `inverse`, `wrap`, `hover`.
- "Colors are a theme key or a raw color" (`d.ts` 9702-9703; interface L420). Using theme keys, such as `color: 'claude'`, keeps a mod in sync with your theme JSON.

**Other elements**
- `Button` (hotkey, `action` bound to a keybinding action), `Link`, `Code` (including diffs), `Markdown` (10k characters), `Input`, `Select`.
- `Raster`: a 24-bit color cell grid up to 512×256, with `$.ui.blit` for fast repaint. Terminal only.
- `Image`: terminal only.
- `Client`: a separate animation/pointer module.
- `Svg`: Desktop only.

**Invalid trees** fall back to the engine's own drawing. A `--plugin-dir` session logs `ui.render (X) refused: …` (interface L430-432).

**Redraw limits** (reference L239-258):
- `$.ui.invalidate('ui.render')` is throttled to **10/s**.
- In the terminal it is **30/s** for the visible pane, the expanded band and the hint line.
- A hook may run for at most 10 s.

**State:**
- Module variables are lost on reload.
- `$.state` is reactive and lasts the session.
- `$.store` is 4 MiB of JSON in `~/.claude/plugins/store/`, shared across sessions (interface L696-760).

**Useful API** (reference L160-186):
- `$.session.usage()` returns `{context:{tokens,window,percent}, rateLimits, cost}`.
- `$.session.model()`, `$.session.cwd()`, `$.session.repo()`.
- `$.ui.open/close/toast/status`. `status` pins one line under the prompt (`d.ts` 2142-2153).
- `$.command.register/list/run`, `$.clock.every`, `$.process.run`, `$.fs.*`.

---

## 2. Every other customization surface

| Surface | What it controls | Location / reload | Source |
|---|---|---|---|
| **Theme** | color tokens over a base preset (`dark`, `light`, `*-daltonized`, `*-ansi`) | `~/.claude/themes/<slug>.json` selected as `"theme": "custom:<slug>"`; **live reload** on file change; plugins ship `themes/*.json` | [CC:terminal-config#create-a-custom-theme](https://code.claude.com/docs/en/terminal-config.md) L141-170; [CC:settings-reference#theme](https://code.claude.com/docs/en/settings-reference.md) L3617-3640; [CC:plugins/components](https://code.claude.com/docs/en/plugins/components.md) L923-951 |
| Theme value syntax | `#rrggbb`, `#rgb`, `rgb(r,g,b)`, `ansi256(n)`, `ansi:<name>`; unknown tokens ignored | — | terminal-config L153 |
| Theme tokens | `claude`, `text`, `inverseText`, `inactive`, `subtle`, `suggestion`, `permission`, `remember`, `success`, `error`, `warning`, `merged`, `promptBorder`, `planMode`, `autoAccept`, `bashBorder`, `ide`, `fastMode`, `effortUltra`, `diffAdded/Removed(+Dimmed, +Word)`, `userMessageBackground(+Hover)`, `bashMessageBackgroundColor`, `memoryBackgroundColor`, `selectionBg`, `rate_limit_fill/empty`, `briefLabelYou/Claude`, `*Shimmer`, `<color>_FOR_SUBAGENTS_ONLY`, `rainbow_*` | — | terminal-config L172-277. Your `~/.claude/themes/omarchy.json` already uses most of them |
| **Renderer** | `tui: "fullscreen"` gives an alt-screen with the input fixed at the bottom, mouse, virtual scroll and docked panes | `/tui fullscreen`, `CLAUDE_CODE_NO_FLICKER=1` | settings-reference L3692-3710; [CC:fullscreen](https://code.claude.com/docs/en/fullscreen.md) L75-90 |
| `viewMode` | `default` / `verbose` / `focus` (focus = last prompt, one-line tool summary, final answer) | settings, `/focus` | settings-reference `viewMode` section |
| **Status line** | arbitrary script output **below the prompt**; multi-line, ANSI colors, OSC 8 links; JSON session data on stdin; `padding`, `refreshInterval`, `hideVimModeIndicator` | `statusLine` in settings; `/statusline` | [CC:statusline](https://code.claude.com/docs/en/statusline.md) L42-71, L135-166 |
| `subagentStatusLine` | rewrite the per-subagent rows under the prompt | settings | statusline L1118-1140 |
| **Keybindings** | rebind actions per context; chords (`ctrl+x ctrl+k`, 3 s timeout); unbind with `null`; live reload | `~/.claude/keybindings.json`, `/keybindings` | [CC:keybindings](https://code.claude.com/docs/en/keybindings.md) L9-73, L490-500, L592-606 |
| Spinner | `spinnerVerbs` (append or replace), `spinnerTipsEnabled`, `spinnerTipsOverride` (custom tips, label prefix, `excludeDefault`), `prefersReducedMotion` | settings | settings-reference L3423-3522, L3308 |
| Misc UI keys | `maxProseWidth`, `showTurnDuration`, `timeFormat`, `timeZone`, `syntaxHighlightingDisabled`, `footerLinksRegexes` (footer badges), `terminalTitleFromRename`, `terminalProgressBarEnabled`, `autoScrollEnabled`, `editorMode: vim`, `emojiCompletionEnabled`, `promptSuggestionEnabled`, `companyAnnouncements` | settings | settings-reference L3050-3830 |
| `/color` | prompt bar color for the current session (8 named colors) | slash command | [CC:commands](https://code.claude.com/docs/en/commands.md) L72 |
| Env vars | `CLAUDE_CODE_HIDE_CWD` (logo), `CLAUDE_CODE_DISABLE_MOUSE`, `CLAUDE_CODE_SCROLL_SPEED`, `CLAUDE_CODE_DISABLE_VIRTUAL_SCROLL`, `CLAUDE_CODE_DISABLE_TERMINAL_TITLE`, `CLAUDE_CODE_TMUX_TRUECOLOR`, `CLAUDE_CODE_FORCE_SYNC_OUTPUT`, `CLAUDE_CODE_ACCESSIBILITY` | env or `env` in settings | [CC:env-vars](https://code.claude.com/docs/en/env-vars.md) L204-397 |
| Output styles | change Claude's *text* (tone and format), not the chrome | `/output-style`, `outputStyle` | [CC:output-styles](https://code.claude.com/docs/en/output-styles.md) |
| Settings hooks, skills, slash commands, MCP | behavior only; **cannot draw** | — | overview L206-218 (comparison table) |

---

## 3. opencode TUI: distinctive elements (primary source)

Verified by spot-check: sidebar width 42 and the 120-column auto-show (`OC:packages/tui/src/routes/session/sidebar.tsx:28-37`, `S:270-278`), the `┃` SplitBorder (`OC:packages/tui/src/ui/border.ts:15-21`), and the leader key `ctrl+x` (`OC:packages/tui/src/config/keybind.ts:41`). The remaining citations come from a full read of the TUI source.

**Layout**
1. **Home screen** (`OC:packages/tui/src/routes/home.tsx:70-94`):
   - Vertically centered block-letter "open|code" logo, in two tones with half-block shadow cells (`OC:packages/tui/src/component/logo.tsx:9-57`).
   - Prompt at most 75 columns wide.
   - `● Tip` line in `warning` (`OC:packages/tui/src/feature-plugins/home/tips-view.tsx:150-161`).
   - Footer: `dir:branch`, `⊙ N MCP`, version.
2. **Session screen**:
   - Main column padded 2 on each side. **No header** (`S:1175-1360`).
   - **Right sidebar, 42 columns** on `backgroundPanel`. It shows automatically above 120 columns, toggles with `<leader>b`, and becomes an overlay on a scrim when narrow (`S:270-278, 1338-1357`).
   - Sidebar sections: title, **Context** (`N tokens`, `N% used`, `$X spent`), **MCP**, **LSP**, **Todo**, **Modified Files** (`+N`/`-N`), and a footer with `• OpenCode <ver>` (`OC:packages/tui/src/feature-plugins/sidebar/*.tsx`).

**Prompt**
3. **Prompt box** (`P:1348-1513`):
   - Left `┃` bar in the **current agent's color**. It turns `border` grey while the leader key is pending.
   - Filled `backgroundElement`, a `╹` foot, and a `▀` half-block "shadow" bottom cap.
   - Inside the box, a meta row: `Build · model provider · variant` (`P:1445-1476`).
   - Placeholder `Ask anything… "Fix a TODO in the codebase"`.
4. **Hint line under the prompt**:
   - While working: Knight-Rider `■⬝` scanner at 40 ms per frame in the agent color, plus `esc interrupt`.
   - While idle: cwd on the left, and `tokens (pct%) · $cost` and `ctrl+p commands` on the right (`P:1524-1683`; `OC:packages/tui/src/ui/spinner.ts:246-324`).

**Messages**
5. **User message**: `┃` bar in the agent color on `backgroundPanel`, padding 1/2 (`S:1397-1462`).
6. **Assistant message**:
   - Borderless markdown indented 3.
   - Closed by `▣ Build · model · 12.3s` (`S:1556-1580, 1686-1704`).
   - Reasoning collapses to `+ Thought: title · 3.2s` in faded warning (`S:1592-1684`).
7. **Tool rows**:
   - Inline, single-line rows with glyphs: `$` bash, `→` read, `←` write/edit, `✱` glob/grep, `%` fetch, `◈` websearch, `⚙` other (`S:1840-2577`).
   - Block tools sit on `backgroundPanel`.
   - Diffs are **split above 120 columns**, unified otherwise (`S:1999-2045, 2395-2430`).

**Theme**
8. **Theme keys** (`OC:packages/tui/src/theme/index.ts:36-90`):
   - Core: primary/secondary/accent/error/warning/success/info, text/textMuted.
   - Backgrounds: **background/backgroundPanel/backgroundElement/backgroundMenu**.
   - Borders: border/borderActive/borderSubtle.
   - About 13 diff keys, 14 markdown keys and 9 syntax keys, plus `thinkingOpacity`.
   - Values can be `{dark,light}`, ANSI numbers or `"transparent"`.
   - Themes load from `~/.config/opencode/themes/` and `.opencode/themes/` (`OC:packages/web/src/content/docs/themes.mdx:81-138`).
9. **Default `opencode` dark palette** (`OC:packages/tui/src/theme/assets/opencode.json`):

   | Key | Value |
   |---|---|
   | background | `#0a0a0a` |
   | panel | `#141414` |
   | element | `#1e1e1e` |
   | primary | `#fab283` |
   | secondary | `#5c9cf5` |
   | accent | `#9d7cd8` |
   | error | `#e06c75` |
   | warning | `#f5a742` |
   | success | `#7fd88f` |
   | info | `#56b6c2` |
   | text | `#eeeeee` |
   | textMuted | `#808080` |
   | border | `#484848` |
   | diffAddedBg | `#20303b` |
   | diffRemovedBg | `#37222c` |

**Interaction**
10. **Keys**:
    - Leader `ctrl+x` with a 2 s timeout.
    - `ctrl+p` command palette.
    - `<leader>` plus `n` (new session), `l` (session list), `m` (models), `a` (agents), `t` (themes), `b` (sidebar), `u`/`r` (undo/redo), `c` (compact).
    - `tab`/`shift+tab` cycle agents.
    - Source: `OC:packages/tui/src/config/keybind.ts:41-229`; `OC:packages/web/src/content/docs/keybinds.mdx:190-202`.
11. **Dialogs**:
    - Centered modal on a dark scrim, widths 60/88/116, fuzzy `Search`.
    - The selected row is a full-width `primary` background, with `esc` shown in the corner (`OC:packages/tui/src/ui/dialog.tsx:22-62`, `OC:packages/tui/src/ui/dialog-select.tsx:557-765`).
12. **Toasts**: top-right, with `┃` bars on both sides (`OC:packages/tui/src/ui/toast.tsx:20-57`).
13. **Permission prompt**: replaces the prompt area. `┃` warning bar, `△ Permission required`, and buttons `Allow once` / `Allow always` / `Reject` (`OC:packages/tui/src/routes/session/permission.tsx:388-711`).

---

## 4. Mapping: opencode element → Claude Code mechanism

Legend: **Full** = indistinguishable or close; **Partial** = approximation; **No** = not possible with supported surfaces.

| # | opencode element | Fit | Claude Code mechanism |
|---|---|---|---|
| 1 | Palette (primary peach, muted greys, status colors) | **Full** for accents | Theme JSON (§5.1). The token roles differ (`claude` ≈ primary, `inactive` ≈ textMuted, `subtle` ≈ border) |
| 2 | Three-step dark backgrounds (`#0a0a0a`/`#141414`/`#1e1e1e`) | **Partial** | No main-background token exists (terminal-config L172-277 lists none), so set `#0a0a0a` as the **terminal emulator** background. Panel tones come from `userMessageBackground`, `bashMessageBackgroundColor` and `memoryBackgroundColor`, plus `Box backgroundColor` inside mod trees |
| 3 | Fixed bottom input, scrollable transcript, mouse | **Full** | `"tui": "fullscreen"` (fullscreen L75-90) |
| 4 | Right sidebar (42 columns: Context/MCP/LSP/Todo/Modified Files) | **Partial** | Mod `Pane`, docked beside the transcript in fullscreen at ≥110 columns (`d.ts` 8338-8380). Auto-opening without user action needs ≥144 columns (≥110 after the user has opened it once) (interface L332-339). Context and cost come from `$.session.usage()`. Modified files come from tracking `tool.call` for Edit/Write. **LSP status and Claude's todo list have no documented read API**, so those sections are unverified or no-go. MCP is **partial**: a mod sees which servers have tools (and how many), and a hidden second `claude` process can report full status; see [claude-mcp-status-access.md](claude-mcp-status-access.md). The pane's frame and tabs are Claude's own (§6) |
| 5 | Sidebar toggle `<leader>b` | **Partial** | A mod slash command (`/sidebar`) that calls `$.ui.open/close`. No documented way exists to bind a key to it (§6). `Ctrl+X X` closes a focused pane natively (interface L504-517) |
| 6 | Prompt box: left `┃` bar, filled background, `▀` cap | **No** | The prompt input is not a render site. Only its border color can change (`promptBorder`, `bashBorder`, `/color`) |
| 7 | Prompt border colored by current agent/mode | **Partial** | Claude already tints for modes: `planMode`, `autoAccept`, `bashBorder` (terminal-config tokens). Set them to opencode's agent colors |
| 8 | Meta row `Build · model provider` | **Partial** | It cannot go *inside* the box. Options: the `statusLine` script below the prompt (statusline L135-166), the `AbovePrompt` band (`d.ts` 8285), or `$.ui.status` |
| 9 | Hint line `esc interrupt` / `ctrl+p commands` / cwd / tokens·cost | **Full** (text), **Partial** (layout) | `ui.render` on `PromptHint`: rewrite `hint` or return a tree (`d.ts` 8257-8284). This site redraws at up to 30/s (reference L254) |
| 10 | Knight-Rider `■⬝` scanner | **Partial** | Replace `Spinner` with your own `Text` and animate with `$.clock.every` + `invalidate`. The Spinner site is capped at **10 fps** against opencode's 25 fps (reference L254) |
| 11 | User message `┃` bar on panel background | **Partial** | `ui.render` `{component:'UserMessage'}` returns a `Box` row: a 1-column `Text` of `┃` (one per wrapped line) plus a `Box backgroundColor` body (§5.3). There are no per-side borders, so the bar height must be computed. Alternatively, just set `userMessageBackground` |
| 12 | Borderless assistant text, indent 3 | **Partial** | `ui.render` `AssistantMessage`: wrap the engine ref (`await next(e)`) in `Box({paddingLeft: 3})`. Removing Claude's `⏺` bullet means redrawing with `Markdown({text})`, which loses the engine's markdown styling. Untested |
| 13 | `▣ Build · model · 12.3s` turn footer | **Full** | `ui.render` `TurnDuration` (`word`, `durationMs`) plus `$.session.model()` (§5.3). Terminal only |
| 14 | Inline tool rows with glyphs (`→ Read`, `$ cmd`, `← Edit`) | **Partial** | `ui.render` `ToolUse` has `tool`, `input`, `isRunning`, `isErrored`, so return a one-line `Text`. `ToolGroup.isExpanded` controls folding. The result body is a separate `ToolResult` site |
| 15 | Split diff above 120 columns | **No / Partial** | No setting for split diffs. A mod could draw its own diff in a pane with `Code`. The built-in `/diff` pane is itself a mod (overview L229) |
| 16 | Thinking `+ Thought: … · 3.2s` | **No** (unverified) | No thinking/reasoning render site in `RenderComponent` |
| 17 | Home screen (centered logo, tips, footer) | **No** | No logo or home render site. Only `InfoNotice` lines and `CLAUDE_CODE_HIDE_CWD`. Tips: `spinnerTipsOverride` with `label: "● Tip"` puts tips in the spinner, not on the home screen |
| 18 | Theme JSON with `{dark,light}`, markdown and syntax keys | **Partial** | One base plus overrides per file. No markdown or syntax tokens; syntax highlighting can only be toggled. Use two files (dark and light) and `"theme"` per machine |
| 19 | Leader key `ctrl+x` + chords | **Partial** | Chords are supported (keybindings L490-500), and many defaults already use `Ctrl+X …`. Built-in actions can be rebound to `ctrl+x <key>`, but there is no action for "open session list", "theme picker" or arbitrary slash commands (action list in keybindings L74-445) |
| 20 | `ctrl+p` command palette, fuzzy dialogs | **Partial** | A mod pane with `Input` + list from `$.command.list()` → `$.command.run()` (reference L168). Opened by a slash command, not `ctrl+p` (`chat:modelPicker` is `Meta+P`). Modal centering and scrim: **No** |
| 21 | Model/agent pickers | **Partial** | Native `/model` (`chat:modelPicker`). Shift+Tab cycles permission modes ≈ opencode's Tab agent cycle; rebinding `chat:cycleMode` to `tab` is not advised, since Tab is autocomplete |
| 22 | Toast top-right with `┃` bars | **Partial** | `$.ui.toast(text)` exists. Position and style are Claude's |
| 23 | Permission prompt styling | **No** | Explicitly not restylable (overview L83; interface L292). Its border color follows the `permission` token |
| 24 | Mode labels / footer items | **Full** | `SessionMode` (`modes[]` rewrite) and `footerLinksRegexes` |
| 25 | Subagent rows | **Partial** | `subagentStatusLine` (statusline L1118) and `<color>_FOR_SUBAGENTS_ONLY` tokens |
| 26 | Scroll keys (half page and so on) | **Full** | `Scroll` context actions `scroll:halfPageUp/Down`, `scroll:top/bottom` (keybindings L430-445) |
| 27 | Hidden scrollbar, sidebar overlay scrim, dialog widths | **No** | No surface |

---

## 5. Concrete snippets

### 5.1 `~/.claude/themes/opencode.json`

The hex values come from `OC:packages/tui/src/theme/assets/opencode.json`. The token *names* come from CC:terminal-config L172-277. The role pairing is my judgement, not a 1:1 spec.

```json
{
  "name": "opencode",
  "base": "dark",
  "overrides": {
    "claude": "#fab283",
    "claudeShimmer": "#fcc9a6",
    "text": "#eeeeee",
    "inverseText": "#0a0a0a",
    "inactive": "#808080",
    "subtle": "#484848",
    "suggestion": "#5c9cf5",
    "permission": "#f5a742",
    "remember": "#9d7cd8",
    "success": "#7fd88f",
    "error": "#e06c75",
    "warning": "#f5a742",
    "promptBorder": "#5c9cf5",
    "planMode": "#9d7cd8",
    "autoAccept": "#7fd88f",
    "bashBorder": "#fab283",
    "ide": "#56b6c2",
    "diffAdded": "#20303b",
    "diffRemoved": "#37222c",
    "userMessageBackground": "#141414",
    "userMessageBackgroundHover": "#1e1e1e",
    "bashMessageBackgroundColor": "#141414",
    "memoryBackgroundColor": "#141414",
    "selectionBg": "#303030"
  }
}
```

Notes on this theme:
- Activate it with `"theme": "custom:opencode"`. It live-reloads (terminal-config L170).
- Set the terminal background to `#0a0a0a`.
- `promptBorder` = `secondary`, assuming opencode's first agent ("build") gets `secondary`. opencode cycles agent colors starting from `secondary` (`OC:packages/tui/src/context/local.tsx:83-131`); which agent is first is unverified.
- `claudeShimmer` and `selectionBg` are my own picks; they are not in opencode.
- `permission` = `warning`, because opencode draws its permission bar in `warning`.

### 5.2 Settings (`~/.claude/settings.json` fragment)

```json
{
  "theme": "custom:opencode",
  "tui": "fullscreen",
  "showTurnDuration": true,
  "spinnerTipsOverride": { "label": "● Tip", "excludeDefault": false, "tips": [] },
  "statusLine": { "type": "command", "command": "~/.claude/opencode-status.sh", "refreshInterval": 5 }
}
```

You currently use `claude-hud` as your status line (`~/.claude/settings.json`), so choose between that and an opencode-style line, or merge them. The status line only reads JSON from stdin and prints text (statusline L135-166). The `spinnerTipsOverride` fields (`label`, `tips`, `tipsFile`, `excludeDefault`) are documented in settings-reference L3439-3480.

### 5.3 Mod sketch: `opencode-skin`

This sketch has **not been run**. Every API it uses is documented, but layout details (bar height, theme-key colors in `Text`) need testing against 2.1.287+.

```
opencode-skin/.claude-plugin/plugin.json   {"name":"opencode-skin","version":"0.1.0"}
opencode-skin/hooks/hooks.json             {"modules":["./register.js"]}
```

```javascript
// opencode-skin/hooks/register.js
const GLYPH = { Bash: '$', Read: '→', Write: '←', Edit: '←', Glob: '✱', Grep: '✱', WebFetch: '%', WebSearch: '◈' }
const touched = new Map() // file -> edit count, for the sidebar's "Modified Files"
let sidebarOpen = false

export function register(on) {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'sidebar', description: 'Toggle opencode-style sidebar', immediate: true })
    return next(e)
  })

  on('command.run', { command: 'sidebar' }, async ($) => {
    sidebarOpen = !sidebarOpen
    if (sidebarOpen) await $.ui.open({ id: 'oc-sidebar', title: 'Session', columns: 42 })
    else await $.ui.close({ id: 'oc-sidebar' })
    return {}
  })

  on('tool.call', async ($, e, next) => {
    if ((e.tool === 'Edit' || e.tool === 'Write') && e.file_path) {
      touched.set(e.file_path, (touched.get(e.file_path) ?? 0) + 1)
      $.ui.invalidate('ui.render')
    }
    return next(e)
  })

  // Sidebar body: Context section + Modified Files
  on('ui.render', { component: 'Pane' }, async ($, e, next) => {
    if (e.requestId !== 'oc-sidebar') return next(e)
    const { Box, Text } = $.ui.resolve(e)
    const u = await $.session.usage()
    const files = [...touched.keys()].map((f) => Text({ color: 'inactive', wrap: 'truncate-start', children: [f] }))
    return Box({ flexDirection: 'column', paddingX: 1, rowGap: 1, children: [
      Box({ flexDirection: 'column', children: [
        Text({ bold: true, children: ['Context'] }),
        Text({ color: 'inactive', children: [`${u.context.tokens.toLocaleString()} tokens`] }),
        Text({ color: 'inactive', children: [`${Math.round(u.context.percent)}% used`] }),
      ]}),
      Box({ flexDirection: 'column', children: [Text({ bold: true, children: ['Modified Files'] }), ...files] }),
    ]})
  })

  // Inline tool rows: "→ Read src/foo.ts"
  on('ui.render', { component: 'ToolUse' }, async ($, e, next) => {
    const g = GLYPH[e.props.tool]
    if (!g || e.props.isErrored) return next(e)
    const { Text } = $.ui.resolve(e)
    const arg = e.props.input?.file_path ?? e.props.input?.command ?? e.props.input?.pattern ?? ''
    return Text({ color: 'inactive', wrap: 'truncate-end', children: [`   ${g} ${e.props.tool} ${arg}`] })
  })

  // User message: ┃ bar + panel background
  on('ui.render', { component: 'UserMessage' }, async ($, e, next) => {
    if (!e.props.isExpanded && e.props.origin?.kind !== 'prompt') return next(e)
    const { Box, Text } = $.ui.resolve(e)
    const cols = (e.viewport?.columns ?? 80) - 6
    const lines = Math.max(1, e.props.text.split('\n').reduce((n, l) => n + Math.ceil((l.length || 1) / cols), 0)) + 2
    return Box({ flexDirection: 'row', children: [
      Text({ color: 'promptBorder', children: [Array(lines).fill('┃').join('\n')] }),
      Box({ flexGrow: 1, backgroundColor: 'userMessageBackground', paddingX: 2, paddingY: 1,
            children: [Text({ children: [e.props.text] })] }),
    ]})
  })

  // "▣ Build · model · 12.3s"
  on('ui.render', { component: 'TurnDuration' }, async ($, e) => {
    const { Text } = $.ui.resolve(e)
    const model = await $.session.model()
    return Text({ children: [
      Text({ color: 'promptBorder', children: ['▣ '] }),
      Text({ children: ['Build'] }),
      Text({ color: 'inactive', children: [` · ${model?.id ?? model} · ${(e.props.durationMs / 1000).toFixed(1)}s`] }),
    ]})
  })

  // Hint line: "esc interrupt" / "ctrl+p commands" wording
  on('ui.render', { component: 'PromptHint' }, async ($, e, next) =>
    next({ ...e, props: { ...e.props, hint: e.props.isWorking ? 'esc interrupt' : e.props.hint } }))
}
```

Caveats, each tied to a source:
- `UserMessage.origin` is a `PromptOrigin` union (`d.ts` 7867-7918); I guessed the `kind: 'prompt'` value, so check it in the types for your build (`/plugin-types`).
- The `$.session.model()` return shape is not checked.
- Theme-key strings in `color` and `backgroundColor` are allowed per `d.ts` 9702-9703.
- Docking requires fullscreen and ≥110 columns (`d.ts` 8338-8380).
- Run with `claude --plugin-dir ./opencode-skin`, then `claude plugin validate ./opencode-skin` (reference L278-288).

---

## 6. Gaps and open questions

**Confirmed gaps**
1. **There is no CSS.** If someone told you "native items via CSS", the closest true statement is Ink flexbox props in mod trees. I found no stylesheet file, selector language or `customCss` key in the docs or the 2.1.283 binary (`strings | grep customCss` returned 0).
2. **Prompt input box.** Its shape, fill, padding and in-box meta row cannot be changed. Only the border color can (`RenderComponent`, `d.ts` 7459).
3. **Permission prompt** is off limits (overview L83).
4. **Main background, markdown colors and syntax colors** have no tokens (terminal-config L172-277).
5. **Home and logo screen** has no render site.
6. **Mod commands cannot be bound to keys.**
   - Keybinding actions are a fixed list with no "run command" action (keybindings L74-445).
   - Mods never read the keyboard; only focused panes or bands get hotkeys (interface L488-519).
   - A `Button`'s `action` maps *a built-in action's binding* onto that button (reference L237). That is the only key → mod bridge, and it only works while the button is drawn.
7. **Animation rate** is capped at 10/s, or 30/s on pane, band and hint (reference L254).
8. **Pane chrome.** Claude draws the frame and tabs itself. Tree width is `e.props.bodyColumns`, and `columns` is only a request (interface L312-321). Whether a docked pane can be borderless the way opencode's sidebar is remains unverified.

**Open questions (unverified)**
- *(MCP part answered in [claude-mcp-status-access.md](claude-mcp-status-access.md): no direct read API; tool-presence plus a second-process status check is the workaround.)*
- Is there a mods API to read **MCP/LSP status** or **Claude's todo list** for a sidebar? `$.mcp` only exposes `call` and `connect` (reference L184). `$.session.messages()` could reconstruct todos from `TodoWrite` tool calls; untested.
- Does the `Spinner` site render on Desktop? The docs table says yes, `d.ts` 8158 says terminal only. This is irrelevant for the CLI.
- Can a mod hide Claude's `⏺` assistant bullet while keeping the engine's markdown renderer? The `next(e)` ref can only be wrapped, not modified internally.
- The behavior of `UserMessage` rewrites when collapsed (`isExpanded: false` draws a dim single line per `d.ts` 7867-7918). The sketch's bar logic needs testing.
- **tweakcc** (third-party binary patcher, mentioned in `claude-mods.md` §4.1) can change things mods can't, but it is unsupported and version-fragile. It was not verified here.
- After upgrading, run `/plugin-types`. It writes the `d.ts` for your exact build; the GitHub copy is from 2.1.277 and may lag (reference L11-13).

**Next steps**
1. Upgrade to ≥2.1.287 (`claude --version`).
2. Drop in the theme from §5.1.
3. Set `tui: fullscreen`.
4. Scaffold `opencode-skin` with `--plugin-dir` and iterate one render site at a time, watching for `ui.render (X) refused:` lines.
