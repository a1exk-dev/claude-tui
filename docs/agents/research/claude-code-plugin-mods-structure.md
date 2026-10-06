# Claude Code plugin and mod structure, and a repo layout for claude-tui

> Researched 2026-10-03 against Claude Code **2.1.288** (`claude --version`).
>
> Source keys used below:
>
> - `SK` is the text of the built-in `plugin-authoring` skill, loaded with the Skill tool in this session. It has no line numbers.
> - `SKR` is that skill's `reference.md`, and `EX/<file>` is one of its `examples/`. Both live in the bundled skill directory `/tmp/claude-1000/bundled-skills/2.1.288/0fc27b210b0beaee937878c1dda55fa0/plugin-authoring/`, which is ephemeral and rewritten whenever the skill loads.
> - `DTS` is `types/claude-code.d.ts` in that same directory. Its header reads "Written by Claude Code 2.1.288". `L` gives line numbers.
> - `CC:<page>` is `https://code.claude.com/docs/en/<page>.md`, fetched 2026-10-03. `L` gives line numbers in that `.md` file. The docs index is `https://code.claude.com/docs/llms.txt`. The old URLs `/plugins-reference` and `/plugin-marketplaces` now serve the same content as `plugins/manifest-reference` and `plugins/create-marketplace`.
> - `GH:cc` is `github.com/anthropics/claude-code` at the latest `mods/` commit, `6160717` (2026-10-01). `GH:po` is `github.com/anthropics/claude-plugins-official` (main). `GH:pg` is `github.com/anthropics/claude-code-playground` (main). All were read with `gh api`.
> - `E1`–`E3` are experiments run in this session's scratchpad with `claude plugin validate` and `tsc` (§7).
> - `EXAMPLE:` marks a third-party plugin installed on this machine. It shows real-world practice and is not an authority.

## 1. Summary

- **A mod is an ordinary plugin with one hooks module.** You need three files: `.claude-plugin/plugin.json`, `hooks/hooks.json` containing `{"modules": ["./register.tsx"]}`, and the module itself, which exports `register(on, options)` (CC:plugins/mods/reference L15-27; SK). A mod that keeps `$.state` adds a fourth file, `types/index.d.ts`, and names it in `plugin.json` under `"types"` (SK; CC:plugins/mods/reference L24).
- **TypeScript loads directly, with no bundler or build step.** The engine accepts `.ts`, `.tsx`, `.mts`, `.cts`, `.js`, `.jsx`, `.mjs` and `.cjs`. Every file is treated as an ES module. A module can import only files inside the plugin, plus the bare specifier `claude-code`. Dynamic `import()` is refused (CC:plugins/mods/create L12, L309-316; DTS L14-27).
- **No runtime mechanism exists for CSS or SCSS.** Importing a `.css` file fails validation (E1). Styling has three forms:
  - Ink-like props on `Box` and `Text`. Colors are a Claude Code theme key or a raw color (DTS L741-900, L11866-11893).
  - A Claude Code theme JSON shipped in the plugin's `themes/` folder, which recolors the native UI (CC:plugins/components L923-945; CC:terminal-config L141-170).
  - CSS inside an `Svg` element. This works only on the desktop, VS Code and mobile surfaces, never in the terminal (DTS L11570-11605).
- **Hot reload works for a `--plugin-dir` folder and for the session's dev-mods folder.** A save re-runs `register`, fires `session.start` again, keeps `$.state` and `$.store`, and resets module variables and timers (SK; SKR L68-69).
- **Distribution goes through a marketplace.** A repo can be its own marketplace through `.claude-plugin/marketplace.json` at the repo root (CC:plugins/marketplace-reference L33, L138).
- **The plugin cannot be named `claude-tui`.** `claude plugin validate` rejects any name that starts with `claude-` (CC:plugins/manifest-reference L169-178; E1). `"displayName": "claude-tui"` passes (E3), and so does a marketplace named `claude-tui` (E2).
- **The design renders map onto a docked `Pane`.** The pane docks beside the transcript in the fullscreen terminal at 110 or more columns. Folding sections can be built from `Button` plus `$.state`. A sketch of this validated and type-checked (E3).
  - The main gaps are data rather than drawing: MCP status, the todo list and background shells have no direct read API. Subagents do: `$.agent.list()`.
  - The sidebar's frame and chrome, the prompt input box, and the main background color are not under a mod's control (§4).

## 2. Official plugin structure

### 2.1 Manifest (`.claude-plugin/plugin.json`)

`name` is the only required field. Use kebab-case, because every component is namespaced under it (CC:plugins/manifest-reference L118-130, L163-167). The fields that matter here:

| Field | Note | Source |
|---|---|---|
| `name` | Required. `claude plugin validate` rejects names that start with `claude-`, `anthropic-`, `anthropics-` or `cc-plugin-`, and the exact names `claude`, `claude-code` and `claude-mods`. Claude Code still loads a plugin with such a name, but `init` and `tag` refuse it. | manifest-reference L169-178; E1 |
| `displayName` | Shown in place of `name`. Not used for namespacing. | L180-184; E3 accepted `"claude-tui"` |
| `version` | Pins users to this version until it changes. Bump it on every release. | L186-188; CC:plugins/host-marketplace L192 |
| `description`, `author{name}`, `homepage`, `repository`, `license`, `keywords` | Metadata. `homepage` must parse as a URL, or the plugin fails to load. | L130-135 |
| `types` | A `.d.ts` file declaring the mod's `$.state` values and any `$` nouns it adds | L146 |
| `userConfig` | Options. A mod receives them as `options`, and `/config` shows them as rows. A `string` field can be limited to listed `options`. | L421-487; SKR L70 |
| `dependencies` | Other plugins. Their type contracts are laid into `.claude-plugin/types/<plugin>/` | L208; SKR L62 |
| `experimental.themes` | Replaces the default `themes/` scan | L157 |
| `settings` | Only `agent` and `subagentStatusLine` take effect. A plugin cannot set the main `statusLine`. | L212-214 |

