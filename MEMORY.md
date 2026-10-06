# Memory

## Plugin name is `ctui`

Applies when: naming the plugin, its commands, or install instructions.

Guidance: Set `name` to `ctui` in `ctui/.claude-plugin/plugin.json`. Commands come from `ctui/commands/**/*.md` (subfolders add segments, as in `/ctui:plugins:enable`) as `/ctui:<command>`. `register.tsx` answers each with one literal `on('command.run', { command: 'ctui:<command>' }, ...)` hook that never calls `next`, so the markdown body never reaches the model. Keep each body a harmless "the ctui mod is not loaded" fallback. The marketplace is named `claude-tui`, so users install `ctui@claude-tui`.

Reason: `claude plugin validate` rejects plugin names that start with `claude-`. Commands a mod registers can't contain `:`. The human chose the short colon form, and #5 confirmed `command.run` catches it.

## Plugin settings are flat `userConfig` keys

Applies when: adding or changing a plugin setting.

Guidance: Name per-plugin settings `<sidebar-plugin id>_<option>`, such as `context_enable` (boolean, default `true`) and `context_folded` (boolean, default `false`, the fold state a new session starts from). Regroup them in `ctui/hooks/config.ts` into `{ <section>: { <option> } }`. The `theme` setting is a string with fixed `options` (`inherit` plus every `themes/*.json` slug) and defaults to `inherit`. Keep that list equal to the files in `themes/`.

Reason: `userConfig` has no object type and accepts only letters, digits and underscores in keys. The human asked for per-section config shaped like `context { enable: true }`.

## `/ctui:*` commands stay quiet on success; a bare command opens a picker pane

Applies when: implementing or changing `/ctui:theme` or `/ctui:plugins:enable|disable`.

Guidance:
- With a name that changes the setting, return `{}`. Claude Code prints its own `● ctui: options changed — reloaded` row, and the Sidebar redraws.
- Answer every other outcome with one `{ text }` line: already set (`mcp is already disabled`, `Sidebar theme is already inherit`), unknown name (`Unknown plugin "foo". Plugins: <ids in registry order>`, `Unknown theme "x". Themes: <options>`), or `{ deny }` (`Can't disable mcp: <deny>`).
- With no name, open a picker pane: `$.ui.open({ id, focus: true, closeOnEscape: true, columns: <Sidebar width> })` drawing a `Select` with `autoFocus`. `disable` lists the enabled Sidebar plugins and `enable` lists the disabled ones. When that list is empty, print `All Sidebar plugins are already enabled|disabled` and open no pane. `/ctui:theme` always opens its picker, even with the one row `inherit`, with the current value selected. Handle the pick in a `ui.select` hook matched on the Select's `key`: from `$.clock.after(0, …)`, call `$.ui.close({ id })`, then `$.config.set` last (skip it when the pick equals the current value). Esc closes through `closeOnEscape`. A pick has no command row, so a `{ deny }` on it is a toast with the same `Can't …` line, sent through the toast queue even with `agents_toasts` off.
- Before any write or picker, check `$.config.list()` for the `ctui.theme` row. With no row (`claude -p`, SDK), print `Can't change ctui settings in claude -p. Use /config in an interactive session.` Unknown names still get their own line.
- A command typed mid-reply waits for the reply to end. Claude Code offers `ctrl+x ctrl+s` to send it now. Keep the markdown commands. Don't switch to `immediate` mod commands, which can't contain `:`.

Reason: The human chose these outcomes in #22, after a live spike on 2.1.288 (`prototypes/research-22/`). `{}` leaves no transcript row, not even the command line. A `{ text }` row reads `⎿ ctui: …`, and the model reads it on the next turn. In fullscreen the picker docks as a tab over the Sidebar (71 columns when no width is asked), and the Sidebar returns when the picker closes. On the main screen it sits inline above the prompt. `$.ui.ask` takes at most 4 options, too few for 7 Sidebar plugins. Under `-p`, `$.config.set` throws and a pane draws nothing. The human chose the deny toast in #53.

## Sidebar colors inherit the Claude Code theme

Applies when: choosing colors in the mod or adding a theme.

Guidance: Use Claude Code theme keys (`claude`, `success`, `error`, `warning`, `suggestion`, `inactive`, ...) as the default palette. A file in `ctui/themes/<slug>.json` uses Claude Code's `{ name, base, overrides }` shape. The sidebar resolves each color as `overrides[key] ?? key`. The Sidebar paints no background: the dock's color is the undocumented key `composerSidebarBackground`, so a Theme sets it there; recheck that key on each Claude Code version bump. Put nothing of another shape in `themes/`. Leave CSS and SCSS in `prototypes/` only.

v0.1 ships no Theme file: the `theme` setting and `/ctui:theme` stay, with options `[inherit]`, so a later Theme drops in without manifest changes. Custom colors go in a CLI theme the person saves as `~/.claude/themes/<slug>.json` and picks in `/theme`. `docs/configuration` holds an example that sets every theme key the Sidebar reads plus `composerSidebarBackground` and `promptBorder`; keep its key list equal to the keys the code uses plus those two.

