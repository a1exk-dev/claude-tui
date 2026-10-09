# How a mod nudges Claude to keep a task list (Claude Code 2.1.292)

Ticket: #208, part of map #205. Question: which channels can ctui use to tell Claude to keep a task list for multi-step work, what each one costs, where it survives, who sees it, and what Claude Code already says about the task tools.

Every claim cites a source. **Unverified** marks what no source settles.

**Source keys**

- **DTS Ln**: `vendor/claude-code-types/claude-code/index.d.ts`, the vendored mod API types for the pinned 2.1.292.
- **BIN**: the pinned binary `node_modules/@anthropic-ai/claude-code/bin/claude.exe` (2.1.292). Its strings were dumped with `strings -n 20`. Minified names are quoted as found.
- **DOC:x**: `https://code.claude.com/docs/en/x`, fetched 2026-10-09.
- **Rx**: the spike runs in §6 (`prototypes/research-208/`, local only, since `prototypes/` is gitignored).

## 1. Answer

Opus 5.5 never hears about the task tools unless something brings them up. The variable that ctui sets turns the tools on, but they arrive as deferred tools, listed by name only. The short ("lean") system prompt that Opus 5.5 gets has no task line (R1, §2). In both baseline runs Claude made no task list for a three-step job (R1, R7). With any of three nudges it made one, with two TaskCreate and two TaskUpdate calls (R2, R5, R8). Each case is a single run, so this shows the effect is plausible, not how big it is.

Two channels fit best:

1. **`prompt.compose`: add one `session` section** (`ctui:todo-nudge`) to the main loop's system prompt. It is sent on every request after the cache boundary, so it costs a few dozen cached tokens per request. It survives `/clear`, compaction and `/resume`, because the prompt is rendered again each time. Subagents don't see it, and the person can't see it outside `/context`. ctui can gate it on a setting.
2. **`tool.describe` → `isDeferred: false` for `TaskCreate` and `TaskUpdate`**. This moves Claude Code's own tool descriptions into the prompt. Those descriptions already say "Use this tool proactively… 3 or more distinct steps". It costs about 4.4k characters of schema per request, cached. It reaches subagents too (R5).

The other channels work but fit worse. Context attached on `prompt.submit` repeats on every prompt and builds up in history. `classic.SessionStart` context is one row that a compaction or `/clear` has to add again, and it shows in the transcript. An output style takes the person's only style slot.

## 2. What Claude Code already says

**System prompt, full variant.** Its `tools` section ("# Using your tools") adds one line when `TaskCreate` or `TodoWrite` is among the request's tools (BIN, function `NNo`):

> Use ${TaskCreate|TodoWrite} to plan and track work. Mark each task completed as soon as it's done; don't batch.

A longer branch, guarded by `uN()`, is compiled to `function uN(){return!1}` in this build, so it never runs:

> Break down and manage your work with the ${n} tool. These tools are helpful for planning your work and helping the user track your progress. Mark each task as completed as soon as you are done with the task. Do not batch up multiple tasks before marking them as completed.

**System prompt, lean variant.** When `pK(model)` holds, the engine sends `lean_body` in place of `intro`, `system`, `doing_tasks`, `actions`, `tools` and `tone` (BIN `pVt`; DTS L8340-8345). `lean_body` has no task line. On Opus 5.5 the prompt was lean (`traits=lean`). Its sections were `lean_body communication pronouns action_caution session_guidance memory env_info_simple context_management act_dont_rederive brook_heron total_tokens`, and none mentions TaskCreate or TodoWrite (R1, `run-a/compose-2.txt`). DOC:output-styles says `CLAUDE_CODE_SIMPLE_SYSTEM_PROMPT=0` "selects the full prompt on any model", which would bring back the one line above, but it also swaps the whole prompt.

**Tool descriptions.** These are where the guidance lives (BIN):

- `TaskCreate` (2146 characters, R5) opens: "Use this tool to create a structured task list for your current coding session. This helps you track progress, organize complex tasks, and demonstrate thoroughness to the user." Its "When to Use This Tool" list starts: "Use this tool proactively in these scenarios: Complex multi-step tasks - When a task requires 3 or more distinct steps or actions; Non-trivial and complex tasks…; Plan mode…; User provides multiple tasks…; After receiving new instructions - Immediately capture user requirements as tasks". "When NOT to Use" covers single, trivial and conversational tasks.
- `TodoWrite` carries the same text, plus examples and "When in doubt, use this tool. Being proactive with task management demonstrates attentiveness and ensures you complete all requirements successfully."
- With `CLAUDE_CODE_ENABLE_TODO_TOOLS` set, Opus 5.5 gets `TaskCreate`, `TaskGet`, `TaskList`, `TaskStop` and `TaskUpdate`, and every one of them is deferred (`isDeferred=true` in `tool.describe`, R5). The model sees only their names in the `deferred_tools_delta` reminder, so it never reads the "proactively" text unless it loads the tool through ToolSearch first.