### 2.2 Directory layout and components

The standard layout, with each component's default location, is at CC:plugins/manifest-reference L609-660.

- **Component folders.** `skills/<name>/SKILL.md`, `commands/`, `agents/`, `hooks/hooks.json`, `.mcp.json`, `.lsp.json`, `output-styles/`, `workflows/`, `themes/<slug>.json`, `monitors/monitors.json`, `bin/` and `settings.json`.
- **Placement rules.** Only the manifest goes inside `.claude-plugin/`; every other file sits at the plugin root (L34). Component paths must stay inside the plugin root (L400-405).
- **No `CLAUDE.md` in the plugin.** A `CLAUDE.md` at the plugin root is not loaded, and `validate` warns about it (L663).
- **Mixed `hooks.json`.** One file can hold settings hooks under `hooks` and the mod under `modules`. An official example does this: GH:po `plugins/code-modernization/hooks/hooks.json`.

**Official boilerplates.** There is no scaffold for mods. `claude plugin init` scaffolds a different kind of plugin, one built on command hooks (SKR L9). The closest official templates are:

- `GH:po plugins/example-plugin`: a plain plugin with commands, skills and `.mcp.json`. It has no mod.
- `GH:cc mods/{diff,agents-md,sec-default,telemetry}`: the built-in mods, written in TypeScript, with `tests/` and a shared `mods/tsconfig.json` and `mods/types/claude-code.d.ts`. The GitHub copy of the d.ts still says 2.1.277.
- `GH:pg claude-code/mods/{token-weather,blast-radius,replay-theater}`: single-file `.mjs` mods with a `.gitignore` that excludes `.claude-plugin/types/`, plus a `.claude-plugin/marketplace.json` at the folder root.
- `GH:po plugins/code-modernization`: a large TypeScript mod with `hooks/register.ts`, `hooks/views/*.tsx`, `hooks/views/palette.ts`, `tests/*.test.ts` and a `tsconfig.json`.

**EXAMPLE: claude-hud 0.8.0** (`~/.claude/plugins/cache/claude-hud/claude-hud/0.8.0/`) shows a common shape and its cost.

- **Shape.** The repo is both the plugin and its marketplace (`marketplace.json` uses `"source": "./"`), and it ships a `package.json`, a `package-lock.json`, `src/`, and a compiled `dist/`.
- **Cost.** The whole repo is copied into the cache, and Claude Code ran an npm install there. That install put dev dependencies such as `c8` under `node_modules`. The cached copy is 45 MB.
- **Cause.** CC:plugins/loading L205-235 explains the behavior: an install runs whenever the plugin root has both a `package.json` and a lockfile.

## 3. Mods (function hooks)

### 3.1 API shape

- **Registering hooks.** `on(event, matcher?, hook)` registers a hook, and every hook has the form `($, e, next)`.
  - `$` is the engine interface: each call is written `$.noun.method`.
  - `e` is the event's input, a frozen plain value.
  - `next(e)` runs the hooks beneath this one and then the engine's own behavior.
  - A hook can return without calling `next`, which answers the event itself. It can also call `next({...e, x})`, which rewrites what the rest of the chain sees (SK; CC:plugins/mods/reference L29-42).
- **Execution environment.** There is no DOM and no Node. Everything outside the module goes through `$`. JSX compiles against the global `h`, and elements come from `$.ui.resolve(e)` (SK; DTS L17-27).
- **Static analysis rules.** Event names must be string literals. `$` calls must be written in full. `on` must not be shadowed (CC:plugins/mods/create L309-316).
- **Event groups.** Tools, prompts, commands and config, turns, session, subagents, interface (`ui.*`), other mods, telemetry, `classic.<Event>`, and every `$` method, which is also an event (CC:plugins/mods/reference L44-158).
- **`$` nouns.** `plugin`, `ui`, `command`, `tool`, `agent`, `model`, `prompt`, `turn`, `session`, `config`, `settings`, `env`, `fs`, `store`, `state`, `clock`, `http`, `process`, `mcp`, `audio`, `telemetry` (CC:plugins/mods/reference L164-186; DTS L2136-3400).

### 3.2 Surfaces and render sites

| Surface | What it means | Source |
|---|---|---|
| `Pane` | Docked beside the transcript in the fullscreen terminal from 110 columns, otherwise inline above the prompt. Opened with `$.ui.open({id,title,focus,closeOnEscape,holdToasts,rows,columns})`. A pane the person opens shows at any width. One the mod opens unasked needs 144 columns, or 110 once the person has opened it before. | DTS L2274-2296, L6933-7000, L9632-9662; CC:plugins/mods/interface L296-338 |
| `AbovePrompt` (band) | A strip above the prompt that all mods share | CC:plugins/mods/interface L186-208 |
| Status line entry | `$.ui.status(text)`: one pinned line per plugin, under the prompt | DTS L2262-2273 |
| Toast | `$.ui.toast(text,{timeoutMs})`, shown at the top right | DTS L2247-2261 |
| Native rows | The render sites `UserMessage`, `AssistantMessage`, `ToolUse`, `ToolResult`, `ToolGroup`, `CommandOutput`, `AskUserQuestion`, `ToolProgress`, `Spinner`, `TurnDuration` (terminal only), `InfoNotice`, `SessionMode` and `PromptHint`. The permission prompt cannot be restyled. | DTS L8712; CC:plugins/mods/reference L188-216; CC:plugins/mods/overview L83 |

