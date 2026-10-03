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
- With no name, open a picker pane: `$.ui.open({ id, focus: true, closeOnEscape: true, columns: <Sidebar width> })` drawing a `Select` with `autoFocus`. `disable` lists the enabled Sidebar plugins and `enable` lists the disabled ones. When that list is empty, print `All Sidebar plugins are already enabled|disabled` and open no pane. `/ctui:theme` always opens its picker, even with the one row `inherit`, with the current value selected. Handle the pick in a `ui.select` hook matched on the Select's `key`: from `$.clock.after(0, …)`, call `$.ui.close({ id })`, then `$.config.set` last (skip it when the pick equals the current value). Esc closes through `closeOnEscape`.
- Before any write or picker, check `$.config.list()` for the `ctui.theme` row. With no row (`claude -p`, SDK), print `Can't change ctui settings in claude -p. Use /config in an interactive session.` Unknown names still get their own line.
- A command typed mid-reply waits for the reply to end. Claude Code offers `ctrl+x ctrl+s` to send it now. Keep the markdown commands. Don't switch to `immediate` mod commands, which can't contain `:`.

Reason: The human chose these outcomes in #22, after a live spike on 2.1.288 (`prototypes/research-22/`). `{}` leaves no transcript row, not even the command line. A `{ text }` row reads `⎿ ctui: …`, and the model reads it on the next turn. In fullscreen the picker docks as a tab over the Sidebar (71 columns when no width is asked), and the Sidebar returns when the picker closes. On the main screen it sits inline above the prompt. `$.ui.ask` takes at most 4 options, too few for 7 Sidebar plugins. Under `-p`, `$.config.set` throws and a pane draws nothing.

## Sidebar colors inherit the Claude Code theme

Applies when: choosing colors in the mod or adding a theme.

Guidance: Use Claude Code theme keys (`claude`, `success`, `error`, `warning`, `suggestion`, `inactive`, ...) as the default palette. A file in `ctui/themes/<slug>.json` uses Claude Code's `{ name, base, overrides }` shape. The sidebar resolves each color as `overrides[key] ?? key`. The Sidebar paints no background: the dock's color is the undocumented key `composerSidebarBackground`, so a Theme sets it there; recheck that key on each Claude Code version bump. Put nothing of another shape in `themes/`. Leave CSS and SCSS in `prototypes/` only.

v0.1 ships no Theme file: the `theme` setting and `/ctui:theme` stay, with options `[inherit]`, so a later Theme drops in without manifest changes. Custom colors go in a CLI theme the person saves as `~/.claude/themes/<slug>.json` and picks in `/theme`. `docs/configuration` holds an example that sets every theme key the Sidebar reads plus `composerSidebarBackground`; keep its key list equal to the keys the code uses.