Reason: The human chose `inherit` with no shipped Theme, kept the setting and command, and wants themes documented in `docs/configuration` (#12). Theme keys follow the user's `/theme` live. Claude Code scans `themes/` as CLI themes and lists each in `/theme` as `<name> · from <plugin>` (stored as `custom:<plugin>:<slug>`). Only the person's `/theme` pick paints the dock: `$.config.set({ key: 'theme' })` accepts only the built-in themes (#12, 2.1.288). CSS can't reach the mod runtime. Details are in `docs/agents/research/claude-code-plugin-mods-structure.md` §3.4 and §6a.

## Sidebar plugins are pure; only `register.tsx` touches `$`

Applies when: adding or changing a sidebar plugin, a data loader, or a hook.

Guidance: Each sidebar plugin lives in `ctui/plugins/<id>/index.tsx`. It exports a `SidebarPlugin` (`ctui/plugins/plugin.ts`): `{ id, title, slot, needs, list?, view, count?, summary? }`, each draw taking `(data, ui, cfg, width)`, and never receives `$`. `width` is the row's width in cells, from the Pane's `bodyColumns` (a section row is 36 at 42 columns): size bars and rules to it. `view` returns one node per row, so `ctui/hooks/sidebar.tsx` can cap lists and scroll; `slot` places it as header, section or footer; `count` and `summary` fill a section header's right side while expanded and folded. `ui` is the `ElementTable` from `$.ui.resolve(e)`, resolved once per render in `register.tsx`; write views as `view: (data, { Box, Text }, cfg, width) => ...`. List every plugin by static import in `ctui/plugins/index.ts`. Data loaders that call `$` are top-level functions in `ctui/hooks/register.tsx`. Enablement is the `<id>_enable` option alone: `/ctui:plugins:enable|disable` writes it with `$.config.set({ key: 'ctui.<id>_enable', value })` as its last action, and every change reloads the mod with new `options`. `$.config.set` throws under `claude -p`. Keep folders, registry imports and `<id>_enable` keys identical (`scripts/check.ts` checks).

Reason: `claude plugin validate` rejects dynamic `import()`, non-literal event names, and passing `$` or `$.ui` to an imported function, but accepts the resolved table (#7). It misses an unbound tag in an imported view, so only `tsc` catches that. The human chose the `width` argument in #49: Claude Code says to size a rule to `bodyColumns`, and a pure view can't read it. #6 showed the mod can write its own `/config` row. The human asked for sidebar sections as plugins in `plugins/`, toggled by config or command.

## The Sidebar adapts to the dock's engine chrome

Applies when: drawing the Sidebar pane, sizing it, or handling its scroll and fold state.

Guidance: The dock sits beside the transcript and stops above the prompt rows. Claude Code draws its `│` rule (dim, default foreground), a `✕` over the body's top-right cell, and one row below the body; no prop, theme key or mod drawing changes them. Draw the body with padding top/bottom 1, left/right 2 and a root Box `height` of `scroll.bodyRows`, read each render: `git` header, sections window, flexible space, `versions` footer on the last row. Request `columns` 42 below 160 terminal columns and 53 from 160. Terminal width is `e.viewport.columns + bodyColumns + 1` (`viewport.columns` is the transcript's width); on a change, re-call `$.ui.open({ id, columns })` from `$.clock.after(0, …)`, never from the render itself. Cap each long list at 4 rows plus `▸ N more` / `▾ show less`. Scroll the sections yourself: slice rows to the free height (each row `height 1`, `flexShrink 0`; `overflow:"hidden"` shrinks rows instead of clipping), draw `↑ more` / `↓ more`, and answer `ui.scroll` for the pane with `{}` without `next`. Keep folds, expanded lists and the offset in `$.state`; a new session starts from `<id>_folded`.

Reason: #8 verified the chrome, the viewport width and the overflow shrink live on 2.1.288. The human chose to accept the chrome, opencode's padding, the 42/53 width, render 2's caps, and the mod-owned scroll after trying it live.

## The Sidebar shows only when docked, and the person can't close it

Applies when: opening, closing or placing the Sidebar pane, or handling `ui.close` for it.

Guidance: Claude Code docks a pane only under the fullscreen renderer at 110+ terminal columns; otherwise it seats it inline above the prompt (the main screen at any width, fullscreen below 110). It places a pane the mod opens unasked only from 144 columns, or 110 once the person has asked for that id and not closed it by hand. So:
- Never open at `session.start`, which carries no viewport. Watch an always-drawn render site (`SessionMode`, observe only, `return next(e)`): when the pane isn't placed, read `e.viewport` (`isFullscreen === true` and `columns >= 110`, the terminal's width while nothing is docked) and open from `$.clock.after(0, …)`.
- If that open waits (`isPlaced: false`), open again from the person's next `prompt.submit`. An open from their prompt counts as asked, so it docks at 110+ and lowers the floor to 110 for later sessions.
- When the `Pane` render gets `placement: 'inline'`, return an empty Box and `$.ui.close` the pane from `$.clock.after(0, …)`. A plugin close keeps the 110 floor, and the watcher reopens the pane once the terminal is 110+ again.
- Answer `ui.close` for the pane with `{ deny: reason }` when `origin.kind` is `person`. A bare `return` or `{}` is skipped as the wrong shape, and the pane closes. The engine still draws the `✕`, and it never shows the reason. Pass `plugin` closes through with `next(e)`.

