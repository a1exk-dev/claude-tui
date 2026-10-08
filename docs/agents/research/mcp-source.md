# Labelling an MCP server's source in the `mcp` Sidebar plugin (Claude Code 2.1.292)

Scope: #167. How the `mcp` Sidebar plugin can put each server's source (`user`, `project`, `local`, `claude.ai`, a plugin's name) on its row, as #165's `<source> · <status>` needs. It must do this without probing (MEMORY.md "The `mcp` Sidebar plugin reads live tools and the disabled list; it never probes") and with only `register.tsx` touching `$` (MEMORY.md "Sidebar plugins are pure"). This builds on `claude-mcp-status-access.md`, which covers status, not source. Every claim cites a primary source or a run. **Unverified** marks what neither source settles.

**Source keys**

- **DTS**: the API types this build writes when the `plugin-authoring` skill loads: `/tmp/claude-1000/bundled-skills/2.1.292/<hash>/plugin-authoring/types/claude-code.d.ts` (21,215 lines, header "Written by Claude Code 2.1.292"). Line numbers are for that copy.
- **CC:x Ln**: `https://code.claude.com/docs/en/x.md`, fetched 2026-10-08, at that line.
- **BIN**: strings of `~/.local/share/mise/installs/claude/2.1.292/claude`. The code is minified, so names like `zA` are this build's alone. Grep the quoted fragment to find each one again. Bundle-only, so unstable.
- **R1–R5**: the runs in §6. Throwaway code is in `prototypes/research-167/` (gitignored).

## 1. Summary

| Question | Answer |
|---|---|
| Can the mod read the source without probing? | **Yes.** No live API names a server's scope for every row. But `claude.ai` and plugin sources come from the server's name, and the scopes `user`, `local` and `project` come from config files that `register.tsx` can read with `$.fs` (R3). Claude Code uses the same lookup itself (§4). |
| Can `register.tsx` read `~/.claude.json` and `.mcp.json`? | **Yes**, with `$.fs.stat`/`$.fs.read` and absolute paths (R3). `$.fs.read` rejects files over 4 MiB (DTS L3192). This machine's `~/.claude.json` is about 116 KB. |
| When to re-read? | When the file's mtime changes, which the 1 s tick already checks for `disabledMcpServers`. Also on `session.start` and `classic.CwdChanged`. No mod event fires on an MCP config change (§3). Claude Code also doesn't reconnect servers when the files change mid-session (R3). |
| `--mcp-config` | Scope `dynamic`. It is in no file the mod can read, and it beats every other scope for a shared name (R1). |
| Managed / enterprise | `managed` (`managedMcpServers` in managed settings) and `enterprise` (`/etc/claude-code/managed-mcp.json`). Both are readable: `$.settings.read({ source: 'policy' })` and `$.fs.read`. |
| claude.ai connectors | Scope `claudeai`. The `/mcp` name starts with `claude.ai ` and the tool segment starts with `claude_ai_` (R2, R3). |
| Plugin servers | Source `plugin`. The `/mcp` name is `plugin:<plugin>:<server>` (R3). |
| Same name in more than one scope | One definition loads, never merged. The order, highest first: `dynamic` > `managed` > `local` > `project` > `user`. Plugins and connectors rank below those and are de-duplicated by endpoint (§4; R1, R2). |

## 2. What the mod can see per server

### 2.1 Live APIs: no source field, except on tool calls

- `$.tool.list()` entries are `{ name, description, mcp }`. They have no server and no scope (DTS L12926-12940).
- `tool.describe`'s `e.provider` is an `Origin {plugin, tier}`. "A configured MCP server's tool is `mcp:<server>`, in `prepend` when the policy settings source configures the server, else `user`" (DTS L12846-12853). So `tier: 'prepend'` marks a managed/enterprise server (not tested: it needs root to deploy a policy). Otherwise it gives the name, not the scope. In R3 every configured server read `tier=user`.
  - **Correction for `ctui/hooks/register.tsx`:** a plugin server's tools gave `provider=src167@inline` (`<plugin>@<marketplace>`), not `mcp:plugin:src167:pstub` (R3). The `^mcp:(.+)$` match in the `tool.describe` hook therefore skips plugin servers. Their label falls back to `labelOfSegment`, which strips `plugin_[^_]+_`. That fallback is wrong for a plugin name containing `_`.
