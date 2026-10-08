# Which skills has the current chat invoked? (mod-side, for the `skills` Sidebar plugin)

> Researched 2026-10-08 for #159 (map #158) against installed Claude Code **2.1.292**.
> Sources:
> - `d.ts` = `ctui/.claude-plugin/types/claude-code/index.d.ts` (header "Written by Claude Code 2.1.292"); `tools.d.ts` = `ctui/.claude-plugin/types/claude-code-tools/index.d.ts`. Both are the engine's own declarations, written by `/plugin-types`. Line numbers are in those files.
> - `S1`…`S9` = live spike runs (§4), interactive under tmux with `--model haiku`, mod `prototypes/research-159/spike/` (gitignored, throwaway). Logs: `prototypes/research-159/log-*.txt`.
> - Labels: **documented** (the d.ts says so), **observed** (seen in a spike), **not checked**.

## 0. Verdict

- **`skill.prompt` is the one event that fires for every skill invocation**, whichever way it comes: a `/name` the person types, Claude's Skill tool call, a subagent's Skill tool call, a forked (`context: fork`) skill, and a skill preloaded into a subagent through its `skills:` frontmatter (documented, d.ts 4273-4282, 11802-11818; observed S1-S6). It carries only `{ skill, text }`: `skill` is the name as `/skills` lists it (`r159-proj`, `r159:r159-plug` with the plugin prefix), `text` the expanded prompt. It has **no `agentId` and no source**.
- It also fires for **plugin and user markdown commands** (`commands/*.md`) that reach the model (S7). Claude Code counts those as skills too: they sit in the skill listing and `/reload-plugins` counts them as skills. It does **not** fire for built-in local commands (`/context`, `/clear`, `/compact`, `/reload-plugins`) (S7, S8), and not for a command a mod answers without `next` (ctui's own `/ctui:*`).
- It fires again when the same skill is invoked again, even when the engine only appends "Skill /x is already loaded above; instructions unchanged" (S3). Dedupe by name.
- **Who invoked it** comes from the event around it, not from `skill.prompt`:
  - Typed `/name`: `command.run` with `origin.kind: 'composer'` wraps it (`skill.prompt` fires inside that hook's `next`) (S1, S2).
  - Skill tool: `tool.call` `{ tool: 'Skill', skill, args?, agentId? }` wraps it. `agentId` is set when a subagent calls it (S5). The result is `{ success, commandName }`, or for a forked skill `{ status: 'forked', agentId, background, result }` (tools.d.ts 682-687, 5209-5235; S3, S4, S5).
  - Preload into a subagent: no `tool.call` for the skill. `skill.prompt` fires during the parent's Agent `tool.call`, and `session.append` (door `note`, `agentId` set) carries `<command-name>r159-proj</command-name><skill-format>true</skill-format>` (S6).
- **Name, description and source are readable without probing.**
  - `$.command.list()` → `CommandInfo { name, description, source, plugin? }` (d.ts 1720-1741, 3036). `source` is `builtin | plugin | user | mcp`: user and project skills both read `user`, bundled skills (`plugin-authoring`) read `builtin`, plugin skills read `plugin` with `plugin: '<name>'` (S0).
  - `$.session.usage({ breakdown: 'summary' })` → `context.breakdown.skills.skillFrontmatter[] { name, source, pluginName?, tokens }` (d.ts 2224-2268, 10845-10848). This one splits user from project: `userSettings`, `projectSettings`, `plugin`, `built-in`, `syncedSkills` (S0). It has no description. The breakdown is local, with no API call (prior finding, `claude-mcp-status-access.md` §1.1).
- **What survives** (S8, S9):

  | Change | `$.state` | Transcript rows `$.session.messages()` | Events |
  |---|---|---|---|
  | Mod reload | kept (MEMORY) | full history | `session.start` fires again |
  | Compaction (`/compact`) | kept | still the full history in the live process | `session.compact`; Claude Code prints "Skills restored (…)" and puts an invoked-skills reminder into the next request |
  | `/clear` | emptied (MEMORY) | empty: a new session id | `session.end` `reason: 'clear'`, no `session.start` |
  | `/resume` or `--resume` | emptied | the resumed transcript, **from the last compact boundary on** | `session.end` `reason: 'resume'` in-process, `session.start` in a new process |

- **Recommendation for the build (#164):** record names from `skill.prompt` into `$.state` (first-seen order, deduped), and take who/where from the wrapping `command.run` / `tool.call`. Label and color rows from `$.session.usage` `skillFrontmatter` (source, plugin) and `$.command.list()` (description), both already read for other plugins. Rebuild from the transcript on `session.start` and after `session.end` `resume`. Accept one gap: invocations from before a compaction are missing from a resumed transcript's rows, unless ctui parses the invoked-skills reminder in the API form (engine prose, unstable; see §3).

## 1. Sources and what each says

| What | Label | Evidence |
|---|---|---|
| `skill.prompt`: "Fires when the engine expands a skill's prompt for the model (`/name`, the Skill tool, a preload)". `{ skill, text }`; a hook may return `{ text }` to replace what the model reads | documented | d.ts 4273-4282, 11802-11826 |
| Skill tool input `{ skill, args? }`; output inline `{ success, commandName, allowedTools?, model?, status?: 'inline', readOnly? }` or forked `{ success, commandName, status: 'forked', agentId, result, background? }` | documented | tools.d.ts 682-687, 5209-5235 |
| `tool.call` args are spread on `e` (`e.skill`, not `e.input.skill`); `e.agentId` names the subagent loop, absent on main | documented, observed | d.ts 194-204, 996-1016; S3, S5 |
| `command.run` `{ command, args, origin, presentation }`; `command` is the name without the slash, folds resolved | documented | d.ts 1782-1809 |
| `$.command.list()` → `CommandInfo { name, description, source, plugin? }`; `CommandSource = 'builtin' \| 'plugin' \| 'user' \| 'mcp'`, "`user` is the user's or project's own file" | documented | d.ts 1720-1741, 1864-1871, 3036 |
| `ContextSkill { name, source, pluginName?, tokens }`, source "by the engine's word (`userSettings`, `plugin`, `built-in`, `mcp`, `syncedSkills`)" | documented | d.ts 2224-2268, 10845-10848 |
| `SessionMessage.toolUses[]` is `ToolUseSummary { tool_use_id, tool, input, result?, text?, isError? }` (field `tool`, not `name`) | documented | d.ts 11058-11080, 13025-13055 |
| `session.end` `reason: 'clear'`: "the process goes on under a new session id, and no `session.start` fires for it" | documented | d.ts 10973-10998 |
| `session.compact` `{ trigger, agentId?, instructions?, messages }` | documented | d.ts 10720-10748 |
| No `skill.*` event other than `skill.prompt`; no list of invoked skills on `$.session` | not found | event keys in d.ts 3900-4480 |

## 2. What each path looked like (observed)

Order of events for one invocation, as logged:

- **Typed `/r159-proj`** (S1): `skill.prompt { skill: 'r159-proj' }` → `command.run r159-proj origin composer` resolves `{ ref }` → `prompt.submit text "/r159-proj"` → `session.append` door `command`, text `<command-message>r159-proj</command-message>\n<command-name>/r159-proj</command-name>` → `session.append` door `note` (isMeta) with the skill body.
- **Typed plugin skill `/r159:r159-plug`** (S2): the same, with `skill: 'r159:r159-plug'` and `command.run r159:r159-plug`.
- **Claude's Skill tool** (S3): `tool.call Skill { skill: 'r159-proj' }` (no `agentId`) → `skill.prompt` → result `{ success: true, commandName: 'r159-proj' }`. Invoked a second time, the engine appended "already loaded above" and `skill.prompt` still fired.
- **Forked skill** (S4, `context: fork`): `tool.call Skill` → `skill.prompt` → result `{ status: 'forked', background: true, agentId: 'a157…' }`; the skill body is appended to that fork's loop (`session.append` with `agentId`). Its end arrives as a task notification. `$.agent.list()` lists the fork as type `general-purpose`.
- **Subagent's Skill tool** (S5): `tool.call Skill { skill: 'r159:r159-plug', agentId: 'a074…' }` → `skill.prompt` (no `agentId`) → result. `$.session.messages({ agentId })` shows the Skill tool use in that agent's rows; the main rows don't.
- **Preload** (S6, agent `skills: [r159-proj]`): `tool.call Agent` → `skill.prompt { skill: 'r159-proj' }` → `session.append` door `note`, `agentId` set, `<command-name>r159-proj</command-name>\n<skill-format>true</skill-format>` plus the body. No Skill tool use anywhere.
- **Markdown command `/r159:r159md`** (S7): `skill.prompt` → `command.run` → same rows as a typed skill.
- **Built-ins** (S7, S8): `/context`, `/reload-plugins`, `/clear`, `/compact` fire `command.run` (origin composer) with no `skill.prompt`. Their transcript rows also carry `<command-name>/context</command-name>`, so a transcript scan must filter by known skill names.

## 3. Survival details (observed)

- **Mod reload** (S3→S4, editing `register.tsx`): `session.start` fired again; module variables were gone; `$.session.messages()` returned the full transcript, Skill tool uses and typed `<command-name>` rows included, so a rebuild finds everything on the main loop.
- **Compaction** (S8): `session.compact` fired; afterwards the screen showed `Skills restored (r159:r159md, r159-proj, r159:r159-plug)`. The forked skill was not in it. In the live process `$.session.messages()` still returned all 49 rows (pre-compaction history included). The API form (`$.session.messages({ as: 'api' })`, 5 messages) held the summary plus a system-reminder listing each restored skill as `### Skill: <name>\nPath: <source>:<name>` (`plugin:r159:r159-plug`, `projectSettings:r159-proj`) with its body. No `session.append` carried that reminder.
- **`/clear`** (S8): `session.end { reason: 'clear' }`, new session id, no `session.start`; rows and API form held no skill uses. The Sidebar should drop the list, since this is a new chat.
- **`/resume <id>` in-process, after a compaction** (S9): `session.end { reason: 'resume' }`, no `session.start`. Rows started at the compact boundary (11 rows: summary, `/compact`, later commands): the pre-compaction Skill tool uses and typed rows were gone. The API form still carried the invoked-skills reminder.
- **`claude --resume <id>`** in a new process, no compaction (S9): `session.start` fired, and rows held the typed `<command-name>/r159-proj</command-name>` row.

Not checked: a subagent's rows after `/resume` (`$.agent.list()` is per session and emptied by `/resume`, MEMORY "Task ends come from notifications"), a failed Skill call (unknown name), MCP prompts as skills, `prompt.attachment` for the invoked-skills reminder.

## 4. Spike runs

Mod `prototypes/research-159/spike/` (plugin `r159`, a plugin skill `r159-plug`, markdown commands `r159cat` and `r159md`), cwd `prototypes/research-159/work/` (project skills `r159-proj`, `r159-fork` with `context: fork`, agent `r159-preload` with `skills: [r159-proj]`). ctui 0.3.0 was also loaded. The hooks log `skill.prompt`, `command.run`, `tool.call` (Skill, Agent), `prompt.submit`, `session.append` (matching `r159|command-name|skill`), `session.start|end|compact`, and on `session.start` and each main `turn.complete` scan `$.session.messages()` (rows and API form), `$.agent.list()` rows, `$.command.list()` and `$.session.usage({ breakdown: 'summary' })`.

- S0: start: catalog reads (above).
- S1: `/r159-proj`. S2: `/r159:r159-plug`. S3: "Call the Skill tool with skill r159-proj". Then a reload (edited the hooks module).
- S4: "Call the Skill tool with skill r159-fork". S5: "Use the Agent tool … call the Skill tool with skill r159:r159-plug". S6: "Use the Agent tool with subagent_type r159-preload".
- S7: `/reload-plugins`, `/r159:r159md`, `/context`. S8: `/compact`, `/r159:r159cat`, a reload, `/clear`, "say hi".
- S9: `/resume 66037c9a…`, "say ok"; `/clear`, `/r159-proj`; quit; `claude --resume da08d4d9…`.

Cleanup: no settings changed (`--model` flag only); the spike's transcripts stay under `~/.claude/projects/` for the `work` folder.
