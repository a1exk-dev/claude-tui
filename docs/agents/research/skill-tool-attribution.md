# Can a running tool call name the skill that owns it? (Claude Code 2.1.292)

Scope: whether a ctui mod can attribute a **running** tool call to the skill that owns it, so a `skills`
Sidebar row can animate only while a call it owns is in flight (#301, #303). This reports what the engine
offers. It proposes no design.

**Measured against Claude Code 2.1.292** — the pin in the repo's root `package.json`
(`devDependencies["@anthropic-ai/claude-code"]`), the same pin `ctui/README.md` and the engine-pinned
expectations in `MEMORY.md` name.

**Source keys**

- **DTS** = `vendor/claude-code-types/claude-code/index.d.ts`, the mod API declarations this build writes
  into a loaded mod, vendored here for `tsc` (`MEMORY.md`, "One pinned Claude Code version"). Claims cite
  the exported type or field name, not a line number, so they survive the next vendoring.
- **TOOLS** = `vendor/claude-code-types/claude-code-tools/index.d.ts`, the built-in tools' input and result
  schemas as the engine laid them beside the mod (`BuiltinToolInputs`, `BuiltinToolResults`).
- **DOCS** = the official Claude Code pages, fetched 2026-10-14:
  [mods events](https://code.claude.com/docs/en/plugins/mods/events),
  [mods reference](https://code.claude.com/docs/en/plugins/mods/reference),
  [mods API](https://code.claude.com/docs/en/plugins/mods/api),
  [hooks](https://code.claude.com/docs/en/hooks),
  [skills](https://code.claude.com/docs/en/skills). The mods reference states it was written "as of
  v2.1.290"; the pin is two patches ahead, so the typings are the ground truth wherever the two could differ.
- Labels: **present** (the typings declare it), **absent** (the typings declare the whole shape and it is not
  in it), **untested** (reachable in principle, but no run on this pin has confirmed it).

---

## 1. Verdict

- **No event and no `$` call names the skill in force while a tool call runs.** `tool.call` carries no skill
  field, `$.session.messages()` carries no skill field on a message or on a tool use, and `skill.prompt` is
  the only skill event the engine raises. Direct attribution does not exist on this pin.
- **There is one exact case.** A skill that runs **forked** executes in a subagent of its own, and the
  `Skill` tool's result names that subagent's `agentId`. Every `tool.call` inside that loop carries the same
  `agentId`, so for a forked skill the mapping call → skill is exact.
- **For a skill that runs inline there is no attribution, only ordering.** The skill's instructions join the
  same loop's context and nothing marks where their influence begins or ends — DOCS (skills) says the
  rendered `SKILL.md` "enters the conversation as a single message and stays there across later turns". The
  closest reachable signal is "the most recent `Skill` tool use in this loop, with this loop's calls after
  it" (§6).
- **`agentId` separates loops, not skills.** It tells a subagent's calls from main's, and so distinguishes a
  forked skill's calls; it does not say that a skill is what the subagent is running, and it is **absent from
  `skill.prompt`**, so a skill preloaded into a subagent cannot even be placed in its loop.
- **A turn has a start and an end a mod can hook**, `turn.start` and `turn.complete`, but `turn.start` fires
  on the main loop only; a subagent's run raises none.

---

## 2. Every field on `tool.call`

`ToolCallInput = ToolCallEnvelope & AgentLoop` (DTS). The envelope is a union discriminated by `tool`, one
branch for built-in tools and one for MCP tools; with no tool table laid the branches fall back to loose
variants over every name. Flattened, a `tool.call` hook's `e` carries exactly:

| Field | Type | Notes |
|---|---|---|
| `tool` | `string` (or a literal built-in / `mcp__<server>__<tool>` name) | The tool being called. Reserved: a rewrite is ignored by core. |
| `tool_use_id` | `string` | The `tool_use` block's id. **The same at every event of the call** and in `$.ui.notice`. Reserved. |
| *the tool's own arguments* | per the tool's input schema | Spread beside the two above (`e.command` for Bash), loose (`[argument: string]: unknown`) until `BuiltinToolInputs` / `McpToolInputs` have entries. TOOLS supplies them on this pin. |
| `agentId` | `string \| undefined` | `AgentLoop`. The id of the **loop** this call runs in: a subagent's or a teammate's `$.agent.list()` id; **absent on the main loop**. Pinned: a different value is refused, one left out is kept. |

That is the whole shape. **Absent:** any skill, skill name, command, prompt-source, provenance or "in force"
field. The MCP comparison is instructive — the engine *does* ship a provenance field for MCP, and only for
MCP: `classic.PreToolUse`, `classic.PostToolUse` and `classic.PostToolUseFailure` each carry
`mcp_server?: McpServerProvenance` (`{ name, source }`). There is no skill counterpart on any of them.

`next(e)` from a `tool.call` hook resolves to `ToolCallResult`: `{ deny }`, or
`{ result, context?, ref?, text?, isError?, isReadOnly? }`. `result` is typed per built-in tool once `e.tool`
is narrowed — which is how the `Skill` tool's result becomes reachable (§5).

The classic path adds nothing on the skill axis. `classic.PreToolUse`'s `e` is `ToolCallEnvelope` exactly
(`{ tool, tool_use_id, ...args }`, no `agentId`); `classic.PostToolUse` is
`{ hook_event_name, tool_name, tool_input, tool_response, tool_use_id, duration_ms?, mcp_server? }` over
`BaseHookInput`. `BaseHookInput` contributes `session_id`, `transcript_path`, `cwd`, `prompt_id?`,
`permission_mode?`, `agent_id?`, `agent_type?` and `effort?` — see §7 for `prompt_id`.

## 3. Every field on `skill.prompt`

```ts
export type SkillPromptInput = { skill: string; text: string }
export type SkillPromptResult = { text: string }
```

Two fields, and that is all (DTS):

| Field | Type | Notes |
|---|---|---|
| `skill` | `string` | Which skill (`commit`); the key a matcher narrows on. |
| `text` | `string` | The prompt's text as the skill computed it, its text blocks joined. |

Facts that follow from the shape and its doc comment:

- **It fires once, when the engine expands the skill's prompt for the model** — "`/name`, the Skill tool, a
  preload"; the same event at each. It is the load, not the use.
- **It does not say how the skill was invoked.** Typed, tool-called and preloaded are indistinguishable.
- **It carries no `agentId`.** It is not intersected with `AgentLoop`, unlike `tool.call`, `turn.step` and
  `turn.complete`. So a mod cannot tell which loop a `skill.prompt` belongs to — a skill preloaded into a
  subagent raises an event that looks identical to a main-loop one.
- **It carries no `tool_use_id`**, so it cannot be joined to the `Skill` tool call that caused it, even
  though that call is in flight around it.
- **There is no counterpart event.** The engine's full event set is `tool.call`, `tool.check`, `tool.describe`,
  `ui.*` (`render`, `resolve`, `press`, `input`, `select`, `message`, `fault`, `scroll`, `focus`),
  `agent.offer`, `agent.spawn`, `prompt.*` (`submit`, `fill`, `suggest`, `edit`, `autocomplete`, `section`,
  `context`, `compose`, `attachment`, `mention`), `command.run`, `command.describe`, `config.set`,
  `config.describe`, `telemetry.log`, `telemetry.mark`, `skill.prompt`, `attribution.text`, `session.*`
  (`start`, `receive`, `append`, `send`, `compact`, `attach`, `detach`, `measure`, `end`), `plugin.register`,
  `turn.start`, `turn.step`, `turn.complete`, `engine.create`. `skill.prompt` is the only `skill.*` entry.
  No `skill.end`, `skill.complete` or `skill.unload` exists, and no classic hook event names a skill either
  (the classic set is `ConfigChange`, `CwdChanged`, `DirectoryAdded`, `Elicitation`, `ElicitationResult`,
  `FileChanged`, `InstructionsLoaded`, `MessageDisplay`, `Notification`, `PermissionDenied`,
  `PermissionRequest`, `PostCompact`, `PostModelSwitch`, `PostToolBatch`, `PostToolUse`, `PostToolUseFailure`,
  `PreCompact`, `PreModelSwitch`, `PreToolUse`, `SessionEnd`, `SessionStart`, `Setup`, `Stop`, `StopFailure`,
  `SubagentStart`, `SubagentStop`, `TaskCompleted`, `TaskCreated`, `TeammateIdle`, `UserPromptExpansion`,
  `UserPromptSubmit`, `WorktreeCreate`, `WorktreeRemove`).
  `InstructionsLoaded` is about CLAUDE.md-tier instruction files (`file_path`, `memory_type`, `load_reason`),
  not skills.

## 4. Does any event, or `$.session.messages()`, tie a running call back to a skill?

**No.** The transcript shapes are:

```ts
type SessionMessage = { role: 'user' | 'assistant'; text: string; toolUses: ToolUseSummary[]
                        toolResults?: ToolResultSummary[]; handle?: string }

type ToolUseSummary = { tool_use_id: string; tool: string; input: Record<string, unknown>
                        result?: unknown; text?: string; isError?: true
                        agentId?: string; durationMs?: number }

type ToolResultSummary = { tool_use_id: string; text: string; isError: boolean; result?: unknown }
```

- **No skill field on a message or on a tool use.** `ToolUseSummary.agentId` is populated **on an Agent tool
  use only** — "the id of the agent it spawned … absent on every other tool". It is not a per-call loop
  stamp, so it cannot be used to group a loop's calls after the fact.
- **A call in flight is visible, but bare.** `ToolUseSummary.result` and `.text` are "absent while the call
  is in flight", so the transcript does mark a running call — with nothing about a skill on it.
- The Messages API form, `$.session.messages({ as: 'api' })`, returns `ApiMessage = { role, content }` with
  `ApiContentBlock = { type, [field]: unknown }` — "the engine hands the block over as it holds it, nothing
  renamed or dropped". These are Messages API blocks; the API has no skill attribute on a `tool_use` block,
  so nothing appears there either. The system prompt and the tool list are explicitly **not** in any message.
- `$.session.messages({ agentId })` reads one agent's conversation, or `{ deny }` when the id names no
  conversation this session can read. A **forked skill's** loop is one this session tracks (§5), so its
  transcript is readable; a workflow run's agent is not.
- `next.origin` (`{ plugin, tier }`) is the **plugin** axis — "which plugin caused the dispatch" — and the
  engine reads `{ plugin: 'engine', tier: 'core' }`. It never names a skill.
- The skill information the engine *does* expose is a **listing**, not a live state:
  `$.session.usage` → `context.breakdown.skills` is `ContextSkills = { totalSkills, includedSkills,
  skillFrontmatter: ContextSkill[] }`, and `ContextSkill` is `{ name, source, pluginName? }`. It says which
  skills the context lists for the model, not which one is working. ctui already reads it, in
  `ctui/hooks/register.tsx`'s `skillCatalog`, to label a row's source.

## 4b. What the docs say a skill's life actually is

The typings give no skill lifecycle; DOCS (skills, hooks) does, and it explains why there is no end event to
find:

- **The instructions stay.** The rendered `SKILL.md` "enters the conversation as a single message and stays
  there across later turns", and Claude Code "does not re-read the skill file on later turns". So "the skill
  is over" is not a state the engine holds — there is nothing to raise an event about.
- **Re-invocation is cheap and visible.** Re-invoking a skill with identical content adds a short "already
  loaded" note; different content is appended in full. On compaction the engine re-attaches the most recent
  invocation of each skill, keeping the first 5,000 tokens of each under a shared 25,000-token budget.
- **One part of a skill *is* turn-scoped, and it is the tool axis.** `allowed-tools` in frontmatter grants
  tools for the invoking turn only: the grant "clears when you send your next message, even though the skill
  content stays in context". That is the engine's own notion of "this skill's tools are live now", and it
  lines up exactly with a turn bracket (§7) — but it is a permission the engine applies internally. No event
  reports it, and the mod-side trace of it is the inline `Skill` result's `allowedTools?: string[]` (§6).
- **A skill's frontmatter hooks outlive its turn.** Registered on invocation, Claude Code "keeps running them
  for the rest of the session, on turns after the skill's own turn as well", unless a hook declares
  `once: true`. So even the skill's own hooks are not a "while the skill is active" signal.
- **Inline versus forked is the frontmatter's choice, not the caller's.** `context: fork` runs the skill in a
  subagent of the type in `agent` (`general-purpose` when omitted), which "doesn't see your conversation
  history"; `background` (default `true`, fork only) decides whether the invoking turn waits. Inline is the
  default. DOCS says neither `/name` invocation nor the model's own use changes which it is — so §5's
  partition is a property of each skill, fixed and knowable from its frontmatter, not of how it was called.

## 5. Is a skill running inside a subagent distinguishable via `agentId`?

Partly, and the partition matters.

**A forked skill — yes, exactly.** The `Skill` tool's result is a union (TOOLS, `BuiltinToolResults.Skill`):

```ts
// inline
{ success: boolean; commandName: string; allowedTools?: string[]; model?: string
  status?: "inline"; readOnly?: boolean }
// forked
{ success: boolean; commandName: string; status: "forked"
  agentId: string; result: string; background?: boolean }
```

The forked variant's `agentId` is documented as "the ID of the sub-agent that executed the skill". Every
`tool.call`, `turn.step` and `turn.complete` inside that loop carries the same string as `agentId`. So:
`agentId` → that skill, exactly, for as long as the loop runs. `$.agent.list()` lists the loop too — "loops
the engine tracks as agents with no `agent.spawn` (a forked skill) are here" — so its `status` is pollable the
way ctui already polls agents for the `agents` section.

Two caveats on reaching that `agentId` **while the fork runs**:

- The `Skill` `tool.call`'s `next(e)` resolves with the forked variant only **after** the fork has finished
  (`result` is its report). Read there, the id arrives too late to animate the row during the run.
- A forked skill raises **no `agent.spawn`** (DTS says so explicitly, on `$.agent.list()`), so the usual
  early source of an `agentId` is not available. `classic.SubagentStart` (`agent_id`, `agent_type`) and
  `$.agent.list()` polling are the candidates for catching the loop as it starts; whether either fires or
  lists for a forked skill, and what `agent_type`/`description` read, is **untested** on this pin.

**An inline skill — no.** `status: "inline"` means the instructions were loaded into the calling loop. Its
tool calls carry the calling loop's `agentId` (absent on main), identical to every other call in that loop.
Nothing separates them.

**A skill preloaded into a subagent — no.** `AgentDefinition.skills?: readonly string[]` ("preloaded into the
agent's context before its first turn: skill names") is a field of an agent *definition*, used by
`$.agent.register` and agent files. It is **not** on `AgentSpawnInput`, whose fields are `tool_use_id`,
`prompt`, `description`, `subagentType`, `provider`, `model?`, `parentModel`, `parentAgentId?`,
`permissionMode?`, `background`, `fork`, `isTeammate?` and the workflow fields. So a mod watching
`agent.spawn` does not learn which skills that agent preloads, and the `skill.prompt` the preload raises
carries no `agentId` to place it (§3).

**What `agentId` actually means.** "Which loop, not which plugin caused it." It is the loop axis. A loop that
is running a forked skill and nothing else is, incidentally, a loop that *is* that skill — which is why the
forked case works. There is no equivalent for a loop that is running a skill among other things.

## 6. The closest reachable signal, where attribution is impossible

For an inline skill, the strongest thing the engine permits is **ordering within a loop**, built from signals
that do exist:

- The `Skill` tool is itself a tool call. `tool.call` with `tool === 'Skill'` carries `e.skill` (TOOLS:
  `BuiltinToolInputs.Skill = { skill: string; args?: string }`), `e.tool_use_id` and `e.agentId`. That is a
  dated, loop-stamped "skill X was invoked here" marker — stronger than `skill.prompt`, which has neither an
  id nor a loop.
- Every subsequent `tool.call` in the same loop carries the same `agentId` (or none, for main) and its own
  `tool_use_id`, which is "the same at every event of the call" and so pairs the start with the
  `classic.PostToolUse` / `tool.call` result that ends it.
- `$.session.messages()` preserves order, and ctui already walks it for `Skill` tool uses and typed
  `<command-name>` rows (`ctui/hooks/skills.ts`, `skillsFromMessages`) when a session is resumed.
- `allowedTools?: string[]` on the inline `Skill` result names the tools that skill permits. Its grant is
  **turn-scoped** — DOCS says it "clears when you send your next message, even though the skill content stays
  in context" — so it is the one piece of a skill the engine itself treats as live-then-over, and its window
  is a turn. It is still a constraint the skill declared, not evidence a given call came from it, so it can
  only narrow a guess; and a skill without `allowed-tools` gives no list at all.
- **Which skills are forked is knowable without the engine.** `context: fork` is frontmatter, so a mod that
  reads the skill files it lists (or that treats a `Skill` call whose result has `status: "forked"` as
  settling the question for next time) can split its skills into the exactly-attributable set (§5) and the
  rest, ahead of any call.

So the reachable statement is: *"the most recent `Skill` invocation in this loop, with the calls this loop has
made since"*. What that statement cannot know, on this pin:

- when a skill stops mattering — no event, and the instructions stay in the loop's context;
- whether a call was prompted by the skill, by CLAUDE.md, or by the user's own words;
- which of two skills loaded in the same loop owns a call;
- which loop a `skill.prompt` happened in.

## 7. What marks a turn's start and end

**Present, with one asymmetry.**

| Event | `e` | Fires |
|---|---|---|
| `turn.start` | `{ text, turnId }` | When a model turn begins, before its first model call. `turnId` is minted here. `next(e)` resolves `{ turnId }`; "a hook's own value does not change the turn" — observe only. **Main loop only: "a subagent's run raises no `turn.start`."** |
| `turn.step` | `{ turnId, index, model, effort?, messageCount, agentId? }` | Before each model request of a turn, main's or a subagent's. Streaming (`TurnStepChunk`), so a hook sees text, thinking, tool-call starts and arguments as they arrive. `next(e)` resolves `TurnStepResult` with `toolUses: TurnStepToolUse[]`. |
| `turn.complete` | `{ answer, durationMs, isAborted, turnId, agentId?, usage? }` plus `reason: 'answer' \| 'aborted' \| 'refusal' \| 'error'` and, on a refusal, `refusal` | When a turn ends, where its duration is reported. **Fires for a subagent's run too**, each run of its loop one turn, carrying its `agentId`. |

So: a main turn is bracketed by `turn.start` and `turn.complete` sharing a `turnId`. A subagent's turn has
only the end, and its steps; its start has to be inferred from its first `turn.step`, from `agent.spawn`, or
from `classic.SubagentStart`.

Two lesser boundary markers:

- **`prompt_id` on `BaseHookInput`** — every classic hook input carries it: "UUID correlating a user prompt
  with all subsequent events until the next prompt", the same value OpenTelemetry emits as `prompt.id`. It is
  a prompt-grain correlator, coarser than a turn (one prompt can span turns) and "absent until the first user
  input of the process lifetime". It groups classic events; it does not reach the `tool.call` chain, whose
  `e` has no `prompt_id`. The mods pages do not mention it, but DOCS says a `classic.*` event's `e` "is the
  JSON a settings hook receives on stdin", and the typings put it on `BaseHookInput`, which every
  `ClassicHookInputs` entry extends — so a `classic.PostToolUse` hook sees it.
- **`prompt.submit` and `session.measure`** — DOCS places `prompt.submit` "before the turn starts" and
  `session.measure` "after each turn", so they bracket a turn from outside the model loop.
  `classic.UserPromptExpansion` fires "when a user-typed command expands into a prompt, before it reaches
  Claude", matched on the command name; whether it fires for a skill the model invoked itself is **not
  documented**.
- **`classic.Stop` / `classic.SubagentStop`** — the settings-hook end markers. `Stop` carries
  `stop_hook_active`, `last_assistant_message?`, `background_tasks?` and `session_crons?`; `SubagentStop`
  adds `agent_id`, `agent_type` and `agent_transcript_path`. `MEMORY.md` already records that
  `classic.SubagentStop` never fires for a *failed* agent.

Nothing on any of these names a skill, so a turn bracket bounds a guess in time without identifying its
owner.

## 8. One-line answers to the ticket's four questions

1. **Every field on `tool.call` and `skill.prompt`.** `tool.call`: `tool`, `tool_use_id`, the tool's own
   arguments spread beside them, and `agentId` inside a subagent's or teammate's loop. `skill.prompt`:
   `skill` and `text`. Nothing else, either way.
2. **Does anything tie a running call to the skill in force?** No. Not an event, not `$.session.messages()`
   in either form, not `next.origin`. The only skill data the engine exposes beside `skill.prompt` is the
   context *listing* (`ContextSkills`).
3. **Is a skill in a subagent distinguishable via `agentId`?** A **forked** skill: yes, exactly — its `Skill`
   result names the subagent's `agentId`, and that loop's calls all carry it. An **inline** skill: no. A
   **preloaded** skill: no, and `skill.prompt` has no `agentId` to place it with.
4. **Does anything mark a turn's start and end?** Yes: `turn.start` (main loop only) and `turn.complete`
   (main and subagents), sharing a `turnId`, with `turn.step` between them. Classic hooks additionally share
   a `prompt_id` per user prompt.

## 9. Left untested

Each of these is reachable on this pin but needs a live run to settle; none changes the verdict in §1.

- Whether `classic.SubagentStart` fires for a forked skill's loop, and what its `agent_type` reads.
- Whether `$.agent.list()` names a forked skill in `description`, `type` or `name` in a way that identifies
  the skill, and how soon after the fork starts it appears.
- Whether `command.run` fires when a skill is invoked as `/name`. `CommandSource`'s doc calls `plugin` "a
  plugin's markdown command, **skill** or `$.command.register`", and DOCS (skills) says a skill is invoked
  "by typing `/` followed by the skill name" (`/plugin-name:skill-name` for a plugin's). But DOCS (mods API)
  documents `command.run` only for commands a mod registered itself, and neither page says the event fires
  for a skill. Unsettled either way.
- Whether `classic.UserPromptExpansion` fires for a skill, typed or model-invoked, and what it carries.
- Whether a `/name`-typed skill and a `Skill`-tool-called one differ in anything a mod can see beyond the
  presence of the `Skill` `tool.call`.
- Whether `agent.spawn` fires for a `context: fork` skill after all. DOCS (skills) says `context: fork`
  starts a subagent of the type in `agent`, which reads like the Agent path, while DOCS has no statement
  either way and the typings say a forked skill's loop is one "with no `agent.spawn`". If it does fire, its
  `subagentType` would be the agent type, not the skill's name, and a mod would still need the inline/forked
  split from frontmatter to know a skill caused it.