**Reminders the engine injects** (attachments, BIN `uAr` and `pAr`). After 10 assistant turns without a task write, and at least 10 turns since the last reminder (`TURNS_SINCE_WRITE:10`, `TURNS_BETWEEN_REMINDERS:10`), the engine attaches one of these:

- `task_reminder`, when the Task tools are on: "The task tools haven't been used recently. If you're working on tasks that would benefit from tracking progress, consider using TaskCreate to add new tasks and TaskUpdate to update task status (set to in_progress when starting, completed when done). Also consider cleaning up the task list if it has become stale. Only use these if relevant to the current work. This is just a gentle reminder - ignore if not applicable." It is followed by the open tasks, as `#id. [status] subject`.
- `todo_reminder`, for TodoWrite: "The TodoWrite tool hasn't been used recently. If you're working on tasks that would benefit from tracking progress, consider using the TodoWrite tool to track progress. …"
- Both are off when `CLAUDE_CODE_TODO_REMINDER_MODE=off`, or when the flag `tengu_soft_slate_nudge` is `off` (BIN `Dun`). They come only after 10 turns, too late for the first multi-step job. A mod can rewrite or drop them with `prompt.attachment` (DTS L4158-4167).

## 3. Mechanisms

"Cost" means extra input tokens on each request. Cached text is billed at the cache-read rate after the first request (DOC:output-styles, "prompt caching reduces this cost"; DTS L8320-8327 on the `shared`/`session` boundary).

| Mechanism | Cost per request | `/clear` | Compaction | `/resume` | Subagents | Person sees / turns off |
|---|---|---|---|---|---|---|
| **`prompt.compose`**: append `{ id: 'ctui:…', scope: 'session' }` (DTS L4149-4156, L8300-8350) | Section size (~30 tokens), cached after the cache boundary | Kept: the hook answers each render. **Unverified** live, since `-p` has no `/clear` | Kept: the next request renders it again (R4) | Kept (R3) | **No.** The subagent's request carried no compose nudge (R2: `R208-COMPOSE` appears only in the main transcript's `prompt_snapshot`) | Hidden: it is recorded only in the hidden `prompt_snapshot` row (R2). Off through a ctui setting |
| **`prompt.section`**: rewrite an existing section, e.g. append to `session_guidance` (DTS L4120-4134) | Same as above. A text that changes "spends the prompt cache every call" (DTS L4126) | Kept | Kept | Kept | No (same prompt path) | Hidden. Weaker than compose: it depends on an engine section id staying put |
| **`tool.describe`**: `isDeferred: false` on TaskCreate and TaskUpdate (DTS L4183-4196) | ~4.4k characters (2146 + 2243), about 1.1k tokens, cached. "Cached for the session until `$.ui.invalidate`" | Kept | Kept | Kept | **Yes.** Pinned tools also left the subagent's deferred list (R5) | Hidden. Visible in `/context` as tool tokens. Off through a ctui setting |
| **`prompt.submit`**: `next({ ...e, context: [...] })` (DTS L9006-9016) | The text once per submitted prompt. Every earlier copy stays in history, so N prompts carry N copies until compaction | Earlier copies are gone, and the next prompt adds one | Copies before the boundary are summarised away, and the next prompt adds one (R4) | Earlier copies replay from the transcript (R3: both copies reached the request) | No. It is the main loop's user turn | In the transcript as a `hook_additional_context` row from `prompt.submit` (R2). Shown under ctrl+o per DOC:hooks |
| **`classic.SessionStart`**: add `additionalContext` (DTS L1281-1284, L1353). Sources `startup`, `resume`, `clear`, `compact` and `fork` (DTS L11565) | Once per session and once more after each compaction. ≤10,000 characters (DOC:hooks) | Fires with `source: 'clear'` (DTS). **Unverified** live | Fires with `source: 'compact'`, and the row is written after the boundary (R4) | Fires with `source: 'resume'`, but no new row was written. The old row replays (R3) | No (R2) | In the transcript as a "SessionStart hook additional context" reminder (R2, DOC:hooks) |
| **`classic.SubagentStart`**: `additionalContext` (DTS L1357) | Once per subagent | n/a | n/a | n/a | **Only** subagents (R2) | Subagent transcript row |
| **`classic.UserPromptSubmit`**: `additionalContext` (DTS L1351) | Same as `prompt.submit` | Same | Same | Same | No | Transcript row. Behaves like `prompt.submit` but runs below the module chain (DTS L1229-1236) |
| **`prompt.context`**: add a block to the first user message's context (DTS L4136-4147, L8379-8437) | One block in the first message, cached as history | Recomputed ("a re-read (compaction, `/clear`)") | Recomputed | **Unverified** | **Unverified** | Hidden. Fires once per conversation |
| **`prompt.attachment`**: rewrite the engine's `task_reminder` or `todo_reminder` (DTS L4158-4167) | Only when the engine sends one, at most every 10 turns | Kept (hook) | Kept | "asked again on resume" (DTS) | Reminders carry `agentId` (R1) | Hidden reminder. It doesn't fix the cold start, because it fires only after 10 idle turns |
| **Plugin output style** in `output-styles/`, optionally `force-for-plugin: true` (DOC:output-styles) | Style text on every request, cached | Kept (setting) | Kept | Kept | No. Only main and forks: "Other subagents run their own system prompt" | Listed in `/config` → Output style and `/output-style`. `force-for-plugin` "Overrides the user's `outputStyle` setting" and takes the person's only slot. A custom style drops `doing_tasks` on the full prompt unless `keep-coding-instructions: true`, which does nothing on the lean prompt |
| **`agent.spawn`**: rewrite the subagent's `prompt` (DTS `AgentSpawnInput.prompt`) | Once per subagent | n/a | n/a | n/a | Subagents only | Not seen. YAGNI for the Sidebar |