Reason: The human chose `inherit` with no shipped Theme, kept the setting and command, and wants themes documented in `docs/configuration` (#12). Theme keys follow the user's `/theme` live. Claude Code scans `themes/` as CLI themes and lists each in `/theme` as `<name> · from <plugin>` (stored as `custom:<plugin>:<slug>`). Only the person's `/theme` pick paints the dock: `$.config.set({ key: 'theme' })` accepts only the built-in themes (#12, 2.1.288). CSS can't reach the mod runtime. Details are in `docs/agents/research/claude-code-plugin-mods-structure.md` §3.4 and §6a.

## Sidebar plugins are pure; only `register.tsx` touches `$`

Applies when: adding or changing a sidebar plugin, a data loader, or a hook.

Guidance: Each sidebar plugin lives in `ctui/plugins/<id>/index.tsx`. It exports a `SidebarPlugin` (`ctui/plugins/plugin.ts`): `{ id, title, needs, view(data, ui, cfg) }`, and never receives `$`. `ui` is the `ElementTable` from `$.ui.resolve(e)`, resolved once per render in `register.tsx`; write views as `view: (data, { Box, Text }, cfg) => ...`. List every plugin by static import in `ctui/plugins/index.ts`. Data loaders that call `$` are top-level functions in `ctui/hooks/register.tsx`. Enablement is the `<id>_enable` option alone: `/ctui:plugins:enable|disable` writes it with `$.config.set({ key: 'ctui.<id>_enable', value })` as its last action, and every change reloads the mod with new `options`. `$.config.set` throws under `claude -p`. Keep folders, registry imports and `<id>_enable` keys identical (`scripts/check.sh` checks).

Reason: `claude plugin validate` rejects dynamic `import()`, non-literal event names, and passing `$` or `$.ui` to an imported function, but accepts the resolved table (#7). It misses an unbound tag in an imported view, so only `tsc` catches that. #6 showed the mod can write its own `/config` row. The human asked for sidebar sections as plugins in `plugins/`, toggled by config or command.

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
- Every 1 s, group `$.tool.list()` entries with `mcp: true` by the second `__` segment of the name. Read `projects[<git root>].disabledMcpServers` from `~/.claude.json` (the key is the git root found by walking up from the cwd for `.git`, else the cwd) when the file's `$.fs.stat` mtime changes. Match a disabled name to a segment with `name.replace(/[^A-Za-z0-9_-]/g, '_')`.
- List only servers seen with tools this session plus disabled ones. Rows: `●` success `N tools` (`1 tool`); `!` warning `needs auth` when the only tools are `authenticate`/`complete_authentication`; `◐` warning `connecting` for a listed server that lost its tools or left the disabled list, for `MCP_TIMEOUT` ms (`$.env.get`, default 30000) from that moment; then `✕` error `down`; `○` inactive `off` when disabled. Header `n/m` counts `●` rows over listed rows. Keep first-seen order with `off` rows last.
- Label a row with its `/mcp` name minus a `claude.ai ` or `plugin:<plugin>:` prefix, taken from the disabled list or `tool.describe`'s `provider.plugin` (`mcp:<name>`). Without one, use the segment minus `claude_ai_` or `plugin_<plugin>_`.
- Run no shadow `claude -p` probe and no `claude mcp list`.

Reason: The human chose this in #11 to keep the mod free of child processes and network calls. The spike (`prototypes/research-11/`, 2.1.288) showed the tool list follows `/mcp disable|enable` within 250 ms, and every scope's disable lands in that one list under its `/mcp` name. The auth pseudo-tools appear only at startup, so a re-enabled server needing auth reads `connecting`, then `down`. `tool.describe` fires only for tools sent to the model, so it can't be the only source of names.

## Agent and shell events go to toasts, the live list goes to the sidebar

Applies when: working on the `agents` sidebar plugin or on toasts.

Guidance: `register.tsx` raises one-line toasts for subagent and background-shell start, finish and failure (`◆ … started`, `$ … started in background`, `✓ … done · … · 42s`, `✗ … failed: …`), gated by `agents_toasts`. The `agents` sidebar plugin ("Agents & shells", between Todo and the versions footer) shows the live tree, gated by `agents_enable`. Agent starts come from `agent.spawn`. Agent status comes from polling `$.agent.list()` every 1 s, because it has no change event and no timestamps, and `completed` is not final. Shell starts come from a Bash `tool.call` result with `backgroundTaskId`. Shell and agent ends come from `prompt.submit` with origin kind `task-notification` (observe only, `return next(e)`); only TaskStop kills are silent. One pure, guarded `parseTaskNotification(text)` is the only code that reads that XML: it requires `<task-id>` and `<status>`, matches only ids already held, and returns `undefined` otherwise (#15). An agent's failure reason comes from `classic.StopFailure` (`agent_id`, `error` word), then the notification summary, then the status word (#13); `classic.SubagentStop` never fires for a failed agent. Elapsed time comes from `$.clock.now()`. Never open the sidebar with `holdToasts`. Details: `docs/agents/research/toasts-agents-shells.md`.

Toasts are queued, not stacked, and titled with the plugin `name`. The live prototype showed bursts making later toasts stale, so keep the queue short: shorter `timeoutMs` for start toasts, and drop a start toast once its finish toast is queued. The human chose one toast per event (variant a) on 2026-10-03.

Reason: The human agreed this split in the open-claude-mod session: toasts are short-lived and unstyled, so they suit events and not lists. Mockup: `prototypes/opencode-skin-preview.html`.

## Publish to Anthropic's plugin directory and to npm

Applies when: changing the layout, manifest, dependencies, licensing, or release process.

Guidance: Keep every structural choice compatible with both channels: Anthropic's official plugin directory and an npm package.
- `ctui/` must contain its own README (at least 40 words, stating the tested Claude Code version and disclosing that the mod watches Bash and agent events in every session) and its own LICENSE. The repo-root files don't count.
- `ctui/package.json` has no dependencies, no scripts, no lockfile, and a `files` whitelist. The dev `package.json` and lockfile stay at the repo root.
- The npm name `ctui` is taken. Use the scoped `@a1exk-dev/ctui` unless the human decides otherwise.
- Releases: bump both version fields on `release/x.y.z`, merge to `main` (the default branch, which the directory follows), tag `vX.Y.Z`. A tag workflow runs the checks, publishes to npm with provenance, and creates the GitHub release.
- Any network call needs disclosure, an opt-out, and a privacy policy URL.

Details: `docs/agents/research/publishing-catalog-npm.md`.

Reason: The human set both channels as publishing targets.

## Display name is `ctui`, and the plugin is a TUI skin, not only a sidebar

Applies when: writing the manifest, the README, listing text, or describing scope.

Guidance: Set `displayName` to `ctui`. The repo and marketplace stay `claude-tui`. Describe the plugin as a skin for Claude Code's TUI: it covers the Sidebar and the lines under the prompt input (model, effort, permission mode), and later other render sites.

Reason: Anthropic's directory holds names that match a known brand for review. The human chose `ctui` and noted the scope is wider than the sidebar.

## Update indicator reuses Claude Code's own update notice; the mod makes no network call

Applies when: working on the `versions` sidebar plugin or anything that would fetch remote data.

Guidance: The footer shows the installed version from `$.session.version()`. It shows an update icon only when Claude Code itself announces an update, observed through render sites such as `PromptHint` `hint` or `InfoNotice` `text`. Never fetch release data from the mod. Whether and where the native notice can be observed is **unverified**. The probe is in `prototypes/toasts-mod` (it logs `native hint →` and `native notice →` lines).

Reason: The human asked for "the same way we receive native claude info about update". Staying network-free avoids the directory's disclosure, opt-out and privacy-policy requirements.

## `tsc` runs against vendored engine types

Applies when: running or fixing `tsc`, changing `tsconfig.json`, or moving to a new Claude Code version.

Guidance: The root `tsconfig.json` type-checks `ctui/` against `vendor/claude-code-types/{claude-code,claude-code-tools}`, copied from the `ctui/.claude-plugin/types/` the engine writes when it loads `claude --plugin-dir ./ctui`. On a Claude Code version bump, load the plugin once, copy those two folders into `vendor/`, and update the tested version in `ctui/README.md`. Leave `claude-code-mcp` out: it lists the MCP tools of the session that loaded it. `ctui/tsconfig.json` is the engine-written editor config and is not used by `scripts/check.sh`.

Reason: CI has no Claude Code session to generate the types, and the generated folder is gitignored by the engine.