- `McpServerProvenance {name, source}` is the authoritative source. `name` is the config key (for a plugin, `plugin:<p>:<s>`) and `source` is one of `sdk | plugin | user | project | local | dynamic | managed | enterprise | claudeai | agent`, "an open set" (DTS L5918-5928). It is on the classic hook inputs `PreToolUse`, `PermissionRequest`, `PermissionDenied`, `PostToolUse` and `PostToolUseFailure` (DTS L7428, L7455, L7805, L7818, L7917).
  - In a mod, `classic.PreToolUse`'s `e` is the `tool.call` envelope and lacks it (DTS L1236; R3 logged `null`). `classic.PostToolUse` has it: `{"name":"dup","source":"project"}` and `{"name":"plugin:src167:pstub","source":"plugin"}` (R3).
  - It arrives only when Claude calls one of the server's tools, so it can correct a row but can't fill every row.
- `system/init.mcp_servers[].source` and the `mcp_status` control response (`scope`, `source`) carry the same value (R1, R3). Both exist only in a headless or SDK process, and reaching them from the mod would be a probe.

### 2.2 From the name alone

- **claude.ai:** `/mcp` name `claude.ai <Name>`, tool segment `claude_ai_<Name>` (R2, R3). Claude Code itself falls back to `startsWith("claude_ai_")` → `"claudeai"` when no config holds the name (BIN `function v0o(e){…if(!r&&n.serverName.startsWith("claude_ai_"))return"claudeai";return r?.scope??null}`).
- **Plugin:** the config key is `plugin:<plugin>:<server>` (BIN `let S=\`plugin:${n}:${g}\`;s[S]={...h,scope:"dynamic",source:n,…}`; R3 `system/init` name `plugin:src167:pstub`). The tool segment is `plugin_<plugin>_<server>` after `[^A-Za-z0-9_-]` → `_`. The plugin name is the second `:` field of the `/mcp` name, as the disabled list or `classic.PostToolUse` gives it.

### 2.3 From config files (user, project, local, managed, enterprise)

| Scope | Where | How `register.tsx` reads it |
|---|---|---|
| `user` | `<config>/.claude.json` top-level `mcpServers` (CC:mcp L596-598; BIN `case"user":{let s=ce().mcpServers`) | `$.fs.read`, the file `readDisabled` already parses. `<config>` is `$CLAUDE_CONFIG_DIR`, else `$HOME` |
| `local` | `<config>/.claude.json` `projects[<git root>].mcpServers` (CC:mcp L547-562). **Keyed by the git root, not the cwd** (R2): an entry under the cwd key `…/proj/sub` didn't load, while the git-root entry did | Same parse; same `projectOf($)` key as `disabledMcpServers` |
| `project` | `.mcp.json` in the cwd **and every ancestor up to (not including) `/`**, applied from the top down so the nearest file wins per name (BIN `case"project":{…while(w!==J$o(w).root)h.push(w),w=Q$o(w);for(let H of h.reverse()){…Object.assign(s,…)`). The walk crosses the git root (R2 `aboveroot`). It starts at `--project-config-root` when that flag is set (BIN `w=fo()??S`) | `$.fs.exists` + `$.fs.read` per ancestor. `$.fs.ancestors` won't do: it takes only `.md` names (DTS L4840-4870) |
| `managed` | `managedMcpServers` in managed settings (CC:managed-mcp L160-166) | `$.settings.read({ source: 'policy' })` (DTS L11730-11736). Not tested: no policy on this machine |
| `enterprise` | `/etc/claude-code/managed-mcp.json` on Linux (CC:managed-mcp L60-66; BIN `function ySn(){return p5(Jk(),"managed-mcp.json")}`). When present, it is exclusive: only it, `managedMcpServers` and a few in-process servers load (CC:managed-mcp L45-54) | `$.fs.read`. Not tested |
| `dynamic` | `--mcp-config` files or JSON strings (CC:cli-reference L107), and SDK `mcp_set_servers` | **Not readable.** The mod sees no argv. Infer by elimination (§5) |
| `agent` | a subagent's frontmatter `mcpServers` (BIN `case"agent":return"agent frontmatter"`) | Out of scope: the main thread's `tool.list` shows the session's tools |

- R3 confirmed that a mod reads `~/.claude.json` (`claude.json read ok size=115440`) and both ancestor `.mcp.json` files from `session.start`. It recorded key names only.
- **Secrets:** each server entry can hold `env`, `headers`, `oauth` and `${VAR}`-expanded args (CC:mcp L623-640). Keep only `Object.keys(mcpServers)`; never store an entry in `$.state`.
- **Project approval.** In an interactive session an unapproved `.mcp.json` server doesn't load. A server is approved when `enabledMcpjsonServers` lists it or `enableAllProjectMcpServers` is set, and it is rejected when `disabledMcpjsonServers` lists it (BIN `function e7e(e){…disabledMcpjsonServers…"rejected"…enabledMcpjsonServers…||n?.enableAllProjectMcpServers)return"approved";return"pending"}`). Under `-p` all are loaded unasked (CC:mcp L588). A pending or rejected project server never shadows a user or local server of the same name (BIN `zA`: `if(Wt in Y||Wt in G||Wt in S||Wt in he)continue`). This matters only on a name clash (§4).

