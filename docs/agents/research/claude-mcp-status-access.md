# Reading MCP server status from a Claude Code mod (for the opencode-skin sidebar)

> Researched 2026-10-03 against installed Claude Code **2.1.288** (`claude --version`; binary `~/.local/share/mise/installs/claude/2.1.288/claude`).
> Abbreviations:
> - `CC:<page>` = `https://code.claude.com/docs/en/<page>.md`, fetched 2026-10-03. `L` numbers are line numbers in that `.md` file.
> - `d.ts@277` = [`anthropics/claude-code/mods/types/claude-code.d.ts`](https://github.com/anthropics/claude-code/blob/main/mods/types/claude-code.d.ts) at commit `684800b` (2026-09-29). Header: "Written by Claude Code 2.1.277".
> - `d.ts@288` = the declarations embedded in the 2.1.288 binary. They are stored as the zstd blob `/$bunfs/root/claude-code.d.ts-816aab49.txt.zst` and decompress to 14,971 lines. This is the text `/plugin-types` writes. `/plugin-types` adds a one-line `// Written by Claude Code 2.1.288.` header, so its line numbers are this file's plus 1.
> - `E1`…`E6` = experiments I ran on this machine (§5). Each one gives its command so you can reproduce it.
> - Labels: **documented** (official docs or the d.ts), **bundle-only** (found in the minified binary but not documented, so unstable), **observed** (behavior seen in an experiment), **not found**.

---

## 0. Verdict

- **A mod cannot read live MCP server status. Confirmed.** `$.mcp` has `call` and `connect` and nothing else. The docs say so (CC:plugins/mods/reference L184; CC:plugins/mods/api L181), the types agree (d.ts@288 2489-2528), the runtime agrees (`$.mcp.list` throws "is not a function", E2), and the bundle builds `$.mcp` from exactly those two calls (bundle-only, §2.3). No `mcp.status`, `mcp.list` or `mcp.servers` event, method or render site exists. `McpConnectRefusal` reasons (`disabled`, `auth`, `failed`, …) apply **only to servers listed in the mod's own plugin manifest** (d.ts@288 5569-5605; E2: `connect("playwright")` → `unlisted`).
- **The earlier finding was right but incomplete.** Two documented mod APIs reveal which servers currently have tools:
  - `$.tool.list()`: entries with `mcp: true`, named `mcp__<server>__<tool>` (d.ts@288 2797-2806, 12261-12275).
  - `$.session.usage({ breakdown: "summary" })`: `context.breakdown.mcpTools[]` with `serverName` and `tokens`, free to call (d.ts@288 2010-2028, 10223-10225, 11046-11055).
  - From these you get **"has N tools" against "no tools"**, but you cannot tell failed from needs-auth from pending from disabled (E3).
- **Statusline stdin and hook inputs carry no server list or status.** Statusline JSON has no MCP field (CC:statusline L168-215). Hook inputs carry `mcp_server {name, source}` only on per-tool events (CC:hooks L1594). `SessionStart` has none (CC:hooks L1122-1124).
- **Full status, with all five states and tool counts, exists only in the headless/SDK control protocol.** It is the `mcp_status` request behind the Agent SDK's documented `mcpServerStatus()` (CC:agent-sdk/typescript L589, L629, L4763-4788). A mod can reach it by running a **second, headless `claude` process** with `$.process.run` and asking it `mcp_status` (E5, ≈2 s, no model turn).
  - It reports that process's own connections, not the interactive session's.
  - The wire envelope is undocumented: the method is documented, but the bytes on stdin are not.
- **Recommendation (§6):**
  - **Tier A**, in-process and cheap, polled every few seconds: list configured servers, mark each one ● if it has tools (with a count) or ○ if not.
  - **Tier B**, the shadow probe, run on demand and on a slow timer: fill in why a ○ server is down (`failed` / `needs auth` / `disabled` / `pending`) and any error text.
  - **Fallback for Tier B**: the documented `claude mcp list`, which gives status words but no tool counts.

---

## 1. Sources checked and what each says about MCP status

### 1.1 Mod API (`$`)

| What | Status | Evidence |
|---|---|---|
| `$.mcp` = `call`, `connect`. `connect(server)` only connects a server **your own plugin's manifest lists** | documented | CC:plugins/mods/reference L184; CC:plugins/mods/api L181 ("`$.mcp` \| `call` a tool on a connected MCP server"); d.ts@288 2489-2528 |
| `$.mcp` in 2.1.277 had only `call`. `connect` arrived between 2.1.277 and 2.1.288 | documented (diff of d.ts) | d.ts@277 2319-2340 vs d.ts@288 2492-2527 |
| `McpConnectResult` = `{isConnected:true, server}` or `{isConnected:false, reason, message}`. `reason` ∈ `unlisted \| unapproved \| disabled \| policy \| auth \| failed` | documented, but only for own-manifest servers | d.ts@288 5569-5605 |
| Mod events `mcp.call` / `mcp.connect` exist, but they are the *op events of those two calls*: they intercept other plugins' calls and say nothing about server lifecycle | documented | d.ts@288 6436-6449 (`OpEventOf`); CC:plugins/mods/reference "Mods API calls" (every method is also an event) |
| The full core event list contains **no** MCP lifecycle event (`mcp.status`, `mcp.connected`, …) | not found | `grep` of the `'<noun>.<verb>':` keys in d.ts@288. The only MCP ones are `mcp.call` and `mcp.connect` |
| `$.tool.list()` → `ToolInfo {name, description, mcp: boolean}`, "the tools the model can call now, built-in and MCP alike" | documented | d.ts@288 2797-2806, 12261-12275; CC:plugins/mods/reference (`$.tool` row: `register, call, check, list`) |
| `$.session.usage({breakdown})` → `context.breakdown.mcpTools: ContextMcpTool[]`, each `{name, serverName, tokens, isLoaded}`. `"summary"` "estimates locally and sends none" (no API call) | documented in d.ts, only partly in the docs (the docs mention `usage()` but not `breakdown`) | d.ts@288 2010-2028, 2617-2641, 10223-10225, 11046-11055; d.ts@277 1895-1912, 8749, 9240 |
| `tool.describe` event: fires once per tool when its description is first sent to Claude. `e.provider` for a configured MCP server's tool is `mcp:<server>`, using the **display name** | documented | CC:plugins/mods/reference L58; d.ts@288 12163-12189 |
| `$.settings.read()` reads settings files only: "The OAuth session and the global config (~/.claude.json) are not settings and are never read" | documented | d.ts@288 3343-3369 |
| `$.fs.read`, `$.process.run(argv, {stdin, timeoutMs, env})` (no shell, 30 s default timeout, ≤10 min), `$.process.spawn` (input written then **closed**) | documented | CC:plugins/mods/api L166-187; d.ts@288 7537-7556, 7624-7646 |
| `$.command.run({command, args})` runs a slash command "as if the person typed" it | documented | d.ts@288 2858-2870, 1598-1603 |
| Render sites: none is MCP-specific (`RenderComponent` = AskUserQuestion, UserMessage, AssistantMessage, ToolUse, ToolResult, ToolGroup, ToolProgress, CommandOutput, Spinner, TurnDuration, InfoNotice, SessionMode, PromptHint, AbovePrompt, Pane) | documented | d.ts@288 8711 |
| Type root: the engine writes `.claude-plugin/types/claude-code-mcp/`, "the MCP tools connected when the mod last reloaded" (typings only, not a runtime API) | documented | d.ts@288 77-80 |

### 1.2 Status line

- The stdin JSON field table and full schema have **no MCP field** (CC:statusline L168-215 field table; full schema accordion follows).
- MCP errors appear only as Claude Code's own notifications on the status-line row: "System notifications like MCP server errors … display on the right side of the row" (CC:statusline L1217). A script can't read these.
- Verdict: **not available**.

### 1.3 Settings hooks (`hooks.json` / settings) and `classic.*` events in mods

- `SessionStart` input: `source`, optional `model`, `agent_type`, `session_title`, and the resume cost fields. **No MCP list** (CC:hooks L1122-1135; d.ts@288 10953-10975).
- At launch, `SessionStart` fires *before* MCP servers are available: "Claude Code skips their `mcp_tool` hooks" (CC:hooks L584).
- `PreToolUse`, `PermissionRequest`, `PostToolUse`, `PostToolUseFailure` and `PermissionDenied` carry `mcp_server: {name, source}` for MCP tools (CC:hooks L1594, L1893, L2099, L2214; d.ts@288 5635-5644, 7023, 7050, 7400, 7413, 7512). This is provenance per call, not status.
- `Elicitation` / `ElicitationResult` carry `mcp_server_name` (CC:hooks L3372, L3442).
- `Notification` types are `permission_prompt`, `idle_prompt`, `auth_success`, `elicitation_*`, `agent_*` and `quota_auto_resume_*`. None is MCP connect/disconnect (CC:hooks L311).
  - The "MCP server … disconnected · open /mcp to reconnect" notice (CC:mcp L372) is **not** exposed as a hook. Not found.
- Verdict: you can **infer activity** from tool calls, but there is **no status feed**.

### 1.4 CLI and config files

- **`claude mcp list`** prints a health status per server: `✔ Connected`, `! Needs authentication`, `✘ Failed to connect` (with detail since 2.1.219), `⏸ Pending approval`, `⊘ Disabled for this project`, `not configured` and `✘ Connection error` (CC:mcp L244-252, L276, L284; changelog 2.1.219, 2.1.238, 2.1.285).
  - It has no JSON flag (`claude mcp list --help`, E4).
  - It **spawns its own server processes** to health-check them: a transient `npm exec @playwright/mcp@latest … --headless` child appeared during the run and was gone afterwards (E4).
  - It took **1.7 s** with two servers on this machine (E4).
  - Disabled and unapproved servers are *not* connected (CC:mcp L246-250; changelog 2.1.238 "show disabled servers as `⊘ Disabled` instead of connecting to them").
  - It has no tool counts.
  - WebSocket servers are listed only since 2.1.285 (changelog 2.1.285; CC:mcp L252 still says they're absent).
- **`claude mcp get <name>`**: Scope, Status, Type, Command/Args, Environment (redacted), plus an `Issue:` line on failure (CC:mcp L276, L509). It has no tool count (E4).
- **`/mcp reconnect (<server>|all)`, `/mcp enable|disable [<server>|all]`** change state without opening the panel (CC:commands L110). A mod can run these with `$.command.run` (not tested).
- **Config files** a mod can read with `$.fs.read`:
  - `~/.claude.json` top-level `mcpServers` (user scope), and `projects[<cwd>].mcpServers`, `enabledMcpjsonServers`, `disabledMcpjsonServers` and `disabledMcpServers`/`enabledMcpServers` (per-project toggles from `/mcp`) (CC:mcp L311-320; verified keys on this machine).
  - `.mcp.json` (project).
  - Settings files for `enabledMcpjsonServers`, `disabledMcpjsonServers` and `enableAllProjectMcpServers` (CC:mcp L256-266).
  - claude.ai connectors are **not** in any file. `~/.claude.json` `claudeAiMcpEverConnected` lists ones that have connected before (observed key; undocumented).
  - Plugin-bundled servers live in each enabled plugin's `.mcp.json`.
- **`~/.claude/sessions/<pid>.json`** has no MCP fields (observed keys: pid, sessionId, cwd, status, …). Not useful.

### 1.5 Headless / Agent SDK

- `claude -p --output-format stream-json --verbose`: the `system/init` message has `mcp_servers: [{name, status, source?}]` and `mcp_server_errors` (CC:headless L254-255; CC:agent-sdk/typescript L1750-1779).
- `Query.mcpServerStatus(): Promise<McpServerStatus[]>`, Python `get_mcp_status()` (CC:agent-sdk/typescript L589, L629; CC:agent-sdk/python L447). The type is:
  ```ts
  type McpServerStatus = { name: string;
    status: "connected" | "failed" | "needs-auth" | "pending" | "disabled";
    serverInfo?; error?: string; config?; scope?; source?;
    tools?: { name; description?; annotations?; _meta? }[] }
  ```
  (CC:agent-sdk/typescript L4763-4788)
- A remote server goes `connected → pending` while reconnecting, then `failed` / `needs-auth` after five attempts (CC:agent-sdk/mcp L808-810). `reconnectMcpServer()` and `toggleMcpServer()` exist (CC:agent-sdk/typescript L603-604, L636-637).
- Wire format: the SDK method sends `{"type":"control_request","request_id":…,"request":{"subtype":"mcp_status"}}` over the CLI's stdin.
  - **Bundle-only**: SDK client code `async mcpServerStatus(){return(await this.request({subtype:"mcp_status"})).response.mcpServers}` and the schema description "Requests the current status of all MCP server connections." are in the 2.1.288 binary strings.
  - The docs mention the `control_request` envelope only in passing (CC:agent-sdk/typescript L782, L1205) and never list the `mcp_status` subtype.
- `MCP_CONNECTION_NONBLOCKING=0` makes startup block on the whole connection batch, up to `MCP_CONNECT_TIMEOUT_MS` (default 5000), "before the init message is sent" (CC:agent-sdk/mcp L168-171; CC:env-vars L465-466). This is what makes a one-shot probe return settled statuses (E5).

---

## 2. Detail on the in-process signals

### 2.1 What `$.tool.list()` and `usage().breakdown.mcpTools` show (E2, E3)

Test setup (E3): servers `playwright` (stdio, healthy), `claude.ai Claude Docs` (connector, healthy), `broken` (stdio `/bin/false`) and `authy` (HTTP needing OAuth).

| Server | real status (`system/init`) | in `$.tool.list()` | in `breakdown.mcpTools` | `tool.describe` provider |
|---|---|---|---|---|
| playwright | connected | 25 tools | 25, `serverName: "playwright"` | `mcp:playwright` |
| claude.ai Claude Docs | connected | 8 tools (`mcp__claude_ai_Claude_Docs__*`) | 8, `serverName: "claude_ai_Claude_Docs"` | `mcp:claude.ai Claude Docs` |
| broken | failed | absent | absent | none |
| authy | needs-auth | absent | absent | none |

Notes:
- **Deferred tools are included.** With tool search on, all 33 tools had `isLoaded: false` yet were listed (E2). Tool counts are therefore real counts, not "loaded" counts.
- **The `serverName` spelling differs from the d.ts.** d.ts@288 2016 says `serverName` is "The server it belongs to, as /mcp lists it". In practice it was the **normalized** tool-name segment (`claude_ai_Claude_Docs`, E2). Map it back through `tool.describe`'s `provider.plugin` (`mcp:<display name>`) or by normalizing configured names.
- **Absent ≠ failed.** A pending (still connecting), failed, needs-auth or disabled server all look identical: no tools. A server that connected but exposes zero tools also looks the same.
- **A `cached` remote server (discovery cache) has tools but no connection.** It "connects on first use" (CC:mcp L270-272). Tier A would show it as ●. Label it "ready" rather than "connected" if you need to be precise.
- Cost: `tool.list` is an in-process call. `usage({breakdown:"summary"})` "estimates locally and sends none" (d.ts@288 11050-11055).

### 2.2 Inferring liveness from `tool.call` (`mcp__<server>__<tool>`)

- Documented: `on('tool.call', { tool: /^mcp__github__/ }, hook)` matches one server's tools (CC:plugins/mods/events L84-88). The result variant has `isError: true` with the error text when a call fails (d.ts@288 12035-12060). Classic hook inputs add `mcp_server {name, source}` (CC:hooks L1594).
- Useful as a **"last call ok / errored"** badge and as a trigger to re-probe. It is not a status source: a server Claude never calls stays unknown.
- `$.mcp.call(server, "<nonexistent>")` cannot be used as a cheap ping. It threw the same message, `no connected MCP tool "__nope__" on a server named "<x>"`, for a healthy, a failed, a needs-auth and a non-existent server alike (E3).

### 2.3 Bundle check (undocumented, unstable)

- The mod runtime builds `$` in one function: `{ui:…, model:…, audio:…, mcp: m(ch(e, c=>t("mcp.call",c), c=>t("mcp.connect",c))), session:…, prompt:…, tool:…, command:…, config:…, telemetry:…, agent:…, fs:…, store:…, state:…, clock:…, http:…, process:…, settings:…, env:…, flag:…}` (2.1.288 binary strings). **There is no hidden MCP status method.** `$.flag` is undocumented and unrelated.
- The op allow-list contains `"mcp.call","mcp.connect"` and no other MCP op.
- Internal engine state does hold the full list (`E.getState().mcp` → `{clients, tools}`, used to answer `mcp_status`). Mods cannot reach it.

---

## 3. Which states each source can show

| Source | connected | failed (+error) | needs-auth | pending | disabled | pending approval | tool count | Same process as the user's session? | Cost |
|---|---|---|---|---|---|---|---|---|---|
| `$.tool.list` / `breakdown.mcpTools` | as "has tools" | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | **yes (live)** | ~free |
| Config files (`$.fs.read`) | ✗ | ✗ | ✗ | ✗ | ✓ (toggles/lists) | ✓ (approval lists) | ✗ | n/a | ~free |
| `claude mcp list` via `$.process.run` | ✓ | ✓ (detail) | ✓ | ✗ | ✓ | ✓ | ✗ | no: fresh health check | ~1.7 s, spawns servers |
| Shadow `mcp_status` probe via `$.process.run` | ✓ | ✓ (`error`) | ✓ | ✓ (if still connecting at 5 s) | ✓ (per SDK type; not tested) | ✗ (unapproved `.mcp.json` servers are not loaded; not tested) | ✓ | no: separate process | ~2 s, spawns servers, no model turn |
| statusLine stdin | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | – | – |
| Hooks | per-call provenance only | per-call error only | ✗ | ✗ | ✗ | ✗ | ✗ | yes | – |

**Caveat that applies to both out-of-process probes:**
- They show what a *fresh* process can connect to with the same config and cwd. That usually matches the live session, but it diverges for:
  - a mid-session drop or reconnect in the live session;
  - servers added with the live session's `--mcp-config`, `--strict-mcp-config` or `--plugin-dir` (pass the same flags to the probe);
  - OAuth states that differ between processes.
- Use Tier A, which is live, to overrule a probe's "connected" when the live session has no tools for that server.

---

## 4. Workarounds considered and rejected

- **Parse `/mcp` output via `$.command.run({command:"mcp"})`.** With no arguments it opens an interactive panel, so there is no text reply to parse (CC:commands L110). Not tested; unlikely to work.
- **Pass status via the statusLine script.** Its stdin has no MCP data (§1.2). Running `claude mcp list` from the statusLine is possible, but the script runs on every update and is cancelled when slow (CC:statusline L1210-1211), so it's the wrong place.
- **SessionStart hook snapshot.** It fires before servers connect (CC:hooks L584).
- **`$.mcp.connect` on arbitrary servers.** It returns `unlisted` for anything not in your own manifest (E2).
- **Agent SDK package inside the mod.** The hooks module has "no Node.js APIs" (CC:plugins/mods/api L170). Shelling out to `claude` with `$.process.run` is the supported equivalent.

---

## 5. Experiments (reproducible)

- **E1** `claude --version` → `2.1.288`. d.ts extracted by zstd-decompressing the frame at offset 242,148,956 of the binary. The first line is `// Claude Code function hooks: …`.
- **E2** Probe mod (`.claude-plugin/plugin.json`, `hooks/hooks.json` `{"modules":["./register.js"]}`) with a `turn.start` hook that calls `$.tool.list()`, `$.session.usage({breakdown:"summary"})`, `$.mcp.connect("playwright")`, `$.mcp.list()` and `$.settings.read()`. Run with `claude -p "Reply with just OK" --model haiku --plugin-dir ./mcp-probe --output-format stream-json --verbose`. Mod hooks do run under `-p` (CC:plugins/mods/overview L190-198). Results:
  - `$.mcp.list` → `TypeError: $.mcp.list is not a function`.
  - `connect` → `{isConnected:false, reason:"unlisted", message:"This plugin's manifest lists no MCP server named \"playwright\"."}`.
  - 33 MCP tools from `tool.list` and from `mcpTools`, all with `isLoaded:false`.
  - `settings.read()` had no MCP keys.
  - `claude plugin validate` rejects `Object.keys($.mcp)`: "$.mcp is used as a value … $ is always spelled $.noun.event(...)". The validator does accept a call to the nonexistent `$.mcp.list()`, which then fails at runtime.
- **E3** Same, plus `--mcp-config` with `broken` (`/bin/false`) and `authy` (`https://mcp.sentry.dev/mcp`). `system/init.mcp_servers` = playwright `connected`, broken `failed`, authy `needs-auth`, Claude Docs `connected`. The mod saw only the two connected servers' tools. `$.mcp.call(<any>, "__nope__")` gave the same error for all four names.
- **E4**
  - `time claude mcp list` → 1.69 s, `✔ Connected` lines.
  - Polling `pgrep` during the run showed a new `npm exec @playwright/mcp@latest … --headless` that exited afterwards.
  - `claude mcp get playwright` → 1.41 s, Scope/Status/Type/Command/Args/Environment, no tool count.
  - `claude mcp list --help` → no `--json` option.
- **E5** Shadow probe. Results:
  - Without the env var, a one-shot probe answered in 0.5 s with `pending` for playwright and Claude Docs.
  - With `MCP_CONNECTION_NONBLOCKING=0`, a one-shot probe answered in ≈2.0 s with `connected` 25 tools, `failed` (`error: "Connection closed"`), `needs-auth`, and `connected` 8 tools.
  - No model turn ran: no `user` message was sent and no `result` message came back.
  - Each entry carries keys `name, status, serverInfo, config, scope, source, tools`. **`config` can contain env and headers, so drop it.**

  The command:
  ```sh
  echo '{"type":"control_request","request_id":"s","request":{"subtype":"mcp_status"}}' \
    | MCP_CONNECTION_NONBLOCKING=0 claude -p --input-format stream-json \
        --output-format stream-json --verbose --no-session-persistence
  ```
- **E6** A long-lived stream-json process polled every second went `pending → connected` at about 1.4 s, then stayed stable. Closing stdin exited it with code 0.

---

## 6. Recommendation for the sidebar's MCP section

**Source.** Use two tiers, plus config files for the name list.

1. **Roster (which servers exist).**
   - Read with `$.fs.read`: `~/.claude.json` `mcpServers`, `projects[cwd].{mcpServers, disabledMcpServers, enabledMcpServers, enabledMcpjsonServers, disabledMcpjsonServers}`, `<root>/.mcp.json`, and `.claude/settings*.json` approval keys.
   - Also add any server seen in Tier A or Tier B (this covers claude.ai connectors and plugin servers that aren't in a file).
   - This is a parsing convenience. Treat Tier B's list as authoritative when present.
2. **Tier A, live and in-process, every 3-5 s with `$.clock.every`, and on `turn.start`.**
   - Group `$.tool.list()` entries where `mcp` is true by `name.split("__")[1]`. That gives a tool count per normalized server name.
   - Map the normalized names to display names with the `tool.describe` hook's `e.provider.plugin` (`mcp:<display name>`).
   - Shows: **● name · N tools** for a server that has tools, **○ name** for one that doesn't.
3. **Tier B, the reason for a ○ server, run on demand.**
   - Triggers: once ~6 s after `session.start`, from a `/sidebar mcp refresh` command or button, when a Tier A server disappears, after an `mcp__*` call with `isError`, and at most every 60 s while any server is ○.
   - **Preferred:** the shadow `mcp_status` probe (E5). It gives all five states, the error text and tool counts.
   - **Fallback:** parse `claude mcp list`, which is documented and stable text but has no counts.
   - Merge rule: **if Tier A has tools for a server, show it as connected, whatever Tier B says.** Otherwise show Tier B's state.
4. **Action.** A "reconnect" affordance runs `$.command.run({ command: "mcp", args: "reconnect all" })` (CC:commands L110; CC:mcp L390). This acts on the *live* session. Not tested from a mod.

**States the sidebar can show** (map onto the mock's rows in `prototypes/opencode-skin-preview.html` L216-221):

| Glyph | Label | Condition |
|---|---|---|
| ● (green) | `connected · N` | Tier A has N tools |
| ◐ (accent) | `connecting` | Tier B `pending` and Tier A has no tools |
| ✘ (red) | `failed` (tooltip/second line: `error`) | Tier B `failed` |
| ! (yellow) | `needs auth` | Tier B `needs-auth` |
| ○ (dim) | `off` | Tier B `disabled`, or config `disabledMcpServers` / `disabledMcpjsonServers` |
| ⏸ (dim) | `needs approval` | `claude mcp list` `⏸ Pending approval` (the shadow probe doesn't report it; not tested) |
| ? (dim) | `unknown` | no tools and no probe result yet |

**Things to watch out for:**
- **Recursion guard.** The shadow `claude -p` loads your installed plugins, so the opencode-skin mod runs inside it too, because hooks run under `-p` (CC:plugins/mods/overview L190-198). Set `env: { OPENCODE_SKIN_PROBE: "1" }` on the child, and return early from every hook when `$.env.get("OPENCODE_SKIN_PROBE")` is set. Also skip all of this when `(await $.session.surfaces())` has no `terminal`.
- **Side effects.**
  - Each probe starts every stdio server again. Heavy servers like Playwright run `npx`.
  - Remote servers get an extra connection.
  - Pass `--no-session-persistence` (CC:cli-reference L109) so probes don't fill `/resume`.
  - User `SessionStart` command hooks may run in the probe. Not verified.
- **Secrets.** Drop `config` from probe output before storing or drawing it.
- **Instability.**
  - The `mcp_status` envelope is the SDK's private wire format. Feature-detect: on any parse failure, fall back to `claude mcp list`.
  - Pin the behavior in a `claude plugin test` with a stubbed `process.run`.

### 6.1 Code sketch (hooks module, untested)

```ts
// hooks/mcp-status.ts — imported by register.ts; types from .claude-plugin/types
type Row = { name: string; state: "connected"|"connecting"|"failed"|"needs-auth"|"off"|"approval"|"unknown"; tools?: number; error?: string }

const display = new Map<string, string>()        // normalized -> display name, from tool.describe
let live = new Map<string, number>()             // display name -> tool count (Tier A)
let probe = new Map<string, Omit<Row,"name">>()  // Tier B
let probing = false
const norm = (s: string) => s.replace(/[^A-Za-z0-9_-]/g, "_")

export function registerMcpStatus(on: On) {
  on("tool.describe", async ($, e, next) => {
    const p = e.provider?.plugin ?? ""
    if (e.tool.startsWith("mcp__") && p.startsWith("mcp:")) display.set(e.tool.split("__")[1], p.slice(4))
    return next(e)
  })

  on("session.start", async ($, e, next) => {
    const r = await next(e)
    if (await $.env.get("OPENCODE_SKIN_PROBE")) return r          // we are the probe: do nothing
    if (!e.surface) return r                                        // -p / SDK: nothing to draw
    $.clock.every(4000, () => void refreshLive($))
    $.clock.after(6000, () => void runProbe($))
    return r
  })

  // A failing MCP call is a hint to re-probe
  on("tool.call", { tool: /^mcp__/ }, async ($, e, next) => {
    const res = await next(e)
    if ((res as any)?.isError) void runProbe($)
    return res
  })
}

async function refreshLive($: Api) {
  const counts = new Map<string, number>()
  for (const t of await $.tool.list()) {
    if (!t.mcp) continue
    const seg = t.name.split("__")[1]
    const name = display.get(seg) ?? seg
    counts.set(name, (counts.get(name) ?? 0) + 1)
  }
  const changed = [...counts].some(([k, v]) => live.get(k) !== v) || counts.size !== live.size
  const lost = [...live.keys()].some(k => !counts.has(k))
  live = counts
  if (lost) void runProbe($)
  if (changed) $.ui.invalidate("ui.render")
}

async function runProbe($: Api) {
  if (probing) return; probing = true
  try {
    const req = JSON.stringify({ type: "control_request", request_id: "s", request: { subtype: "mcp_status" } }) + "\n"
    const { stdout } = await $.process.run(
      ["claude", "-p", "--input-format", "stream-json", "--output-format", "stream-json", "--verbose", "--no-session-persistence"],
      { stdin: req, timeoutMs: 15000, env: { MCP_CONNECTION_NONBLOCKING: "0", OPENCODE_SKIN_PROBE: "1" } })
    const msg = stdout.split("\n").filter(Boolean).map(l => { try { return JSON.parse(l) } catch { return null } })
      .find(m => m?.type === "control_response" && m.response?.subtype === "success")
    const servers: any[] | undefined = msg?.response?.response?.mcpServers
    if (!servers) return await probeViaMcpList($)                  // envelope changed: documented fallback
    probe = new Map(servers.map(s => [s.name, {                      // `config` deliberately dropped
      state: s.status === "pending" ? "connecting" : s.status === "disabled" ? "off" : s.status,
      tools: s.tools?.length, error: s.error }]))
  } catch { await probeViaMcpList($) } finally { probing = false; $.ui.invalidate("ui.render") }
}

async function probeViaMcpList($: Api) {   // `claude mcp list`: "name: target - ✔ Connected"
  const { stdout } = await $.process.run(["claude", "mcp", "list"], { timeoutMs: 30000, env: { OPENCODE_SKIN_PROBE: "1" } })
  const map: Record<string, Row["state"]> = { "✔": "connected", "!": "needs-auth", "✘": "failed", "⏸": "approval", "⊘": "off" }
  probe = new Map()
  for (const line of stdout.split("\n")) {
    const m = line.match(/^(.+?): .* - (\S)\s*(.*)$/)
    if (m) probe.set(m[1], { state: map[m[2]] ?? "unknown", error: m[2] === "✘" ? m[3] : undefined })
  }
}

export function mcpRows(): Row[] {                 // called from the sidebar Pane's ui.render
  const names = new Set([...probe.keys(), ...live.keys()])
  return [...names].sort().map(name => {
    const n = live.get(name)
    if (n) return { name, state: "connected", tools: n }            // live session wins
    return { name, ...(probe.get(name) ?? { state: "unknown" }) }
  })
}
```

Before relying on this sketch, check against `/plugin-types` output for your build:
- the exact `On`/`Api` type names;
- `e.surface` on `session.start` (d.ts@288 10978-10990);
- the `tool.call` result shape.

The `name: target - ✔ Connected` line format comes from E4 output. It is not a documented contract.

---

## 7. Unverified / open

- The `disabled` state through the shadow probe: the SDK type lists it (CC:agent-sdk/typescript L4770), but I didn't test it because that needs editing `~/.claude.json`. The same goes for how unapproved `.mcp.json` servers appear in the probe (absent or `pending`?).
- Whether `$.command.run({command:"mcp", args:"reconnect all"})` works from a mod in an interactive session, and what text it returns.
- Whether `tool.describe` fires again for tools of a server that reconnects mid-session. I saw it fire twice per tool at startup (66 events for 33 tools, E2). Tier A doesn't depend on it except for name mapping.
- Whether user `SessionStart` command hooks and other plugins' mods run in the shadow probe process. They probably do, since hooks run under `-p`. Their side effects are unknown.
- Behavior with the MCP discovery cache on (`MCP_DISCOVERY_CACHE=1`). `cached` servers should appear in Tier A with tools before connecting, and as `pending`/`connected` in the probe. Not tested.
- Startup network traffic of the probe (feature flags, connector list fetch). No model request was observed, but network traffic wasn't measured.
- The `serverName` discrepancy (d.ts says the `/mcp` spelling, runtime gave the normalized spelling) could change in a later build.