Not available to a mod: `--append-system-prompt` (a CLI flag, DOC:output-styles), and the engine's `CLAUDE_CODE_SIMPLE_SYSTEM_PROMPT`. ctui could set the latter with `$.env.set`, but that swaps the whole system prompt (§2).

## 4. Facts that shape the choice

- The tool list in `prompt.compose` already holds the Task tools when the variable is set (`tools=TaskCreate,TaskGet,TaskList,TaskStop,TaskUpdate`, R1). A compose hook can therefore add the nudge only when `TaskCreate` or `TodoWrite` is in `e.tools`, the same gate the engine's own line uses (§2).
- `prompt.compose` also fires for `/context`'s measuring render (`traits` includes `analysis`, R1), so the section shows in `/context`'s count.
- Under `-p` the compose hook ran in more than one place: its log lines from R2, R5 and R8 were lost to a concurrent writer, while its dumps were written. The engine renders detached sections through a separate path (BIN `detachedSections`). Keep the hook pure: no `$.state` writes, the same text every call.
- Subagent task lists: with the pin, the subagent got TaskCreate in its prompt too (R5). Whether a subagent's tasks reach the Sidebar is #206/#207's question, not this one.

## 5. Recommendation for #210

Use `prompt.compose`: append one short, fixed `session` section only when `e.tools` holds `TaskCreate` or `TodoWrite`, gated by a ctui setting tied to `todo_tools`. Model it on OpenCode's wording: for work of 3 or more steps, create the tasks first and mark each one done as it finishes. It is the cheapest channel, survives everything, adds no transcript rows, and doesn't touch the person's output style.

Pinning TaskCreate and TaskUpdate (`tool.describe`) is the stronger fallback if the section alone proves weak. It costs about 1.1k tokens per request and also reaches subagents. Skip `prompt.submit` and `SessionStart` context: they add visible rows and repeat in history. Skip output styles: they take the person's only slot.

## 6. Spike runs

Spike mod: `prototypes/research-208/spike/` (hooks: `prompt.compose`, `prompt.attachment`, `prompt.context`, `prompt.submit`, `classic.SessionStart`, `classic.SubagentStart`, `tool.describe`). Each channel is switched by an environment variable: `R208_NUDGE`, `R208_COMPOSE`, `R208_PIN`. Command:

```sh
CLAUDE_CODE_ENABLE_TODO_TOOLS=1 R208_OUT=<dir> [R208_NUDGE=1|R208_COMPOSE=1|R208_PIN=1] \
  node_modules/.bin/claude -p --model opus --plugin-dir prototypes/research-208/spike \
  --permission-mode bypassPermissions --output-format json \
  "Use the Agent tool (general-purpose) to have a subagent read calc.py and report its bugs in one line. Then fix both bugs in calc.py and add a third function sub(a,b). Be brief."
```

The task runs in a scratch folder holding a two-bug `calc.py`. Model: Opus 5.5 (`claude-opus-5-5`), 2.1.292, 2026-10-09.

| Run | Channel | Task calls (main) | Notes |
|---|---|---|---|
| R1 (`run-a`) | none | 0 | Lean prompt with no task line. The Task tools appear only in `deferred_tools_delta` |
| R7 (`run-a2`) | none | 0 | Repeat of R1 |
| R2 (`run-b`) | compose + submit + SessionStart + SubagentStart | 1 TaskCreate, 1 TaskUpdate | The subagent's transcript held only `R208-SUBAGENTSTART`. The main transcript held SessionStart, submit and compose (in `prompt_snapshot`) |
| R3 (`run-c`) | R2's session, `--resume`, all nudges | n/a | `SessionStart source=resume` fired, but no new SessionStart row was written. Both submit copies reached the request |
| R4 (`run-d`) | R2's session, `--resume` + `/compact` | n/a | `SessionStart source=compact` fired, and its row was written after `compact_boundary`. The earlier submit rows survive only in the summary |
| R5 (`run-e`) | `tool.describe` pin of TaskCreate and TaskUpdate | 2 TaskCreate, 2 TaskUpdate | Both left the deferred list in the main loop and in the subagent |
| R8 (`run-f`) | compose only | 2 TaskCreate, 2 TaskUpdate | |

**Unverified**: `/clear` live (the REPL only), `prompt.context` on subagents and on resume, and whether the nudge raises task use on real multi-step work beyond these single runs.
