# Memory

## Plugin name is `ctui`

Applies when: naming the plugin, its commands, or install instructions.

Guidance: Set `name` to `ctui` in `ctui/.claude-plugin/plugin.json`. Commands come from `ctui/commands/**/*.md` (subfolders add segments, as in `/ctui:plugins:enable`) as `/ctui:<command>`. `register.tsx` answers each with one literal `on('command.run', { command: 'ctui:<command>' }, ...)` hook that never calls `next`, so the markdown body never reaches the model. Keep each body a harmless "the ctui mod is not loaded" fallback. The marketplace is named `claude-tui`, so users install `ctui@claude-tui`.

Reason: `claude plugin validate` rejects plugin names that start with `claude-`. Commands a mod registers can't contain `:`. The human chose the short colon form, and #5 confirmed `command.run` catches it.

## Plugin settings are flat `userConfig` keys

Applies when: adding or changing a plugin setting.

Guidance: Name per-plugin settings `<sidebar-plugin id>_<option>`, such as `context_enable` (boolean, default `true`). Regroup them in `ctui/hooks/config.ts` into `{ <section>: { <option> } }`. The `theme` setting is a string with fixed `options` (`inherit` plus every `themes/*.json` slug) and defaults to `inherit`. Keep that list equal to the files in `themes/`.

Reason: `userConfig` has no object type and accepts only letters, digits and underscores in keys. The human asked for per-section config shaped like `context { enable: true }`.

## Sidebar colors inherit the Claude Code theme

Applies when: choosing colors in the mod or adding a theme.

Guidance: Use Claude Code theme keys (`claude`, `success`, `error`, `warning`, `suggestion`, `inactive`, ...) as the default palette. A file in `ctui/themes/<slug>.json` uses Claude Code's `{ name, base, overrides }` shape. The sidebar resolves each color as `overrides[key] ?? key`. Put nothing of another shape in `themes/`. Leave CSS and SCSS in `prototypes/` only.

Reason: Theme keys follow the user's `/theme`. Claude Code scans `themes/` as CLI themes. CSS can't reach the mod runtime. Details are in `docs/agents/research/claude-code-plugin-mods-structure.md` §3.4 and §6a.

## Sidebar plugins are pure; only `register.tsx` touches `$`

Applies when: adding or changing a sidebar plugin, a data loader, or a hook.

Guidance: Each sidebar plugin lives in `ctui/plugins/<id>/index.tsx`. It exports a `SidebarPlugin` (`ctui/plugins/plugin.ts`): `{ id, title, needs, view(data, ui, cfg) }`, and never receives `$`. `ui` is the `ElementTable` from `$.ui.resolve(e)`, resolved once per render in `register.tsx`; write views as `view: (data, { Box, Text }, cfg) => ...`. List every plugin by static import in `ctui/plugins/index.ts`. Data loaders that call `$` are top-level functions in `ctui/hooks/register.tsx`. Enablement is the `<id>_enable` option alone: `/ctui:plugins:enable|disable` writes it with `$.config.set({ key: 'ctui.<id>_enable', value })` as its last action, and every change reloads the mod with new `options`. `$.config.set` throws under `claude -p`. Keep folders, registry imports and `<id>_enable` keys identical (`scripts/check.sh` checks).

Reason: `claude plugin validate` rejects dynamic `import()`, non-literal event names, and passing `$` or `$.ui` to an imported function, but accepts the resolved table (#7). It misses an unbound tag in an imported view, so only `tsc` catches that. #6 showed the mod can write its own `/config` row. The human asked for sidebar sections as plugins in `plugins/`, toggled by config or command.

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