**Elements.** Every surface has `Box`, `Text`, `Button`, `Link`, `Code` and `Markdown`. Only the terminal has `Raster` and `Image`. The desktop, VS Code and mobile surfaces have `Svg`. The terminal and desktop have `Client` (DTS L3587-3660).

**Where drawing appears.** Mod drawings appear in the terminal and in the desktop app's Code tab only. Hooks still run in VS Code, under `-p`, and in the SDK, but nothing draws there (CC:plugins/mods/overview L186-200).

### 3.3 Lifecycle and limits

- **Load and session start.** `register` runs once per load. `session.start` fires before the first prompt and again after each reload. It does not fire after `/clear`. Its hooks are awaited, which makes it the right place to call `$.command.register` and `$.tool.register` (CC:plugins/mods/reference L105; SKR L122-131).
- **Session end.** `session.end` hooks get 1.5 s in total (CC:plugins/mods/reference L247).
- **Hook budget.** Each hook gets 10 s of its own time, and `next.signal` aborts when the event is abandoned.
- **Redraw throttling.** Redraws are capped at 10 per second, or 30 per second for the visible pane, band and hint line in the terminal.
- **Pane width.** A pane opened unasked needs 144 columns, as described in §3.2.
- **Storage.** `$.store` holds up to 4 MiB of JSON (CC:plugins/mods/reference L239-258).
- **State.** `$.state` holds session values the host keeps across reloads. Reading one while drawing subscribes the drawing to it. Writes happen from handlers through `update()`, and a render hook must never write (SKR L88; EX/pane.tsx, EX/pane-state.d.ts).

### 3.4 Styling: TUI and desktop

- **Element props.** `Box` takes flex layout, gap, padding, margin, width and height, `borderStyle`, `borderColor`, `backgroundColor`, `overflow`, `display: none|flex`, `position: absolute` with cell offsets, and `hover`. `Text` takes `color`, `backgroundColor`, `bold`, `italic`, `underline`, `strikethrough`, `inverse`, `dimColor` and `wrap` (DTS L716-900, L11845-11893).
- **Colors.** A color is "a theme key or a raw color" (DTS L11866-11867). A theme key such as `claude`, `success`, `error`, `warning`, `suggestion` or `inactive` follows the user's theme.
  - Official practice keeps these keys as TypeScript constants (GH:po `plugins/code-modernization/hooks/views/palette.ts`).
  - Theme tokens are listed at CC:terminal-config L195-262.
- **Plugin themes.** A plugin's `themes/<slug>.json` has the shape `{name, base, overrides}`. It appears in `/theme`, is read-only, and only applies once the user selects it (CC:plugins/components L923-945).
  - No token sets the main transcript background: the token list has none (CC:terminal-config L195-262).
- **Surface differences.**
  - The terminal draws a Button as `[ label ]`, or just `label` with `plain`. The desktop draws its own native look, `variant="primary"` gives each surface its own primary style, and `role="dismiss"` maps to the desktop's native close control (SKR L101).
  - `Svg` with `isInteractive` allows CSS `:hover` and SMIL, but not in the terminal (DTS L11570-11605).
  - `Raster` and `Image` are terminal-only, so a desktop drawing needs a text-based fallback (DTS L3592).
- **CSS and SCSS.** Neither is supported anywhere in the module graph (DTS L20-23; E1).

### 3.5 TypeScript and build

- **No build step.** The engine loads `.ts` and `.tsx` itself (CC:plugins/mods/create L12).
- **Generated types.** At each load from a folder the person owns (`--plugin-dir`, `CLAUDE_CODE_PLUGIN_DIRS`, or dev-mods with hot reload on), the engine writes `.claude-plugin/types/{claude-code,claude-code-tools,claude-code-mcp,<dep>}/index.d.ts` and a `tsconfig.json`. If the mod has no `tsconfig.json`, the engine adds one at the mod root that extends the generated one (CC:plugins/mods/create L268-286; SKR L33-52). There is no command to run (SK).
- **Compiler options and TypeScript version.** The official options are `target/lib es2023`, `types: []`, `module esnext`, `moduleResolution bundler`, `strict`, `noUncheckedIndexedAccess`, `noEmit`, and `jsx: react` with `h`/`Fragment` (DTS L63-77; GH:cc `mods/tsconfig.json`). TypeScript 5.4 or newer is required (DTS L8).
- **Imports.** Extensionless directory imports resolve: `import Ask from './ask'` in GH:cc `mods/diff/hooks/register.ts`.
- **Tooling.** `claude plugin validate <dir>` runs the engine's static analysis; `--strict` and `--json` are available. `claude plugin test [dir]` runs `*.test.ts` and `*.test.tsx` files against the engine, using `claude-code/testing` (`test`, `expect`, `mock`, `$.ui.mount` per surface). It needs no session, sign-in or network (CC:plugins/mods/create L288-358; CC:plugins/mods/reference L282-288; SKR L75).

### 3.6 Hot reload