## 3. When to re-read

- **No mod event fires on an MCP config change.**
  - `classic.ConfigChange` covers settings files, managed policy and skills only: `source: 'user_settings' | 'project_settings' | 'local_settings' | 'policy_settings' | 'skills'` (DTS L1901-1905; CC:hooks L2746-2760). It covers neither `.claude.json` nor `.mcp.json`.
  - The core event list has only `mcp.call` and `mcp.connect` (`claude-mcp-status-access.md` §1.1).
- **`watchPaths` works but isn't worth it.** A mod's `classic.SessionStart` may return `watchPaths` (DTS L1299-1301, L1353), and `classic.FileChanged` then fired for both `~/.claude.json` and `.mcp.json` (R3). But:
  - A `touch` of `~/.claude.json` (mtime only) raised nothing, while Claude Code's own startup write did. So it is no more precise than the mtime poll.
  - The watch list is the session's, so it also runs the person's own `FileChanged` settings hooks on those paths (CC:hooks L2898-2905).
  - A `CwdChanged` hook's `watchPaths` replaces the dynamic list (CC:hooks L2842-2846), so ctui would have to re-assert it.
- **The live set doesn't follow the files.** Renaming `pu` to `pu2` in `.mcp.json` mid-session left `mcp__pu__…` in `$.tool.list()` and added nothing (R3). Claude Code reads MCP config at startup, on `/cd` (it "applies the new directory's … `.mcp.json` servers … and the local-scope MCP servers", CC:permissions L591-602), and for plugin servers on `/reload-plugins` (CC:mcp L493-495).
  - A re-read can therefore show a name that isn't live (harmless: rows list only live or disabled servers). It can also lose a live server that someone removed from the file. That row then falls back as in §5.
- **Recommendation.**
  - Derive the user and local name sets in the same parse `readDisabled` already does when `~/.claude.json`'s mtime changes. That is free: the file is already being read.
  - Read the ancestor `.mcp.json` files, the policy settings and `managed-mcp.json` on `session.start` (which also fires on every reload) and on `classic.CwdChanged`. `CwdChanged` has `old_cwd` and `new_cwd` (DTS L3597-3601).
  - After `/cd`, the cached project key in `readDisabled` (`claudeJson ??= { … project: await projectOf($) … }`) is stale too. Reset it on `classic.CwdChanged`.

## 4. Same name in more than one scope

- **Docs:** "When the same server is defined in more than one place, Claude Code connects to it once, using the definition from the highest-precedence source. The entire server entry from that source is used; fields are not merged across scopes" (CC:mcp L605-607). The list is local, project, user, plugin-provided, claude.ai connectors (CC:mcp L609-613).
  - `managedMcpServers` "ranks above all of these" (CC:mcp L619).
  - A `--mcp-config` server of the same name "replaces the provided one for that run" (CC:managed-mcp L209).
  - Plugins and connectors are matched **by endpoint**, not name (CC:mcp L615). A connector shadowed this way shows as hidden in `/mcp` (CC:mcp L1161). Claude Code also warns about same-name conflicts in `claude mcp list` and `/mcp` (CC:mcp L287).
- **Binary:** `zA` builds the set as `Object.assign({}, <plugins after endpoint dedup>, user, project(approved), local, managed)`, and `zD` lays the claude.ai connectors underneath (`Object.assign(WA(),G,r)`). With an `enterprise` file present (`i_()`), only `{...managed, ...enterprise}` load. Claude Code's own scope lookup for a name walks `["enterprise","managed","local","project","user"]` and returns the first hit (BIN `_6t=[...y6t,"local","project","user"]`, `function Bz(e)`).
- **Live (R1, R2):** one stub per definition, whose only tool is named after it (`t_<label>`), so the connected tool shows which definition won:

| name defined in | loaded |
|---|---|
| user, project (cwd), project (parent), local, `--mcp-config` | `dynamic` (`t_dynamic`) |
| user, project (cwd), project (parent), local | `local` (`t_local_gitkey`) |
| project, user | `project` |
| project (cwd), project (parent) | the cwd's file (`t_project_cwd_pd`) |
| user, `--mcp-config` | `dynamic` |