Reason: #9 verified all of this live on 2.1.288, except ctrl+x x, which raised no `ui.close` under tmux. The human wants the Sidebar permanent, with nothing drawn when it can't dock. This reverses #8's choice to let the person close the pane.

## The `mcp` Sidebar plugin reads live tools and the disabled list; it never probes

Applies when: working on the `mcp` Sidebar plugin or anything that reads MCP server status.

Guidance:
- Every 1 s, group `$.tool.list()` entries with `mcp: true` by the second `__` segment of the name. Read `projects[<git root>].disabledMcpServers` from `$CLAUDE_CONFIG_DIR/.claude.json`, or `~/.claude.json` when that variable is unset (the key is the git root found by walking up from the cwd for `.git`, else the cwd), when the file's `$.fs.stat` mtime changes. Match a disabled name to a segment with `name.replace(/[^A-Za-z0-9_-]/g, '_')`.
- List only servers seen with tools this session plus disabled ones. Rows: `●` success `N tools` (`1 tool`); `!` warning `needs auth` when the only tools are `authenticate`/`complete_authentication`; `◐` warning `connecting` for a listed server that lost its tools or left the disabled list, for `MCP_TIMEOUT` ms (`$.env.get`, default 30000) from that moment; then `✕` error `down`; `○` inactive `off` when disabled. Header `n/m` counts `●` rows over listed rows. Keep first-seen order with `off` rows last.
- Label a row with its `/mcp` name minus a `claude.ai ` or `plugin:<plugin>:` prefix, taken from the disabled list or `tool.describe`'s `provider.plugin` (`mcp:<name>`). Without one, use the segment minus `claude_ai_` or `plugin_<plugin>_`.
- Run no shadow `claude -p` probe and no `claude mcp list`.

Reason: The human chose this in #11 to keep the mod free of child processes and network calls. The spike (`prototypes/research-11/`, 2.1.288) showed the tool list follows `/mcp disable|enable` within 250 ms, and every scope's disable lands in that one list under its `/mcp` name. The auth pseudo-tools appear only at startup, so a re-enabled server needing auth reads `connecting`, then `down`. `tool.describe` fires only for tools sent to the model, so it can't be the only source of names. With `CLAUDE_CONFIG_DIR` set, Claude Code keeps `.claude.json` in that folder (checked on 2.1.288), and the human chose to follow it in #50.

## The `todo` Sidebar plugin turns the task tools on by default

Applies when: working on the `todo` Sidebar plugin, its settings, or `$.env.set`.

Guidance:
- Add the `userConfig` boolean `todo_tools` (title `Task tools`, default `true`), its description naming Opus 5.x and `CLAUDE_CODE_ENABLE_TODO_TOOLS`. It is independent of `todo_enable`.
- On `session.start`, which fires again on each reload with new `options`: when `todo_tools` is on and the variable is unset, call `$.env.set('CLAUDE_CODE_ENABLE_TODO_TOOLS', '1')` and record that in `$.state`. When it is off, unset the variable only if `$.state` records that ctui set it, so a value the person set stays. `/clear` empties `$.state`, so an off toggle after `/clear` takes effect in the next process.
- Gate the section on `$.tool.list()` from the 1 s tick, stored as `todo.tools` in `$.state`: the list follows `/model` within 1 s, with no event, and render hooks read state only. With `TaskList` or `TodoWrite`, read the list as #10 found; an empty list draws the header `0/0` and no rows. `TaskList` lacks `activeForm`, so after `--resume` the in-progress row shows its subject until the next TaskUpdate names one. A TaskCreate after every task is done starts a fresh list (Claude Code drops the finished tasks); the rows follow it. With neither, draw the header without a count and one dim hint: `no task tools on this model` / `turn on ctui Task tools in /config` when `todo_tools` is off, `no task tools in this session` when it is on (`--tools`, a deny rule). Call `TaskList` only when the tool is listed: it throws otherwise.
- `ctui/README` discloses that the default gives Claude the Task tools on Opus 5.x and how to turn it off, and names the variable for people who set it in `settings.json` `env`.