- **Watched folders.** A `--plugin-dir` folder, a `CLAUDE_CODE_PLUGIN_DIRS` folder, and the skills-folder plugins are watched in an interactive session.
- **Reload timing.** Saves made during Claude's own turn reload when the turn ends. Saves from outside reload once the folder has been quiet for about 0.25 s.
- **What a reload does.** It runs `register` again in a fresh environment and drops the old timers.
- **Headless sessions.** A long-lived headless session needs `CLAUDE_CODE_PLUGIN_DIR_WATCH=1` to watch.
- (SKR L68-69; CC:plugins/mods/create L250; CC:plugins/mods/reference L266-267.)
- **Installed copies do not hot-reload.** They are cached by version, so a change needs a version bump and a reinstall. Develop against `--plugin-dir` instead (CC:plugins/mods/create L371).
- **Dev-mods folder.** It is gated by a one-time "Enable hot reloading for this session?" prompt that only the person can answer (SK). This report wrote nothing there.

### 3.7 Distribution

- **Install path.** A mod installs as a plugin from a marketplace: `/plugin install <name>@<marketplace>` (CC:plugins/mods/overview L35-48).
- **Marketplace file.** `marketplace.json` requires `name`, `owner` and `plugins[]`. A relative `source` resolves from the marketplace root, which is the directory that contains `.claude-plugin/`, and must start with `./` (CC:plugins/marketplace-reference L33, L56-74, L138, L159).
- **What gets installed.**
  - Only the plugin directory is copied to `~/.claude/plugins/cache/<mkt>/<plugin>/<version>/`. Files outside it are not copied (CC:plugins/loading L180-188).
  - If the plugin root has both `package.json` and a lockfile, Claude Code installs dependencies there (L205-235).
  - A hooks module cannot import npm packages anyway (CC:plugins/mods/create L314).
- **Reserved marketplace names.** These are listed at CC:plugins/marketplace-reference L39-50. `claude-tui` passed validation (E2).
- **Kill switches.** `disableAllHooks`, `--safe-mode`, and the managed setting `allowManagedModsOnly` (CC:plugins/mods/overview L95-107).

## 4. What the design renders need vs what the API offers

The renders are `docs/design/sidebar-{1-all-folded,2-some-folded,3-all-expanded}.png`.

- **Sidebar.** A right sidebar of about 42 columns: a cwd/git header, five folding sections (Context, Limits, MCP, Todo, Agents & shells), and a version footer.
- **Main column.** An opencode-style skin over the transcript. `prototypes/opencode-skin-preview.html` lays its CSS out in cells "so it maps 1:1 to a mod tree" (its L10-11).

| Render element | API that supports it | Status |
|---|---|---|
| Docked right sidebar | `Pane` with `placement:'dock'`, `columns: 42` requested, `bodyColumns` read. Needs the fullscreen renderer (research preview, CC:fullscreen L10) and 110 or more columns. | **Supported**, with conditions |
| Sidebar frame, tabs, borderless look | The engine draws the frame and tabs. With one pane open no title is drawn (DTS L9634-9640). | **Gap / unverified**: a borderless full-height dock is not documented |
| Section fold (`▸`/`▾`) | No disclosure element exists. Use `Button plain label="▸ Context"` with per-section booleans in `$.state`. | **Supported**: E3 validated and type-checked a sketch |
| Context bar, tokens, cost | `$.session.usage()` returns `context.{tokens,window,percent}` and `cost` (CC:plugins/mods/reference L174; DTS L2622-2642). Draw bars as `Text` block glyphs; `Raster` is terminal-only. | **Supported** |
| Limits (5h, week, resets) | `usage().rateLimits[]` returns `{kind, percentUsed, resetsAt}` (DTS ~L10600-10611) | **Supported** |
| cwd, branch, ahead/behind, status counts, lines changed | `$.session.cwd()` and `$.session.repo()`, plus `$.process.run(['git',...])` (DTS L2571-2600, L3307) | **Supported**. The built-in `diff` mod does the same. |
| MCP list with ● ✕ ○, tool counts, "failed" | `$.mcp` has only `call` and `connect` (DTS L2493-2528). `$.tool.list()` marks tools with `mcp:true` (DTS L12262-12276). | **Partial.** Per-server status needs a workaround; see `claude-mcp-status-access.md`. |
| Todo `2/8` with item states | No read API. Derive the list from `tool.call` inputs of `TodoWrite` or `TaskCreate`/`TaskUpdate`; the tool table declares `TodoWrite` and `TaskCreate` (DTS L15613, L15654). | **Partial, unverified**: which tool 2.1.288 actually uses is unknown |
| Agents & shells, nested, with elapsed times | Agents: `$.agent.list()` (CC:plugins/mods/reference, "Mods API methods") returns `id`, `description`, `type`, `status`, `parentId`, `spawnedBy`, `name`, with no timestamps and no change event, so poll it (verified by spike: toasts-agents-shells.md). Shells: no list API. Possible signals: `tool.call` with `agentId` for nesting, `UserMessage` task notifications (`e.props.task.status`), and `classic.Stop` `background_tasks[]` (DTS L642-665, L11423-11433). Timers via `$.clock.every`. | Agents **supported**; shells **partial, unverified** |
| "↓ more" inside a section; footer pinned at the bottom | A tree taller than the pane scrolls as a whole (CC:plugins/mods/reference L216). Window long lists yourself with `Box height`/`overflow:hidden` plus a Button, and size the tree to `e.props.scroll.bodyRows` to pin the footer. | **Workaround**, untested |
| Footer versions | `$.session.version()` (DTS L2659). The mod's own version comes from `$.fs.read` on `${$.plugin.root}/.claude-plugin/plugin.json`. | **Supported** |
| User message `┃` bar, tool rows `→ Read`, diff block | `UserMessage`, `ToolUse`, and `ToolResult` with `Code` in diff format (CC:plugins/mods/reference L196-199; SKR L100) | **Partial**: see `claude-cli-customization.md` §4 |
| Turn footer `⊡ accept edits · model · 12.3s` | `TurnDuration`, terminal only (DTS L9466-9469) | **Supported** in the terminal |
| Meta row under the prompt (model · effort · mode) | `SessionMode` and `PromptHint` (`hint`, `tail`) (DTS L9524-9567) | **Partial** |
| Prompt box ("Ask anything", border) | No render site exists. Only the `promptBorder` theme token applies. | **Gap** |
| Background `#0a0a0a` and panel `#141414` | No main-background theme token exists (CC:terminal-config L195-262). Set it in the terminal emulator. `Box backgroundColor` works inside mod trees. | **Gap** for the main area, **supported** inside the pane |
| Desktop Code tab | `Pane` and the other sites render there. No `Raster` or `Image`. `Svg` is available. | **Supported**, text-only bars |