- **Order for the mod:** `dynamic` > `enterprise`/`managed` > `local` > approved `project` (nearest file) > `user`.
  - `plugin:*` and `claude.ai *` names are their own namespace, so they never collide by name.
  - `dynamic` can't be seen. A user, local or project name that `--mcp-config` overrides is therefore mislabelled with the file's scope until a `classic.PostToolUse` for that server says `dynamic`.

## 5. Proposed labelling rule

For each live row, from its `/mcp` name (from the disabled list, `tool.describe`, or the segment):

1. Take `classic.PostToolUse`'s `mcp_server.source` for this name if one has arrived this session. It is authoritative (DTS L5918-5928).
2. If the name starts with `claude.ai `, or the segment with `claude_ai_`, the source is `claude.ai`.
3. If the name is `plugin:<p>:<s>`, or the segment is `plugin_…`, the source is `<p>`.
4. Otherwise, the first of `enterprise`, `managed`, `local`, approved `project`, `user` whose name set holds the name.
5. Otherwise `dynamic`, by elimination. The other leftovers are `sdk` and `agent`, which an interactive terminal session rarely has. Showing no source instead is the safer choice if the human prefers.

The loaders are top-level `$` functions in `register.tsx` that store only the name sets in `$.state`. `ctui/hooks/mcp.ts` stays pure and gains a `sources` input. No process runs and no server is contacted.

## 6. Runs (reproducible)

All runs use `prototypes/research-167/`:
- `stub.mjs <label>` is a stdio MCP server whose only tool is `t_<label>`.
- `probe.sh <cwd> [args]` sends the `mcp_status` control request (`claude-mcp-status-access.md` E5) and prints only `name | scope | source | status | tools`.
- `cfg/` and `cfg2/` are throwaway `CLAUDE_CONFIG_DIR`s, so the real `~/.claude.json` was never edited.

- **R1** `CLAUDE_CONFIG_DIR=cfg probe.sh proj/sub --mcp-config dyn.json`. `dup` was defined in user, `proj/.mcp.json`, `proj/sub/.mcp.json` and `--mcp-config`, and loaded `scope=dynamic` with `t_dynamic`. `pu` (user + project) loaded `project`. `onlyparent` (only in `proj/.mcp.json`) loaded `project`. A local entry keyed by the cwd didn't load.
- **R2** As R1 without `--mcp-config`, and with `projects` keyed both by the cwd and by the git root. `dup` loaded `local` from the **git-root** key (`t_local_gitkey`); `onlylocal_cwd` didn't load. `pd` (cwd and parent `.mcp.json`) loaded the cwd's. A separate tree (`scratchpad/walk/outer/.mcp.json` above `outer/repo/.git`, cwd `outer/repo/sub`) loaded `aboveroot` with `scope=project`. The real config at the repo root gave `playwright scope=user` and `claude.ai Claude Docs scope=claudeai`.
- **R3** The throwaway mod `probe-mod/`: a plugin with its own `.mcp.json` server `pstub`, run as `claude -p --input-format stream-json … --model haiku --plugin-dir probe-mod` from `proj/sub` with the real config. The model called `mcp__dup__t_project_cwd` and the plugin tool. The mod logged:
  - `$.fs` reads of `~/.claude.json` and both ancestor `.mcp.json` files;
  - `tool.describe` providers (`mcp:dup`, `mcp:claude.ai Claude Docs`, plugin `src167@inline`, all `tier=user`);
  - `classic.PreToolUse` `mcp_server` = `null`;
  - `classic.PostToolUse` `mcp_server` = `{"name":"dup","source":"project"}` and `{"name":"plugin:src167:pstub","source":"plugin"}`;
  - `classic.FileChanged` for `~/.claude.json` (Claude Code's own write at startup; a later `touch` raised nothing) and for `.mcp.json` after an edit;
  - `$.tool.list()` unchanged after renaming `pu` in `.mcp.json`.

  `system/init.mcp_servers` listed `source` per server (`plugin`, `user`, `project`, `claudeai`).

## 7. Unverified

- `tool.describe` `tier: 'prepend'` for managed and enterprise servers, and the shape of `$.settings.read({ source: 'policy' }).managedMcpServers`: no policy can be deployed here without root.
- Whether `classic.PostToolUse` carries `mcp_server` the same way in an interactive session (R3 ran under `-p`; the DTS doesn't distinguish).
- How `/cd` and `classic.CwdChanged` order against the live tool list (the docs say the servers swap "as soon as you move").
- Whether `--project-config-root` changes the `local` key as well as the `.mcp.json` walk.