Reason: The human chose this in #21 after a live spike (`prototypes/research-21/`, 2.1.288). In #51 the human chose the tick over a render-time check: one tool-list call per second instead of one per redraw, and one source for the hint and the rows. Without the variable, the 5.x models (Opus 5.5, the human's default, and Sonnet 5.5) have no task tools, so the section would always be empty. After `$.env.set`, Opus 5.5 got the tools at once and used them; unsetting removed them. `/plugin install` shows a "Configure ctui" screen listing every `userConfig` field, defaulted ones too, with the focused field's description: that screen is where ctui suggests the tools. The Task tools are deferred tools (#10), so they cost little per request. Subagents and child processes, a nested `claude -p` included, inherit the variable.

## Agent and shell events go to toasts, the live list goes to the sidebar

Applies when: working on the `agents` sidebar plugin or on toasts.

Guidance: `register.tsx` raises one-line toasts for subagent and background-shell start, finish and failure (`◆ … started`, `$ … started in background`, `✓ … done · … · 42s`, `✗ … failed: …`), gated by `agents_toasts`. The `agents` sidebar plugin ("Agents & shells", between Todo and the versions footer) shows the live tree, gated by `agents_enable`. Agent starts come from `agent.spawn`. Agent status comes from polling `$.agent.list()` every 1 s, because it has no change event and no timestamps, and `completed` is not final. Shell starts come from a Bash `tool.call` result with `backgroundTaskId`, when its `agentId` is absent or held; other shells follow the Workflow entry. Shell and agent ends, kills and the `/clear` carry-over follow the next entry. One pure, guarded `parseTaskNotification(text)` is the only code that reads that XML: it requires `<task-id>` and `<status>`, matches only ids already held, and returns `undefined` otherwise (#15). An agent's failure reason comes from `classic.StopFailure` (`agent_id`, `error` word), then the notification summary, then the status word (#13); `classic.SubagentStop` never fires for a failed agent. Elapsed time comes from `$.clock.now()`. Never open the sidebar with `holdToasts`. Details: `docs/agents/research/toasts-agents-shells.md`.

One toast per event, titled with the plugin `name`. Send every toast through one module-level queue in `register.tsx`: call `$.ui.toast` at most once per 2100 ms, take a waiting end (`✓`/`✗`) before waiting starts, and drop a waiting start when its own end is enqueued. Leave `timeoutMs` at the engine's 4 s default. With `agents_toasts` off, enqueue nothing. Keep each text one line: the box wraps at 40 columns to 3 rows, then cuts with `…`, and `\n` draws as `�`.

Reason: The human agreed this split in the open-claude-mod session: toasts are short-lived and unstyled, so they suit events and not lists. Mockup: `prototypes/opencode-skin-preview.html`. On 2.1.288 the hooks host drops a plugin's toast that comes less than 2 s after its last shown one, logging only to the debug log, in both renderers (#41, `prototypes/research-41/`). The prototype's apparent queue was those drops. Shown toasts stack, so a 4 s timeout keeps at most two on screen. The human chose this paced queue over merging a burst into one toast, accepting that a burst of N events takes about 2.1×N s to drain.

## Task ends come from notifications; running tasks carry across `/clear` and `/resume`

Applies when: reading background shell or agent ends, or handling `/clear`, `/resume` or a reload in the `agents` Sidebar plugin.

Guidance:
- Normal ends: `prompt.submit` with origin kind `task-notification` (observe only, `return next(e)`). It fires after `/resume` and after a reload too. While a dialog such as `/config` is open, Claude Code holds the notification and delivers it when the dialog closes.
- A shell stopped from the `/tasks` dialog raises nothing at that moment. Its `<status>killed</status>` notification comes with the person's next prompt, as a `session.append` row only: hook `{ door: 'delivery', message: { name: 'queued_command' } }`, feed its text to the same `parseTaskNotification`, and set the row to `killed` with no toast.
- A TaskStop by the model sends no notification: mark the task `killed` from the TaskStop `tool.call` result.
- A subagent's background shell reports its end into that subagent's loop only: a `session.append` row with door `prompt`, origin kind `task-notification` and `agentId` set, even after the agent's own turn ended, and no `prompt.submit`. Read those rows when `agentId` is set; that keeps the main loop's synthetic `/resume` rows unread.
- `$.state` and `$.agent.list()` are per session. `/clear` and `/resume` empty them without a reload or a `session.start`, while running shells and agents keep going and report their ends into the new session. On `session.end` with reason `clear` or `resume`, copy the `running` entries of `tasks` into a module variable, and merge them into the new session's `tasks` on the next `$.clock.every` tick. A reload keeps `$.state` and needs no carry.
- On `/resume`, Claude Code appends `<status>stopped</status>` rows for shells in the resumed transcript with no completion record, through `session.append` door `prompt` only. The hooks above never read them; they can be wrong (one said `stopped` for a shell that completed).

Reason: The #14 spike (`prototypes/research-14/`, 2.1.288) showed each path live; #52 found the subagent-shell row live and in a `-p` spike, after such a shell read `running` forever. The `$.clock.every` timer kept running across `/clear`, its first tick read the new session, and its write succeeded. No render site carries the footer's shell count (`SessionMode` `modes` stays empty). The human chose to read the late kill notification without a toast (the person's own action, often minutes old), and to carry running background work across `/clear`.

## A Workflow run is one task row; teammates stay hidden

Applies when: handling Workflow runs, teammates, or a background shell whose `agentId` the `agents` Sidebar plugin doesn't hold.

Guidance:
- Add a Workflow run as one row, `⚙ <workflowName> workflow`, from its Workflow `tool.call` result (`taskId`, `workflowName`, `transcriptDir`), with the usual start and done/failed toasts. Its end, a TaskStop and the `/clear` carry-over follow the task-end entry above, keyed by `taskId`. Its agents get no rows: they fire no `agent.spawn` and `$.agent.list()` never names them.
- A background shell whose `agentId` isn't held: `$.fs.stat('<transcriptDir>/agent-<agentId>.jsonl')` for each running run, and nest it as `└` under the run whose dir has the file. No toasts; it reads `running` until the run's end removes it. Skip it when no run matches (teammates, engine forks).
- Filter `type: 'teammate'` out of `$.agent.list()`: no rows, no toasts.
- Only local runs (`async_launched`) were seen; a `remote_launched` run takes the same row, unverified.

Reason: The human chose this in #16 after a live spike (`prototypes/research-16/`, 2.1.288). A Workflow run is one background task with an id and a task-notification end, and Claude Code's footer draws its progress. A shell started inside a workflow agent or a teammate reports no end to the mod. Teammates need `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`, fire no `agent.spawn`, read `running` while idle and drop out of the list when stopped, and Claude Code's footer already lists them. The transcript file name is observed, not typed; recheck it on a version bump.

## Publish to Anthropic's plugin directory and to npm

Applies when: changing the layout, manifest, dependencies, licensing, or release process.

Guidance: Keep every structural choice compatible with both channels: Anthropic's official plugin directory and an npm package.
- `ctui/` must contain its own README (at least 40 words, stating the tested Claude Code version and disclosing that the mod watches Bash and agent events in every session) and its own LICENSE. The repo-root files don't count.
- `ctui/package.json` has no dependencies, no scripts, no lockfile, and a `files` whitelist. The dev `package.json` and lockfile stay at the repo root.
- The npm name `ctui` is taken. Use the scoped `@a1exk-dev/ctui` unless the human decides otherwise.
- Releases: bump both version fields on `release/x.y.z`, add its row to `ctui/COMPATIBILITY.md`, merge to `main` (the default branch, which the directory follows), tag `vX.Y.Z`. A tag workflow runs the checks, publishes to npm with provenance, and creates the GitHub release.
- Versions: each 0.x is a real release (`release/0.y.0` into `main`, tagged) for initial development, with no npm publish and no directory listing. 1.0.0 is the stable release that gets listed; the publishing map sets the listing up. The human chose this in #42, following SemVer's 0.y.z rule.
- Any network call needs disclosure, an opt-out, and a privacy policy URL.

Details: `docs/agents/research/publishing-catalog-npm.md`.

Reason: The human set both channels as publishing targets.

## Display name is `ctui`, and the plugin is a TUI skin, not only a sidebar

Applies when: writing the manifest, the README, listing text, or describing scope.

Guidance: Set `displayName` to `ctui`. The repo and marketplace stay `claude-tui`. Describe the plugin as a skin for Claude Code's TUI: it covers the Sidebar and the lines under the prompt input (model, effort, permission mode), and later other render sites.

Reason: Anthropic's directory holds names that match a known brand for review. The human chose `ctui` and noted the scope is wider than the sidebar.

## The `versions` footer shows no update icon; the mod makes no network call

Applies when: working on the `versions` Sidebar plugin or anything that would fetch remote data.

Guidance: The footer shows the installed version from `$.session.version()` and nothing about updates. Claude Code's own notification line (`Update available! Run: <command>`, right-aligned above the prompt rule) stays the only update signal. Fetch no release data and run no version-check process from the mod.

Reason: The #17 spike (`prototypes/research-17/`, 2.1.288 with 2.1.289 out) showed that native notice reaches no mod hook: no render site (`PromptHint`, `SessionMode`, `AbovePrompt`, `InfoNotice`), no event, and no `http.fetch` op. No engine-written file names the latest version either. The human then chose no icon over an opt-in fetch or an `npm view` child process. Staying network-free avoids the directory's disclosure, opt-out and privacy-policy requirements.

## `UserMessage` rewrites draw the person's own prompts only

Applies when: rewriting the `UserMessage` render site (the `┃` bar and panel).

Guidance:
- Choose rows by `origin.kind`, never by `isExpanded`. Draw the bar and panel for `composer`, `bridge` and `sdk` in both states. Pass every other row (task notifications, peers, channels, teammates) to `next(e)`, so the engine keeps its one-liners, sender framing and `(ctrl+o to expand)`.
- Draw a row Box with `marginTop: 1`, `paddingLeft: 1` and `overflow: 'hidden'`. Inside it, put an absolute Box (`top: 0, bottom: 0, left: 0, width: 1`) holding a tall `┃` Text colored `promptBorder`, then the body Box (`flexGrow: 1`, `backgroundColor: 'userMessageBackground'`, `paddingX: 2`, `paddingY: 1`). The outer `overflow: 'hidden'` is what clips the `┃` column to the row.
- Draw `text` with `<pasted_content …>` tags and leading and trailing newlines removed, as the engine does. Build new values: `e.props` is frozen, and assigning to it throws, which skips the hook.
- The fullscreen sticky header (the prompt pinned at the top while scrolling) is the engine's and ignores the rewrite.

Reason: The human chose this in #19 after a live spike (`prototypes/research-19/`, 2.1.288, fullscreen and main screen). `isExpanded` is false on every row in the normal view, the person's prompts included, and true only under ctrl+o. A returned tree draws in both states. Without the outer clip, the `┃` column painted over column 0 of every later row. A computed `┃` count drifts with word wrap, and a width-1 background strip is a solid block, heavier than the thin bar in `docs/design/`. In #43 the human chose the fixed `promptBorder` over the mode color the renders show: coloring by the turn's mode needs a way to tie a row to its prompt, which no known prop gives, and old rows would lose it. The example theme in `docs/configuration` can set `promptBorder` to the renders' green.

## Tool rows: glyph rows for Read, Edit, Write and Bash; results stay Claude Code's

Applies when: rewriting the `ToolUse`, `ToolGroup` or `ToolResult` render sites.

Guidance:
- `ToolUse` for `Read` (`→`), `Edit` and `Write` (`←`), `Bash` (`$`): one row, `Box paddingLeft 2`: `<glyph> <tool>  <subject>`, then ` · <summary>` dim, the row `truncate-end`. Pass every other tool to `next(e)`.
- Subject: a path inside `$.session.cwd()` relative to it, any other path absolute with `~` for `HOME` (read both in the hook: on `--continue` the transcript renders before `session.start`); or the command's first line plus ` …` when it has more.
- Summary on success: Read `N lines` (`output.file.numLines`); Edit and Write `+a -d` counted from `output.structuredPatch`, or `+N` content lines when `output.type` is `create`; Bash `N lines` of stdout plus stderr, else `no output`. While `isRunning`: `running`. `isInterrupted`: `interrupted` in `warning` (Esc and a refused permission look the same). `isErrored`: the output's first line, glyph, tool name and summary in `error`. No summary while waiting for permission (no `output`).
- `ToolGroup`: return `next({ ...e, props: { ...e.props, isExpanded: true } })` so each call is its own `ToolUse` row.
- `ToolResult`: always `next(e)`, Edit diff included. Its `⎿ Added N lines, removed M lines` line stays. On the main screen a Bash call the engine didn't fold into a group is standalone, so its `⎿` output shows under ctui's row.

Reason: The human chose this in #34 after a live spike, and the outside-cwd path form in #54 (`prototypes/research-34/`, 2.1.288, fullscreen and main screen). 2.1.288 has no `Grep` or `Glob` tool: searches run as Bash, so the render's `* Grep` row is a known difference. Read and every Bash call fold into `ToolGroup`, whose folded line hides errors; Edit and Write are standalone with a `ToolResult`. Keeping the engine's results keeps ctrl+o's full output and the `diffAdded`/`diffRemoved` theme keys; a mod `Code` diff drew identical rows, so it bought only the dropped header line. `ToolResult` can't tell ctrl+o from the normal view. Under main-screen ctrl+o, unfolded calls show only ctui's row (the engine's inline output belongs to the row it replaces); fullscreen ctrl+o shows each call with its full result.

## The prompt box and main background stay Claude Code's

Applies when: specifying or building the main-column skin, or writing `docs/configuration`.

Guidance:
- ctui draws nothing for the prompt box or the main background. The build spec lists both as known differences from the renders in `docs/design/`: Claude Code's prompt is a `─` rule above and below a `❯` line, with no round box and no "Ask anything", and the transcript shows the terminal's own background.
- The example CLI theme in `docs/configuration` sets `promptBorder`, the color of the prompt's rules.
- `docs/configuration` has a "Main background" section: Claude Code shows the terminal's background behind the transcript, so set it to `#0a0a0a` to match the renders. Give a config example for each common terminal (Ghostty, Kitty, Alacritty, WezTerm, foot, iTerm2, Windows Terminal).
- Don't fake the box in the `AbovePrompt` band, and don't paint ctui's rows with a background.

Reason: The human chose this in #20. On 2.1.288 the prompt input is not a render site, and no setting changes its shape or placeholder (the placeholder is Claude Code's own `Try "…"`). The theme key list has no main-background key: the `background` key colors text such as "running" (binary check). An `AbovePrompt` box can't join the input, keeps its text while the person types, and is shared with other mods. Row backgrounds leave stripes between the engine's rows.

## The line under the prompt: `model · effort` is a `SessionMode` label

Applies when: drawing the line under the prompt (`PromptHint`, `SessionMode`), or reading the session's model or effort.

Guidance:
- Pass `PromptHint` through with `next(e)` and keep its `hint` text in a module variable. Claude Code's mode pill (`⏵⏵ accept edits on`) sits left of it, follows shift+tab live, and is the only permission-mode display: ctui draws none.
- The one `SessionMode` hook (shared with the Sidebar's viewport watcher) builds the label `<model> · <effort> effort`, or `<model>` alone with no effort. When `2 + 24 + 1 + hint.length + 2 + label.length <= e.viewport.columns` (24 is the widest pill, `⏵⏵ bypass permissions on`), append the label to `modes`. Otherwise return `Box({ width: '100%' })` holding a dim `truncate-end` Text of the label: Claude Code gives it its own row, left-aligned. While the Sidebar is docked, `viewport.columns` is the transcript's width, but the line spans the terminal: add the dock's `bodyColumns + 1` (kept from the `Pane` render, 0 while not docked) in the fit test. When `hint` or that dock width changes, call `$.ui.invalidate('ui.render')` from `$.clock.after(0, …)`.
- Model: `$.session.model()` (the id, as the renders show it), read on the 1 s poll. It follows `/model` within a tick. `/clear` and `/resume` empty `$.state`: carry the effort across them from `session.end`.
- Effort, kept in `$.state`: seed it from `$.settings.read()` `modelSettings[<model>].effortLevel ?? effortLevel`. Then take the latest of: main-loop `turn.step` `effort` (no `agentId`; absent means the model takes none, so clear it); `command.run` `effort` whose `args` is a level (observe, `return next(e)`); and a change in `modelSettings[<current model>].effortLevel` between polls (the saved `/effort` picker). After `/model`, keep the effort: the session's level carries over, and the new model's saved default is only for new sessions. `turn.step` streams, so its hook is `async function* ($, e, next) { …; return yield* next(e) }`.
- Known differences from the renders: the mode stays Claude Code's pill on the left, not `▸▸ accept edits` on the right. With a status line, the label sits at the right of the status-line row. On the main screen, it stacks under Claude Code's notices (`Update available!`).

Reason: The human chose this in #35 after a live spike (`prototypes/research-35/`, 2.1.288, fullscreen and main screen, 80 to 180 columns). Shift+tab raises no event, and classic hooks carry `permission_mode` only when they fire. No call returns the effort: a session-only `/effort` pick (`s`) and `--effort` show only at the next request. `tail` can't reach the right edge, because Claude Code collapses leading spaces and no-break spaces. A growing tree wraps Claude Code's ` · ` separator onto a stray row, and an engine ref under a Box with `width` is refused. #55 checked live that `viewport.columns` shrinks while docked (150 columns: 107; 170: 116) while the line stays full width; the human chose the terminal width for the fit test.

## The turn footer: prefix the turn's mode and model to Claude Code's `word`

Applies when: rewriting the `TurnDuration` render site, or reading a finished turn's mode or model.

Guidance:
- Return `next({ ...e, props: { ...e.props, word: '<mode> · <model> · <word>' } })`, giving `✻ accept edits · claude-opus-5-5 · Baked for 12s · done 8:57 PM`. Claude Code keeps drawing the glyph, `for <duration>`, the done time (`timeFormat`), the `showTurnDuration` gate, and its extras (`Waiting for N background agents to finish`, token budget, `N messages hidden`, `· N shell still running`). Draw no tree of your own.
- Values are the turn's own. Mode: the latest `permission_mode` from a `classic.*` event without `agent_id` (`UserPromptSubmit` at the start, `Stop` at the end; `StopFailure` has none). Model: the last main-loop `turn.step` `model` (a fallback model when one took over). On main-loop `turn.complete`, unless `reason` is `aborted` (no line is drawn then), store `{ durationMs, mode, model }` in `$.state`. The render reads the newest record whose `durationMs` equals `e.props.durationMs`; render hooks never write `$.state`.
- Mode labels follow Claude Code's pill: `default` → `manual mode`, `acceptEdits` → `accept edits`, `plan` → `plan mode`, `bypassPermissions` → `bypass permissions`, `auto` → `auto mode`, `dontAsk` → `don't ask`.
- With no record (lines from an earlier process after `--continue` or `/resume`, or before ctui loaded), return `next(e)`: Claude Code's plain line. Persist nothing in `$.store`.
- Known differences from the renders: Claude Code's `✻` glyph and verb (`Baked for 12s`) replace `⊡` and `12.3s`.

Reason: The human chose this in #36 after a live spike (`prototypes/research-36/`, 2.1.288, fullscreen and main screen). The props carry only `word` and `durationMs`; `requestId` is the transcript's `turn_duration` uuid, stable across `--continue`, but no event names it before the render. `turn.complete` fires just before the render with an identical `durationMs`. Old lines redraw on scroll, reload and `--continue`, never on shift+tab or `/model`. With `showTurnDuration: false` the engine hides only its own drawing, so a mod tree would still draw, and an own tree drops every engine extra.

## One pinned Claude Code version: devDependency, vendored types, tested-versions table

Applies when: running or fixing `tsc` or the checks, changing `tsconfig.json` or CI, or moving to a new Claude Code version.

Guidance:
- Pin Claude Code as an exact root devDependency (`"@anthropic-ai/claude-code": "2.1.288"`). `npm ci` installs it locally and in CI. The checks run `node_modules/.bin/claude plugin validate ctui --strict`, `validate . --strict` and `plugin test ctui`, and fail when it is missing.
- The root `tsconfig.json` type-checks `ctui/` against `vendor/claude-code-types/{claude-code,claude-code-tools}`, copied from the `ctui/.claude-plugin/types/` the engine writes when it loads `claude --plugin-dir ./ctui`. Leave `claude-code-mcp` out: it lists the MCP tools of the session that loaded it. `ctui/tsconfig.json` is the engine-written editor config, unused by the checks.
- `ctui/COMPATIBILITY.md` is a `ctui | Claude Code | Date` table of released ctui versions only, newest first, in the npm `files` whitelist. `ctui/README.md` reads `Tested with Claude Code <pin> ([all tested versions](COMPATIBILITY.md)).` The checks assert the README version equals the pin and, once the table has rows, that its top row equals `plugin.json`'s version and the pin. Before 0.1.0 it holds only the header.
- A version bump is one PR into `develop`, with no release: `npm i -D -E @anthropic-ai/claude-code@<ver>`, load the plugin once and copy the two type folders into `vendor/`, update the README line, add a row for the latest released ctui version, and run the full live checklist. It reaches `main` with the next release.

Reason: The human chose this in #42. CI has no Claude Code session to generate the types, and the generated folder is gitignored by the engine. `claude plugin test` and `validate` need no session, sign-in or network; the npm package brings each platform's binary as an optional dependency. A row is a tested pair, so a bump changes no version and starts no release; only a `plugin.json` bump forces a new row.

## Tests cover real usage: unit tests per module, scenario tests through hooks, live checks for the rest

Applies when: writing or reviewing ctui tests, the check runner, `CONTRIBUTING.md` or the PR template.

Guidance:
- Test what real usage reaches, and only that: a failure case earns a test when a production input, dependency or path can produce it (`claude -p` with no `ctui.theme` row, `TaskList` absent on the model). Skip shapes a 2.1.288 session never sends.
- `claude plugin test ctui` runs `ctui/tests/*.test.ts(x)` in two layers. Unit tests for most modules: each Sidebar plugin view mounted with sample data, `parseTaskNotification`, the toast queue, the formatters, and the `/ctui:*` outcome logic. Scenario tests drive the hooks through real-usage flows and assert what the person sees: Sidebar rows, toasts, command replies, rewritten rows.
- Build events with the `claude-code/testing` drivers (`$.tool.call`, `$.agent.spawn`, `$.classic.<Event>`, `$.ui.mount`, `mock.clock`), so the engine shapes them as a session does. Hand-write a payload only where no driver makes one (task-notification XML, the `queued_command` row, `~/.claude.json`), copied from what a spike recorded.
- On 2.1.288 the test kit can't keep a `session.append` row: nothing answers it beneath the plugins, and a test's own answer is skipped. Drive the row with `$.session.append(...).catch(() => undefined)` and assert on what ctui's hook did before `next(e)`.
- `node scripts/check.ts` is the one check runner, locally and in `check.yml`: `tsc`, `validate --strict`, `plugin test`, the consistency checks, `typos`.
- Behaviour mocks can't reach is a live check in `docs/testing/live-checks.md` (setup, action, expected), by section: Sidebar docking, Sidebar layout and scroll, toasts, render-site rewrites, commands and pickers, `claude -p`. A root `CONTRIBUTING.md` explains it; `.github/pull_request_template.md` asks which sections ran on the pin. A `ctui/` PR runs the sections it touches, releases and pin bumps run the full list, and a docs-only PR answers N/A. Auto-merge doesn't wait on it.

Reason: The human chose this in #42. `claude plugin test` loads tests from inside the mod folder, `validate --strict` passes with `tests/` there, and npm's `files` whitelist leaves it out (checked on 2.1.288). Docking, engine chrome, toast drawing and the fullscreen and main-screen looks need a signed-in terminal, so they stay manual.