## 5. Corrections to the old research

**`claude-mods.md`**

1. **§2.4 (L150) lists `model.response` as an event.** No such event exists. The event tables list `turn.start`, `turn.step` and `turn.complete` (CC:plugins/mods/reference L87-95).
2. **§2.4 (L127) says hooks "share state" through module variables.** This is true, but module variables reset on every reload. A drawing's state belongs in `$.state` (SKR L88; CC:plugins/mods/create L250).
3. **§2.3–2.4 frame the hooks module as JavaScript (`register.js`).** TypeScript and TSX are first-class and load with no build step (CC:plugins/mods/create L12; CC:plugins/mods/reference L23).
4. **§2.4 (L152) gives an incomplete list of built-in mods.** `cc-plugin-plugin-authoring` and `cc-plugin-you-should-know` are missing (CC:plugins/mods/overview L226-233).
5. **§8 (L593) rates plugins and mods as "Production".** The API is marked "EARLY ACCESS: may change between releases without notice" (DTS L4; SKR L5).
6. **§8 (L606) says no official theme store exists.** That is literally true, but plugins can ship `themes/*.json` through any marketplace (CC:plugins/components L923-945).
7. **The header date "2025-10-03"** is a typo for 2026, as `claude-cli-customization.md` L56 already notes.

**`claude-cli-customization.md`**

1. **L450 tells you to run `/plugin-types`.** The skill says "there is no command to run": types are laid into `.claude-plugin/types/` at every load (SK; CC:plugins/mods/create L272-282). Whether `/plugin-types` still exists was not checked (**unverified**).
2. **The `d.ts` line citations come from the 2.1.277 GitHub copy.** That copy is still 2.1.277 at `6160717`. Line numbers in 2.1.288 differ: for example, `RenderComponent` is now at DTS L8712, where the doc cites 7459.
3. **L69 says `Spinner` is terminal only.** In 2.1.288 it is raised on the terminal and desktop (DTS L9426-9436; CC:plugins/mods/reference L202).
4. **L115 says invalidation is throttled to 10/s.** The limit is 10/s, or 30/s in the terminal for the visible pane, the expanded band and the hint line (CC:plugins/mods/reference L254).
5. **§5.3 sketch (L340-360) keeps `sidebarOpen` in a module variable and calls `$.ui.invalidate`.** Both are lost on reload. Use `$.state` and `$.ui.panes()` instead: "a module reloaded while its pane stayed up finds it here" (DTS L2310-2323).
6. **L431 says "there is no CSS".** This is confirmed (E1). One nuance: an `Svg` can carry CSS on non-terminal surfaces (DTS L11597-11605).
7. **§5.3 names the mod `opencode-skin`.** That name passes validation; the repo name `claude-tui` does not (E1).

**`claude-mcp-status-access.md`**: no contradiction found. `$.mcp` is still exactly `call` and `connect` (DTS L2493-2528; CC:plugins/mods/reference L184).

## 6. Recommended repo structure

```text
claude-tui/                          repo root = marketplace root
├── .claude-plugin/
│   └── marketplace.json             "name":"claude-tui" (passes, E2); plugins[0].source "./ctui"
├── ctui/                            the installable plugin (named for plugin "ctui", avoiding plugin/plugins/); only this dir is copied to users' cache (loading L187)
│   ├── .claude-plugin/
│   │   ├── plugin.json              "name":"ctui", "displayName":"claude-tui", version, types, userConfig (§6a, §6b)
│   │   └── types/                   engine-written d.ts + tsconfig at each --plugin-dir load; gitignored
│   ├── commands/                    markdown command stubs, namespaced by path (CC:plugins/components L684)
│   │   ├── theme.md                 /ctui:theme [name]
│   │   └── plugins/{enable,disable}.md   /ctui:plugins:enable [name], /ctui:plugins:disable [name]
│   ├── hooks/
│   │   ├── hooks.json               {"modules":["./register.tsx"]}
│   │   ├── register.tsx             THE ONLY FILE THAT TOUCHES $: literal on(...) calls, command handlers, data loaders (§6b)
│   │   ├── config.ts                flat userConfig options + $.store overrides → typed SidebarConfig
│   │   ├── sidebar.tsx              pure: lays out enabled sidebar plugins, fold state passed in
│   │   ├── pickers.tsx              pure: Select list used by /ctui:theme and /ctui:plugins:* with no argument
│   │   ├── skin/                    pure: native render-site rewrites (user-message, tool-use, turn-duration, prompt-hint)
│   │   └── style/{palette,glyphs}.ts   theme keys by default; theme-file resolver (§6a)
│   ├── plugins/                     sidebar plugins, one folder each; pure modules (§6b)
│   │   ├── index.ts                 static registry: imports every plugin (no dynamic import allowed)
│   │   ├── git/index.tsx            header: path, branch, ahead/behind, status, lines changed
│   │   ├── context/index.tsx
│   │   ├── limits/index.tsx
│   │   ├── mcp/index.tsx
│   │   ├── todo/index.tsx
│   │   ├── agents/index.tsx         "Agents & shells": live subagents (tree) and background shells; owns the agent/shell toast option
│   │   └── versions/index.tsx       footer
│   ├── themes/*.json                Claude Code theme files {name, base, overrides}; also listed in /theme
│   ├── types/index.d.ts             $.state contract: interface PluginState { 'ctui': {...} }
│   ├── tests/                       *.test.ts(x) for `claude plugin test ctui`
│   ├── tsconfig.json                official options; include [".claude-plugin/types","hooks","plugins","types","tests"]
│   └── README.md                    states the tested Claude Code version
├── scripts/check.ts                 typecheck, validate --strict (plugin + marketplace), test, and registry consistency (§6b)
├── vendor/claude-code-types/        pinned copy of the engine d.ts for CI
├── tsconfig.json                    CI type-check: vendor + ctui/**
├── package.json, package-lock.json  dev-only (typescript >=5.4); kept OUT of ctui/ so no npm install runs in users' cache
├── docs/agents/                     agent ops docs and research (this file)
├── docs/design/                     accepted renders = visual spec
├── prototypes/                      throwaway HTML/CSS previews; the only place CSS lives
└── AGENTS.md, CLAUDE.md, CONTEXT.md, MEMORY.md
```

