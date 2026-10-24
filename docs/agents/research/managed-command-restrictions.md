# Can a managed command restriction stop ctui's `/ctui` from registering?

> Researched 2026-10-23 for [#446](https://github.com/a1exk-dev/claude-tui/issues/446), a child of [#439](https://github.com/a1exk-dev/claude-tui/issues/439).
>
> Every engine claim below was read against Claude Code **2.1.309** — the installed binary, `/home/a1exk/.local/share/mise/installs/claude/2.1.309/claude` (`claude --version` → `2.1.309 (Claude Code)`). `CONTEXT.md` "Engine-pinned expectation" and `MEMORY.md` "Engine-pinned expectations hold only on the pinned Claude Code version" both apply: none of this survives a version bump unmeasured.
>
> Source keys:
>
> - `BIN:<offset>` is a byte offset into that binary. Read it with `grep -abo -F '<needle>' <binary>` for the offset, then `dd if=<binary> bs=1 skip=<offset-N> count=<M> | tr -d '\000'`. Offsets are stable only for this one build.
> - `DTS` is `ctui/.claude-plugin/types/claude-code/index.d.ts`, the vendored engine typings. **Its header reads "Written by Claude Code 2.1.300", not 2.1.309** — it is one engine version behind the binary read here. Where the two could disagree, the binary wins and this doc says so.
> - `CC:<page>` is `https://code.claude.com/docs/en/<page>`, read 2026-10-23. Doc text was fetched through a summarising fetch tool, so doc quotes are close but not guaranteed character-for-character; the binary quotes are exact.

## 1. Answer

**No. Neither `disableCommandPluginSources` nor `strictPluginOnlyCustomization` can stop `/ctui` from registering, and neither reaches a mod's registered command, pane or hotkeys at all.**

- `disableCommandPluginSources` is not about slash commands. "Command" there names a *plugin source type* — a marketplace entry whose plugin directory is produced by running a shell command on the machine. It blocks that source type from installing, updating or loading. ctui installs from the `claude-tui` marketplace, not from a `command` source, so the key never looks at it (§2).
- `strictPluginOnlyCustomization` locks exactly four surfaces — `skills`, `agents`, `hooks`, `mcp` — and blocks only the *non-plugin* sources of them (`~/.claude/<surface>/`, `.claude/<surface>/`, `settings.json` hooks, `.mcp.json`). Commands are not one of its surfaces, and plugin-provided customisation is explicitly exempt. Its gate treats `"plugin"` as an admin-trusted source (§3).
- `$.command.register` carries no policy check whatsoever. Its only refusals are the two the typings document: the name is held by another plugin, or it collides with a built-in / user / MCP command (§4).
- What *can* stop `/ctui` is coarser and already known: anything that stops ctui's hooks module from loading at all. Four such gates exist, and `strictPluginOnlyCustomization` is **not** one of them (§6).

## 2. `disableCommandPluginSources`

### What the binary says

The settings schema's own `.describe()` text, verbatim (`BIN:240520006`):

> Controls the `command` plugin source, whose plugin directory is produced by running a marketplace-declared command on this machine. true: command-sourced plugins are never installed, updated, or re-resolved (the command never runs). false: explicitly allowed. Unset: follows allowManagedHooksOnly — an org that restricts hook execution to managed settings gets command sources disabled too. Only honored from managed settings.

It appears in the managed restriction table `Loe` as `{path:["disableCommandPluginSources"],restrictive:!0}` (`BIN:240411870`), and in the grouping `Rn.settings` alongside `allowManagedHooksOnly` and `disableAllHooks` (`BIN:240416310`). Both of those are merge-direction and policy-inheritance bookkeeping — they say which value wins when settings sources merge, not what the key enforces.

The user-visible refusal is an install/update message, verbatim (`BIN:127830468`):

> Command-sourced plugins are disabled by your organization's managed settings (disableCommandPluginSources / allowManagedHooksOnly). The plugin was not installed or updated and its command was not run.

and a `headersHelper` variant (`BIN:127245180`):

> " fetches its archive through a marketplace-declared headersHelper command, and your organization's managed settings disable marketplace-declared commands (disableCommandPluginSources / allowManagedHooksOnly). The plugin was not installed or updated and the command was not run;

### What the docs say

The `CC:settings-reference` entry for the key: "Block the `command` plugin source, which installs a plugin by running a marketplace-declared command on the user's machine. When you set it to `true`, Claude Code never runs the command, doesn't install or update command-sourced plugins, and stops loading the ones already installed." `CC:plugins/org` adds, under "Doesn't": "Doesn't affect other source types." `CC:plugins/marketplace-reference` describes a `command` source as one where "a tool installed on the user's machine produces the plugin directory".

### Agreement

Binary and docs agree completely. Neither mentions slash commands, `commands/` markdown, or `$.command.register`. The one thing the docs add that the binary text does not state is that *already-installed* command-sourced plugins "stop loading"; I did not locate that load-time check in the binary, so treat it as documented-but-unverified here. It does not change the answer for ctui either way.

**Bearing on ctui: none, unless ctui is ever distributed through a `command`-source marketplace entry. It is not.** If it ever were, the whole plugin would fail to install — `/ctui` would be the least of it.

## 3. `strictPluginOnlyCustomization`

### What the binary says

Schema `.describe()`, verbatim (`BIN:240513659`):

> When set in managed settings, blocks non-plugin customization sources for the listed surfaces. Array form locks specific surfaces (e.g. ["skills", "hooks"]); `true` locks all four; `false` is an explicit no-op. Blocked: ~/.claude/{surface}/, .claude/{surface}/ (project), settings.json hooks, .mcp.json. NOT blocked: managed (policySettings) sources, plugin-provided customizations. Composes with strictKnownMarketplaces for end-to-end admin control — plugins gated by marketplace allowlist, everything else blocked here.

The surface list is closed and exact (`BIN:240480604`):

```js
WKt=["skills","agents","hooks","mcp"]
```

The invalid-value fallback message spells out what `true` means (`BIN:240567302`):

> "strictPluginOnlyCustomization" was present but invalid; treating it as true (skills, agents, hooks and MCP servers load from managed settings and plugins only) until it is fixed.

The gate itself is one function, with its trusted-source set beside it (`BIN:244562114`, `BIN:244562256`):

```js
function sd(o){let t=pe("policySettings")?.strictPluginOnlyCustomization;if(t===!0)return!0;if(Array.isArray(t))return t.includes(o);return!1}
var p=new Set(["plugin","policySettings","built-in","builtin","bundled"]);
function EY(o){return o!==void 0&&p.has(o)}
```

`sd(surface)` answers "is this surface locked"; `EY(source)` answers "is this source admin-trusted", and `"plugin"` is in that set. Every call site in the build pairs them, e.g. `sd("mcp")&&!EY(e.source)` for an agent's frontmatter MCP servers (`BIN:251359610`).

I enumerated every call site in the binary by literal:

| Call | Count | Notes |
| :- | --- | :- |
| `sd("skills")` | 8 | includes the memory-store skills loader |
| `sd("agents")` | 4 | includes agent-frontmatter MCP |
| `sd("hooks")` | 14 | settings-file hooks, skill/command/agent frontmatter hooks, `/hooks` display |
| `sd("mcp")` | 8 | `.mcp.json`, frontmatter MCP |
| `sd("commands")` | **0** | the surface does not exist |

Two call sites settle the plugin question directly:

- The `/hooks` row-visibility function (`BIN:269855745`) branches on source before consulting the gate: `if(t.source==="pluginHook"){…return !Cr()&&(!o||s)}` and only then `return !o&&!sd("hooks")`. A plugin's hook never reaches `sd`.
- A skill's own hooks are gated as `D=(!sd("hooks")||EY(e.source))&&!P` (`BIN:270929189`) — a plugin-sourced skill passes through `EY`.

### What the docs say

The `CC:settings-reference` entry for the key: "Block skills, agents, hooks, and MCP servers from user and project sources, so they can come only from plugins or managed settings." Its per-surface sub-entries name the blocked paths; the `skills` sub-entry is the only one that mentions commands at all, and only the user/project ones: it "stops loading … custom commands from `~/.claude/commands/` and `.claude/commands/`, skills and commands under `--add-dir` directories". The `hooks` sub-entry keeps "hooks from plugins other than skills-directory plugins". `CC:plugins/loading` says a skipped skills-directory plugin is a silent skip: "`/plugin` and `claude plugin list` show no plugin and no error for a skipped folder."

### Agreement, with one wording gap

Substantively the two agree: four surfaces, plugin-provided customisation exempt.

One wording difference worth recording. `CC:plugins/org` describes the key as blocking sources "that don't come from a plugin, managed settings, or Claude Code's built-ins", while `CC:settings-reference` says "from user and project sources". The binary's trusted set — `{plugin, policySettings, built-in, builtin, bundled}` — matches the org page, not the settings reference. The settings reference is the narrower, slightly inaccurate phrasing.

**Bearing on ctui: none.** ctui is a plugin; its hooks module is a plugin-provided customisation; `commands` is not a surface this key knows about. Note the corollary for anyone reading this doc for a different reason: a person's own `~/.claude/commands/*.md` *is* blocked under the `skills` surface, so this key can clear the `/ctui` name rather than take it.

## 4. `$.command.register` carries no policy check

The implementation, `Gzr` (`BIN:252853705`), in full behaviour:

1. Looks up the current holder of the name. If another plugin holds it: throws `` `${n}: $.command.register: "/${e.name}" refused: the plugin ${y} registered it already` ``.
2. If this plugin already registered an identical spec: logs `/${e.name} unchanged; not re-registered` and returns — no re-register.
3. Otherwise searches the live command list plus built-ins for a collision. If found: throws `` `${n}: $.command.register: "/${e.name}" refused: it is the ${$zr[bQ(q)]} /${q.name}` ``, where `$zr={builtin:"built-in",plugin:"plugin's",user:"user's",mcp:"MCP server's"}`.
4. Registers, logs `/${e.name} listed`, refreshes the typeahead.

The dispatch entry for the op (`BIN:253186293`) has a `check` that validates only argument shape (`argumentHint` is a string, `immediate` is a boolean, the description is text) — no settings read, no policy read.

`DTS` line 3174 declares `register: (command: CommandSpec) => Promise<OpValueOf['command.register']>`, and its doc comment names the same two refusals and nothing else: "Registering a name again replaces it; a built-in's name is refused."

So on the question the ticket asks third — whether either managed setting interacts with `$.command.register`'s documented refusals — the answer is that there is no interaction to have. The refusals are a name-ownership check against the live registry, and managed settings are not among the things that can put a name in that registry or take ctui's out of it.

**`DTS` caveat:** the typings were written by 2.1.300 and the register implementation was read from 2.1.309. The two agree on both refusals, so nothing here rests on the version gap, but the gap is real and the file should be re-vendored when the pin moves.

## 5. Removed

A source this section rested on was ruled out on 2026-10-24, so the section is deleted. Nothing
elsewhere in this document depends on it: the answer to the ticket rests on the managed settings
schema (§3), `$.command.register`'s own refusals (§4) and the hooks-load gate (§6).

## 6. What *can* stop `/ctui`, and what the person sees

Nothing reaches the registered command, the pane or the hotkeys selectively. The only way an organization stops `/ctui` is by stopping ctui's hooks module from loading, which stops the whole mod — Sidebar included.

That decision is one function, `t6` (`BIN:253325202`), whose inputs come from `kj()`:

```js
kj=()=>({hooksDisabled:mr("hooks"),managedOnly:vy(),allDisabled:wh(),organization:Ey()})
```

- `wh()` → managed `disableAllHooks === true`.
- `vy()` → `allowManagedHooksOnly === true`, or local `disableAllHooks === true` while managed `disableAllHooks` is not.
- `mr("hooks")` → `--bare` mode, not a managed setting.
- `Ey()` → whether the organization's managed settings have been read yet.

`sd("hooks")` — `strictPluginOnlyCustomization` — **is not among them.** That is the single most load-bearing negative result in this doc: the key that sounds like it locks the hooks surface does not lock a plugin's hooks module.

The verbatim refusal reasons `t6` returns, each logged as `` `hooks module ${name} not loaded: ${reason}` `` and recorded against the plugin:

| Cause | Verbatim reason (`BIN:253325202` region) | Managed? |
| :- | :- | :- |
| managed `disableAllHooks` | "disableAllHooks in managed settings, which governs installed plugins; built-in plugins load regardless" (`BIN:125840340`) | yes |
| `allowManagedHooksOnly`, or local `disableAllHooks` | "only managed plugins and built-in plugins run (allowManagedHooksOnly / disableAllHooks)" (`BIN:125840728`) | yes |
| `--bare` | "installed plugins that are not managed load no hooks module in this mode (--bare); built-in plugins load regardless" (`BIN:125840604`) | no |
| rollout switch off | "hooks modules are turned off for installed plugins in this process: …; built-in plugins load regardless" (`BIN:125840264`) | no |
| managed settings not yet read | "this session has not read your organization's managed settings, so whether mods you installed may run here is not known; they stay out until it has; built-in plugins load regardless" (`BIN:251231055`) | transient |
| name collision with another plugin | "another plugin of that name loads first (a managed one, or an earlier source)" | no |

For the last of these the engine also shows the person a plain-language line (`BIN:251231243`):

> Mods and hooks you set up aren't running in this session, and neither are any checks they make on tool calls. This session can't read your organization's settings, so it isn't known whether your organization allows them.

Upstream of all of it, an organization can also simply keep ctui off the machine: `enabledPlugins: {"ctui@…": false}`, `strictKnownMarketplaces` / `blockedMarketplaces` excluding the `claude-tui` marketplace, `disableSideloadFlags` for `--plugin-dir`, or `syncClaudeAiPlugins: false`. Those are install-time, not registration-time.

### What the person sees, and ctui's fallback

**If the hooks module does not load**, the reasons above go to the debug log, with the managed-settings-unread case also surfacing a plain-language line in the session. ctui itself draws nothing: no Sidebar, no `/ctui`, no toast. It cannot — its own code never runs. There is no fallback to build, and none worth building: with no mod there is nothing to configure.

**If the module loads, `/ctui` always registers** unless the name is already taken, which is a plugin/user collision and not a policy matter. ctui already handles that case. `registerMenu` in `ctui/hooks/register.tsx` catches the refusal, parses the holder out of the message with `takenBy` in `ctui/hooks/menu.tsx`, and shows one toast per session:

> `/ctui is taken by <who>; change ctui settings in /config`

That toast names the real fallback, and it is a genuine one. The ticket's premise — "the `/ctui` menu is the only route to the Plugins screen" — is true of the Plugins *screen*, but not of what the screen does. Every Sidebar plugin's enablement has a `userConfig` entry in `ctui/.claude-plugin/plugin.json` (`context_enable`, `limits_enable`, `todo_enable`, `skills_enable`, `mcp_enable`, `agents_enable`), and Claude Code lists those rows in `/config`. `ctui.theme` is a `/config` row too. So the Plugins and Themes screens are a nicer route to settings that remain reachable without them.

One qualifier found while checking that: `hasConfig` in `ctui/hooks/register.tsx` notes that "`claude -p` and the SDK list no `ctui.theme` row, and `$.config.set` throws there". The `/config` fallback is interactive-session only. That is ctui's own recorded behaviour, not a policy effect, and it does not bear on the managed-settings question.

## 7. Nothing in the managed tables reaches a pane or a hotkey

Full managed-settings key list for 2.1.309, extracted from the schema region `BIN:240400000`–`BIN:240720000` (197 keys; `grep -o '[A-Za-z][A-Za-z0-9_]*:()=>'`). No key in it names panes, pane placement, docking, `Button.hotkey`, or `~/.claude/keybindings.json`. The two near-misses are both unrelated: `keybindingFlavor`, whose own describe reads "Deprecated: no longer has any effect. The prompt's word-editing keys always follow Bash (readline) conventions." (`BIN:240549482`), and `editorMode`, "Key binding mode for the prompt input".

`tui` is in the list, and it is the one setting an administrator could use to change what the Sidebar looks like: `CONTEXT.md` records that the Sidebar exists only docked, and docking needs the fullscreen TUI. An organization forcing `tui` away from `"fullscreen"` would hide the Sidebar while leaving `/ctui` registered and working. I did not measure this — it is a plausible reading of a setting name plus a recorded ctui fact, not a verified engine behaviour, and §8 lists it as unsettled.

The docs agree: `CC:keybindings` mentions no managed setting and no plugin or mod restriction, and `CC:plugins/mods/interface` states "Your mod never reads the keyboard itself. The user presses a key, Claude Code decides which of your controls it's for, and that control's callback runs." The managed-settings pane keys that do exist — `browserExternalPageTools`, `disableBrowserExternalNavigation`, `disableMobileSimulatorTools` — govern Claude Code's own Browser and iOS Simulator panes on the desktop, not a mod's pane.

## 8. What I could not determine

Stated plainly rather than inferred:

1. **Whether `tui` can be forced from managed settings, and what that does to the Sidebar.** The key is in the schema; I did not read its describe text, its merge direction, or whether a managed value overrides a user's. §7's reading is a hypothesis.
2. **Where the engine stops *loading* an already-installed command-sourced plugin.** The docs assert it; I found the install/update refusal in the binary but not the load-time check. Irrelevant to ctui, recorded for completeness.
3. **Exact doc wording.** Doc text came through a summarising fetch; the quotes in §2 and §3 are close but not guaranteed verbatim. Re-read the live pages before quoting them anywhere binding. The binary quotes are exact.
4. **Whether any of this holds above or below 2.1.309.** Every offset, every function name and the whole `WKt` surface list are minified-build artefacts. `Loe`, `Fg`, `sd`, `Gzr` and `t6` will be renamed by the next build. Re-measure, do not re-cite.
5. **Behaviour under a policy helper or remote managed settings.** I read the local merge and gate code only. Whether a remote policy source can carry something these tables do not is untested.
6. **Whether an organization's own managed mod could refuse `/ctui`.** A managed mod seated outermost hooks whatever it likes, and `command.register` is not an event any mod hooked in the surface I read. I did not verify that the engine refuses a `command.register` hook from an arbitrary mod.

## 9. Consequences for #439

- Nothing to fix in ctui for either key named in #446. No code change, no test, no live check — there is no behaviour to assert.
- If the enterprise audit becomes a durable record, the fact worth keeping is narrow and already engine-pinned: *the only managed levers that reach a mod's registered command are the ones that stop the whole mod; `strictPluginOnlyCustomization` is not one of them.* That reads as a `MEMORY.md` engine-pinned expectation under the 2.1.309 pin, not an ADR — it is a fact about the engine, not a decision with a rationale. `docs/agents/domain.md` decides.
- The `/config` fallback in §6 is a real property of ctui that no document currently states. If the Plugins screen is ever described as the only route to Sidebar enablement, that description is wrong.