Correction to the first draft of this tree: it had `hooks/sources/` as "data readers taking `$`". Validation rejects that. Passing `$` to a function imported from another file fails (CC:plugins/mods/create, "Check what Claude Code reads from your mod"). Every `$` call therefore lives in `register.tsx`.

- **Toolchain.** Use plain `tsc --noEmit` (TypeScript 5.4 or newer). Do not add a bundler or emit step: the engine loads the TypeScript sources directly. Suggested package scripts:
  - `typecheck` runs `tsc -p .`.
  - `validate` runs `claude plugin validate ctui && claude plugin validate .`. The second command checks the marketplace.
  - `test` runs `claude plugin test ctui`.
  - Use one test runner, the engine's kit. Plain helpers are testable through it too.
- **SCSS and CSS.** Nothing reaches the runtime. Express styles as TypeScript tokens in `ctui/hooks/style/` and as the optional `themes/*.json`. Keep CSS in `prototypes/` only.
  - A SCSS-to-token build step has no official precedent and would add a build where none is needed. Not recommended.
- **Dev loop.** Run `claude --plugin-dir ./ctui` in a fullscreen terminal 110 or more columns wide. Reloads happen on save. Copy the engine-written d.ts into `vendor/` when you move to a new Claude Code version.
- **Release.** Bump `ctui/.claude-plugin/plugin.json` `version`, then merge. Users run `/plugin marketplace add a1exk-dev/claude-tui` and `/plugin install ctui@claude-tui`. A private repo needs git credentials on the user's machine (CC:plugins/host-marketplace, not detailed here).

## 6a. Plugin settings: sections and theme

Requirements (from the human):

- Each sidebar section has its own config, shaped like `context { enable: true }`.
- Colors inherit the user's current Claude Code theme by default.
- The user can switch the sidebar to any file in the plugin's `themes/` folder from plugin settings.
- `/claude-tui:theme [theme_name]` switches the theme. With no argument, it opens a list.

### Settings surface: `userConfig`

- Options are declared in `plugin.json` `userConfig`. Each option is strict: `type` (`string`, `number`, `boolean`, `directory`, `file`), `title`, `description`, and optionally `default`, `required`, `options` (a fixed picker for `string`, v2.1.271+), `multiple`, `sensitive`, `min`/`max` (CC:plugins/manifest-reference, "User configuration").
- Users are prompted when they enable the plugin. Every non-sensitive, non-`multiple` option is also a `/config` row (v2.1.269+). Values are saved under `pluginConfigs` in `settings.json` (same page).
- The mod receives the values as `register(on, options)`, with defaults filled in (CC:plugins/mods/reference, "Files").
- **No nesting.** Keys are flat identifiers (letters, digits, `_`; no leading digit), and there is no `object` type (same page). `context { enable: true }` therefore becomes the flat key `context_enable`. The code regroups it into `{ context: { enable: true } }`, so a later per-section option such as `context_<option>` slots into the same object.

### Section config

| Section | Key | Default |
|---|---|---|
| Header: path, branch, ahead/behind, file status, lines changed | `git_enable` | `true` |
| Context | `context_enable` | `true` |
| Limits | `limits_enable` | `true` |
| MCP | `mcp_enable` | `true` |
| Todo | `todo_enable` | `true` |
| Agents & shells | `agents_enable` | `true` |
| Agent/shell toasts | `agents_toasts` | `true` |
| Footer: versions | `versions_enable` | `true` |

```json
"context_enable": {
  "type": "boolean",
  "title": "Context section",
  "description": "Show the context-window section in the sidebar",
  "default": true
}
```

`hooks/config.ts` turns the flat `options` into a typed `SidebarConfig` (`{ context: { enable }, ... , theme }`). The sidebar builds its sections from a `SECTIONS` table and skips the disabled ones. Fold state (`$.state`) is separate from enablement.

### Theme

- **Inherit by default.** `Text`/`Box` colors accept a Claude Code theme key such as `claude`, `success`, `error`, `warning`, `suggestion` or `inactive`, and a key follows the user's current theme (CC:plugins/mods/interface, element table; DTS L11866-11867). Default palette = theme keys only, so the sidebar matches whatever `/theme` the user chose.
- **Theme files.** The plugin's `themes/<slug>.json` uses Claude Code's theme shape `{ name, base, overrides }` (CC:plugins/components L923-945). Using that same format for the sidebar keeps one format. Each file is then also selectable for the whole CLI in `/theme`, and the mod reads it for the sidebar:
  - Read it with `$.fs.read($.plugin.root + '/themes/<slug>.json')`. Resolve each color as `overrides[key] ?? key`, so missing keys still inherit.
  - List the files with `$.fs.list($.plugin.root + '/themes')` (CC:plugins/mods/api, "Reach files…").
  - Caveat: the file's `base` is ignored for the sidebar. Missing keys come from the user's live theme instead.
  - Do not put sidebar-only theme files with another shape in `themes/`. Claude Code scans that folder as CLI themes.
- **Setting.** `theme` is a `string` `userConfig` option with `options: ["inherit", "<slug>", ...]` and `default: "inherit"`. `options` is a static list in the manifest, so a check script must keep it equal to the files in `themes/`.
- **Command.** A mod registers a command with `$.command.register({ name, description, argumentHint })` in `session.start` and handles it in `command.run`. `e.args` is the text after the name. Return `{}` to print nothing (CC:plugins/mods/api, "Add a command"). Plan:
  - `/…theme <name>` sets the theme.
  - `/…theme` alone opens a pane (`$.ui.open({ id: 'theme-picker', focus: true, closeOnEscape: true })`) that draws a `Select` of `inherit` plus the slugs. `onSelect` sets the theme and closes the pane (CC:plugins/mods/interface, "Respond to presses and typing").
  - The command changes the theme for the sidebar only. The whole-CLI theme stays the user's `/theme` choice.
- **Decision (human):** plugin `name` is `ctui` with `displayName` `claude-tui`. The command is the markdown file `commands/theme.md`, which gives `/ctui:theme`, and a mod `command.run` hook handles it (route 3 below; verify that interception works in the dev loop, and fall back to a mod-registered `/ctui-theme` if it doesn't).
- **Command name: conflict.** Mod command names allow only letters, digits, `_` and `-` (CC:plugins/mods/reference, "Limits"). The docs example `/standup` shows no plugin prefix. So `$.command.register` cannot produce `/claude-tui:theme`. Two routes:
  1. **Plugin named `claude-tui`, with a `commands/theme.md` file.** That file is namespaced `/claude-tui:theme` (CC:plugins/manifest-reference, `commands`), and a mod `command.run` hook would intercept it. Problems:
     - `claude plugin validate` reports an **error** for a `claude-` name, and `init`/`tag` refuse it, though Claude Code still installs and loads the plugin (CC:plugins/manifest-reference, `name`). CI cannot run `validate --strict` cleanly.
     - Whether `command.run` fires for plugin markdown commands is **unverified**.
  2. **Mod-registered `/claude-tui-theme`** (hyphen), with the plugin under a valid name. Validates cleanly.
  3. **Short valid plugin name plus `commands/theme.md`**, for example `ctui` → `/ctui:theme`. Validates cleanly. The same interception question as route 1 applies.
- **Writing the setting from the command: unverified.** `$.config.set` exists, and `config.set`/`config.describe` fire for `/config` rows (CC:plugins/mods/reference). Whether a mod can write its own `pluginConfigs` value through it is not documented.
  - If it can, the command writes `theme` there, giving one source of truth.
  - If not, the command saves an override in `$.store` (`theme`). Effective theme = store override ?? `options.theme`. Changing the `/config` row clears the override through a `config.set` hook.
- **Live update: unverified.** Whether a `/config` change reloads the mod or re-runs `register` with new `options` is not documented. Mitigation: keep the effective config in a `$.state` atom, so writes redraw (CC:plugins/mods/interface, "Keep a value in $.state"). Refresh that atom from a `config.set` hook.

## 6b. Sidebar plugins

Requirements (from the human):

- Every sidebar section is a module in a `plugins/` folder.
- Each one is enabled or disabled through config, or with `/ctui:plugins:enable [name]` and `/ctui:plugins:disable [name]`.
- With no name, the command opens a selection list, as `/ctui:theme` does.

### Constraints from the mods runtime

All from CC:plugins/mods/create, "Check what Claude Code reads from your mod":

- Imports must be static `import` declarations of files inside the plugin directory. A dynamic `import()` fails validation, so `plugins/index.ts` imports every plugin explicitly. Discovering plugins at runtime is not possible.
- `$` can be passed only to functions declared at the top level of the same file. Passing `$` to an imported function fails validation, so sidebar plugins cannot call the mods API.
- Event names in `on(...)` must be string literals, so plugins cannot register their own hooks.

### Shape of a sidebar plugin

Each plugin is pure: data in, element tree out.

```ts
// ctui/plugins/context/index.tsx
export default definePlugin({
  id: 'context',            // = folder name = userConfig key prefix
  title: 'Context',
  needs: ['usage'],         // snapshot fields register.tsx must load
  view: (data, ui, cfg) => /* tree from ui.Box/ui.Text */,
})
```

- `register.tsx` owns data loading. Each loader is a top-level function: `loadUsage($)` → `$.session.usage()`, `loadGit($)` → `$.process.run(['git', ...])`, `loadMcp($)`, `loadTodo($)`, `loadVersions($)`.
- `register.tsx` runs only the loaders that some enabled plugin `needs`, and keeps the snapshot in `$.state` so writes redraw.
- `ui` is the element set from `$.ui.resolve(e)`, passed as a value, not as `$`. That `ui` passed this way validates is **unverified**. The docs forbid only passing `$`, assigning it, or destructuring it.
- Benefit: plugins are unit-testable without stubbing the mods API.

### Enablement

- **Config.** One `<id>_enable` boolean `userConfig` option per plugin, default `true` (§6a).
- **Commands.** The files `commands/plugins/enable.md` and `commands/plugins/disable.md` are namespaced by path, giving `/ctui:plugins:enable` and `/ctui:plugins:disable` (CC:plugins/components L684). A mod `command.run` hook handles them. That this interception works is **unverified**, the same question as §6a. The fallback is mod-registered `/ctui-plugins-enable`.
  - With a name, the command sets an override in `$.store` key `enabled.<id>`, which keeps one key per plugin (CC:plugins/mods/interface, "Save from more than one session").
  - With no name, it opens a picker pane with a `Select`. `enable` lists the disabled plugins and `disable` lists the enabled ones. It shares `pickers.tsx` with `/ctui:theme`.
  - With an unknown name, it returns `{ text }` listing the valid ids.
- **Effective state:** `store override ?? options.<id>_enable`. The `/config` row and the command can disagree. Whether the command can write the `/config` value directly through `$.config.set` is unverified (§6a). If it can, drop the store override.
- **Consistency check** (`scripts/check.ts`): plugin folders = `plugins/index.ts` imports = `<id>_enable` keys in `plugin.json`. Also `themes/*.json` slugs = `theme.options`.

### Agent and shell toasts (agreed in the open-claude-mod session)

- Toasts report events, and the `agents` sidebar plugin shows the live list. Toasts can't hold a list that stays on screen.
- Messages:
  - `◆ <type> started: <label>`
  - `$ <command> started in background`
  - `✓ <type> done · <label> · <elapsed>`
  - `✗ <type> failed: <reason>`
- Toasts are one line under the plugin's name, at the top right, 4 s by default (`timeoutMs`), dismissed by a click. Claude Code draws the box itself, so only the text is ours (CC:plugins/mods/api, "Show something without starting a turn"; CC:plugins/mods/interface, `$.ui.open` `holdToasts`).
- Sources (superseded in detail by `toasts-agents-shells.md`):
  - `agent.spawn` fires before a subagent starts (CC:plugins/mods/reference, "Subagents"), and `$.agent.list()` gives status changes.
  - A shell's start is a `tool.call` with `tool: 'Bash'` and `run_in_background`. Its end arrives as a `session.append` row with origin kind `task-notification` (status, summary). Completed and failed shells always notified in the spike. Only a TaskStop kill is silent (toasts-agents-shells.md).
- `register.tsx` emits the toasts, because sidebar plugins can't call `$.ui.toast`. They are gated by `agents_toasts`, so turning off the section and turning off the toasts are separate switches.
- Sidebar rendering from the mockup:
  - `◐` for running, in the permission-mode color, with a ticking timer.
  - `└` indents a nested agent under its parent.
  - `$` prefixes a shell.
  - Finished items show `✓`/`✗` for 8 s, then drop.
  - "nothing running" when empty.
  - The heading count is the number running.

### Naming note

"Plugin" now means two things: the Claude Code plugin `ctui`, and a sidebar plugin in `ctui/plugins/`. `CONTEXT.md` defines **Sidebar plugin** so docs and tickets stay unambiguous.

## 7. Experiments (reproducible, scratchpad only)

- **E1.** A plugin named `claude-tui` whose `register.ts` does `import './theme.css'`. `claude plugin validate` returns two errors:
  - `Plugin name "claude-tui" is reserved…`
  - `cannot import "./theme.css" … is not named like code and was not loaded`
- **E2.** A marketplace named `claude-tui` with an entry `{"name":"tui-skin","source":"./p"}`. Validation passes with only metadata warnings.
- **E3.** A plugin `tui-skin` with `displayName:"claude-tui"`. It has `types/index.d.ts` declaring `PluginState['tui-skin'].folded` and a `register.tsx` with a `/sidebar` command, `$.ui.open({id:'sidebar',columns:42})`, a Pane render with a `Button plain` fold toggle backed by `atom`/`read`/`update`, and `$.session.usage()`.
  - `claude plugin validate` passes.
  - `tsc` 5.x against DTS passes with exit 0.
  - A first attempt failed until the contract exported a type at top level: `export {}` is refused, with the message "a contract exports types and nothing else".

## 8. Open questions

1. **Plugin `name`.** It must not start with `claude-`. Candidates: `tui-sidebar`, `opencode-skin`. `displayName` can stay `claude-tui`.
2. **Docked pane chrome.** Can a docked pane be borderless, full height, with a pinned footer? This needs a live test (**unverified**).
3. **Todo source in 2.1.288.** Is it `TodoWrite` or `TaskCreate`/`TaskUpdate`? And can `UserMessage` task notifications plus `classic.Stop` `background_tasks` drive "Agents & shells" live? (**unverified**)
4. **MCP status.** Is the partial signal acceptable, or is the shadow `claude` probe from `claude-mcp-status-access.md` §6 worth the cost?
5. **Desktop scope.** Is the desktop Code tab in scope? If so, bars must be `Text`-based, and the tests should loop over both surfaces.
6. **Fullscreen dependency.** Docking depends on the fullscreen renderer, which is a research preview. Decide the fallback when the pane is placed inline.
7. **Theme JSON.** Should the plugin ship `themes/opencode.json`? It only applies after the user picks it in `/theme`.
