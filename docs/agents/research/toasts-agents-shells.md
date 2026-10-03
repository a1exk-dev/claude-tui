# Agent and shell toasts: API facts and a signal spike (Claude Code 2.1.288)

Scope: the toasts and the "Agents & shells" sidebar plugin agreed in `claude-code-plugin-mods-structure.md` §6b. Every claim cites a primary source or a spike run. **Unverified** marks what neither source settles.

**Source keys**

- **DTS**: the API types this build writes when the `plugin-authoring` skill loads: `/tmp/claude-1000/bundled-skills/2.1.288/<hash>/plugin-authoring/types/claude-code.d.ts` (20,198 lines, Claude Code 2.1.288). The same file is laid in a loaded mod at `.claude-plugin/types/claude-code/index.d.ts`. Line numbers are for the bundled copy.
- **TOOLS**: `.claude-plugin/types/claude-code-tools/index.d.ts`, which the engine wrote into the spike mod when it loaded. It holds the built-in tool inputs as the model sees them.
- **CC:x Ln**: `https://code.claude.com/docs/en/plugins/mods/x`, at the line of its `.md` rendering fetched 2026-10-03. The reference page says it covers "v2.1.287" (reference L9).
- **SKR**: the bundled `plugin-authoring/reference.md`.
- **R1/R2/R3**: the spike runs in §5.

## 1. Summary

| Toast | Verdict | Source of truth |
|---|---|---|
| `◆ <type> started: <label>` | **Feasible.** `agent.spawn` carries `subagentType`, `description`, `background` and `parentAgentId`. It fired for every subagent, nested ones included (R1, R2). | `agent.spawn` hook |
| `$ <command> started in background` | **Feasible.** `tool.call` Bash with `run_in_background: true` fired before the shell started, and the result carries `backgroundTaskId` (R1, R2). | `tool.call` Bash, input and result |
| `✓ <type> done · <label> · <elapsed>` | **Feasible.** Agents: poll `$.agent.list()` for `status` leaving `running`, or parse the `task-notification` row. Shells: only the `task-notification` row. Elapsed is our own clock, because nothing in the list records a time. | `$.clock.every` poll plus `session.append` (origin `task-notification`) |
| `✗ <type> failed: <reason>` | **Partial.** A shell's failure has a reason (`failed with exit code 3`, R2). An agent's `failed`/`killed` status has no reason text. A shell stopped by TaskStop sends **no** notification (R2), so it is only seen in the TaskStop `tool.call` result. | Same, plus `tool.call` TaskStop |

Three corrections to the current notes:

- `session.receive` did **not** fire for local task notifications.
- `$.agent.list()` has no change event, so it has to be polled.
- In 2.1.288 the Agent tool backgrounds by default, so nearly every subagent counts as background.

## 2. Toast API

- **Signature.** `toast: (text: string, options?: ToastOptions) => void` (DTS L2261). `ToastOptions` has a single field, `timeoutMs?: number`, which defaults to 4000 (DTS L11926-11932; CC:reference L255). The event `ui.toast` carries `{ text, timeoutMs? }` (DTS L6541-6546). No other options exist: no color, no level, no id, no replace or update.
- **Look.** The toast is "a small box on the stack of plugin toasts over the transcript's top right corner", drawn "under the plugin's name" (DTS L2248-2249; CC:api L127 says "with the mod's name above the text").
  - The text is a plain string. An unpaired surrogate half becomes U+FFFD (DTS L2255-2256). There is no styling, so `◆ ✓ ✗ $` are just characters.
  - Whether the name shown is `name` (`ctui`) or `displayName` is **unverified**.
- **Interaction.** "A click takes it off, the pointer over it holds it" (DTS L2251).
- **Stacking.** The DTS calls it a stack (L2249). Ordering, the stack's maximum depth, and how overflow is handled are **not documented**.
- **Without fullscreen.** "Where the transcript is printed into scrollback (nothing to float over) it is one line on the notification bar" (DTS L2252-2253). Our toasts are one line, so they work in both renderers.
- **`holdToasts`.** While a pane opened with `holdToasts: true` is on screen, the surface holds "the plugin toast stack, the notification line" and shows them once the pane closes. Pinned warnings still show (DTS L6970-6976; CC:interface L319).
  - The ctui sidebar must **not** set `holdToasts`, or every agent toast waits until the sidebar closes.
- **Rate limits.** None are documented for toasts. The Limits table lists only the 4 s default (CC:reference L236-256). Redraw throttling (10/s) applies to `ui.render`, not to toasts. Coalescing a burst, such as five agents started in one message, is our job.
- **Where it shows.** Hooks run under `-p`, the SDK and VS Code, but nothing is drawn there (CC:overview L186-198).
  - The DTS describes no Desktop-specific toast behaviour, and `ui.toast` takes no `surface`. So does a toast appear in the Desktop Code tab? **Unverified.** The overview says the Code tab draws "panes, bands, and replaced rows" (L188) and does not mention toasts.
- **Testing.** `on('ui.toast', ($, e) => …)` in `claude plugin test` captures `e.text` (CC:test L169, L235-236). The spike test does exactly this (§5.4).

## 3. Agent signals

### 3.1 `$.agent.list()`

`list: () => Promise<AgentInfo[]>` returns "the session's subagents so far, the ones the model spawned and the ones plugins did alike" (DTS L2976-2979). The `AgentInfo` fields (DTS L125-161):

| Field | Meaning |
|---|---|
| `id` | The same string as `tool.call`/`turn.complete` `agentId` |
| `description` | The row's label. It is **not** called `label` |
| `type` | `general-purpose`, `Explore`, …, or `teammate` |
| `status` | `running`, `completed`, `failed`, `killed`, "or another of the engine's task statuses" |
| `parentId?` | The id of the subagent whose loop spawned it. Absent when the main loop spawned it |
| `spawnedBy?` | The plugin that spawned it |
| `name?` | The SendMessage address |

- **No times.** There is no start time, end time or duration field.
- **What it contains (observed).** Background agents, the ones the model called "foreground", and nested agents with `parentId` (R2, t=14912). Finished agents stay in the list with their final status. The list only grows during a session (R1-R3).
- **No change event.** Neither the DTS nor the docs define an event for a status change. Polling with `$.clock.every` worked: at a 500 ms poll, the change showed up within 0.1-0.4 s of `classic.SubagentStop` (R1-R3).
- **`completed` is per run, not final.**
  - In R3 the agent's own turn ended while its background shell was still running. The list said `completed` at t=13953, and the same id turned `killed` at t=14453 after TaskStop.
  - The notification note says such an agent "may resume on its own … and the same task-id notifies again" (R3 transcript). So the status can move `completed` → `running` again, or → `killed`.
  - In R2 the parent showed `completed` while its child was still `running`.

### 3.2 Start: `agent.spawn`

- **Fields.** `AgentSpawnInput` (DTS L239-325) has `tool_use_id`, `prompt`, `description`, `subagentType`, `provider`, `model?`, `parentModel`, `parentAgentId?`, `permissionMode?`, `background`, `fork`, `name?` and `cwd?`. The result is `{ model, agentId? }` or `{ deny }` (DTS L331-357). The docs say it fires when "a subagent is about to start" (CC:reference L120).
  - Observed in R1: `{"description":"list work dir","subagentType":"Explore","background":true,"fork":false,…}` → `next` → `{"model":"claude-haiku-4-5-20251001","agentId":"a699d7f71a99541c3"}`.
- **Nesting.** In R2 the nested spawn carried `"parentAgentId":"a4609cdea6b9661f0"`.
- **Background is the default.** The model's Agent tool input reads "Agents run in the background by default … Set to false only when …" (TOOLS L15-16). In R2, an Agent call with no `run_in_background` still had `background: true` and `async_launched`. So the `background` flag cannot be used to filter which agents get toasts.
- **Other start signals that fired (redundant).**
  - `classic.SubagentStart` `{agent_id, agent_type}` (DTS L11544-11548).
  - The `tool.call` Agent result `{status:"async_launched", agentId, description, outputFile}` (DTS L15781). A subagent's own Agent call carries `agentId` = the parent (R2, t=14672).

### 3.3 End: what fired

| Signal | Fired? | Fields | Notes |
|---|---|---|---|
| `$.agent.list()` status | Yes, via polling | `status` | The only signal that showed `killed` (R3) |
| `classic.SubagentStop` | Yes, at each subagent turn end | `agent_id`, `agent_type`, `last_assistant_message`, `agent_transcript_path`, `background_tasks[]` (DTS L11550-11570) | Fires when the agent's turn ends, not when it is finally done |
| `turn.complete` with `agentId` | Yes, right after SubagentStop | `answer`, `durationMs` (that turn only), `reason` (`answer`/`aborted`/`refusal`/`error`), `agentId` (DTS L12475-12522; CC:events L238) | `reason:'error'` is a possible failure reason (**unverified**: not seen) |
| `session.append` with `origin.kind === 'task-notification'` | Yes, once per agent stop | The row's text holds `<task-id>`, `<tool-use-id>`, `<status>`, `<summary>`, `<result>`, `<usage>…<duration_ms>` | Notifies again if the agent resumes. `<status>completed</status>` even when the agent later got killed (R3) |
| `turn.start` whose `text` starts with `<task-notification>` | Only when the notification starts a new main turn | `text` | A notification delivered into a running turn raises only `session.append` (R2, t=16255) |
| `session.receive` | **No**, in all three runs | — | The DTS says its `task-notification` kind is "a relay's event or a trigger" (L10693-10695). The docs list the kind (CC:api L161) but don't say that local tasks skip it |
| `ui.render` `UserMessage` `props.task` | Not in headless (no surface) | `task.{id,status,type?,toolUseId?,durationMs?}` (DTS L9168-9172, L13650-13677; SKR L103) | Render-only and interactive-only. A render hook must not write state (SKR, see structure doc §3.3). Not a data source |

## 4. Shell signals

- **Start.** `tool.call` with `{ tool: 'Bash' }`. The input fields are `command`, `description?`, `timeout?`, `run_in_background?` and `dangerouslyDisableSandbox?` (DTS L15177-15188; TOOLS L205-216). The result has `backgroundTaskId?`, plus `backgroundedByUser?` (Ctrl+B), `backgroundedByTurnAbort?`, `backgroundedToDeliverMessage?` and `timedOutAfterMs?` (DTS L19128-19150).
  - **Recommendation: key the start on the result's `backgroundTaskId`, not the input flag.** The result also covers Ctrl+B and auto-backgrounded commands, and gives the id the end signal uses.
  - Observed in R1: input `{"command":"sleep 5; echo done","run_in_background":true}` gave result `{"backgroundTaskId":"b2ks3xm35"}` 30 ms later.
  - A subagent's shell call carries `agentId` (R3, t=10717), which gives the `└` nesting under that agent.
- **Normal end (completed or failed).** The only signal is the `task-notification` row (`session.append`, and `turn.start` when the notification opens a turn).
  - Completed: `<status>completed</status><summary>Background command "sleep 5; echo done" completed (exit code 0)</summary>` (R1).
  - Failed: `<status>failed</status><summary>Background command "Exit with code 3 after 2 seconds" failed with exit code 3</summary>` (R2). The quoted name is the Bash `description` when one was given, otherwise the command.
  - A shell's notification has no `<duration_ms>`.
- **Stopped by TaskStop.** No notification arrived at all (R2: `bgp3f9guc` never notified). The TaskStop `tool.call` result names it: `{task_id:"bgp3f9guc", task_type:"local_bash", command:"sleep 60", message:"Successfully stopped task…"}`.
  - The TaskStop input is `task_id?` plus a deprecated `shell_id?` (DTS L15628-15633). The result is at DTS L20049-20058. Killing an agent gives `task_type:"local_agent"` (R3).
  - A stop the person makes from the UI (the tasks dialog) goes through no tool call. How it can be seen is **unverified**.
- **`classic.Stop` / `classic.SubagentStop` `background_tasks[]`.** Fields: `{id, type: 'shell'|'subagent'|'monitor'|'workflow', status, description, command?, agent_type?, …}` (DTS L642-673, L11433).
  - It lists only work still in flight, and only at turn ends. In R1 the shell finished at about 8.7 s, and the Stop at t=8833 already showed `[]`.
  - Useful as a reconciliation sweep, such as removing shells that disappeared. It cannot report an end time or an exit status.
- **BashOutput / KillShell.** Not in 2.1.288's tool table. TaskStop replaces KillShell, and reading the output file replaces BashOutput: the Bash result text says "use Read on that file path" (R2). `classic.TaskCreated`/`TaskCompleted` are about the todo task list (`task_subject`; DTS L11623-11645), and neither fired.
- **Reliability ranking.**
  1. `task-notification` rows, for completed and failed. They fired every time.
  2. TaskStop results, for kills made by the model.
  3. `background_tasks` at Stop, to sweep. A shell killed from the UI or lost to a reload is caught only by step 3 (**unverified**).

## 5. Spike results

### 5.1 Setup

- The mod lives in `scratchpad/toast-spike/` (`hooks/register.tsx`, `tests/toasts.test.ts`, logs `signals-run{1,2,3}.log`).
- It hooks: `session.start` (starts a 500 ms `$.agent.list()` poll), `agent.spawn`, `turn.start`, `turn.complete`, `tool.call` for Bash/Agent/TaskStop/Monitor (input and result), `classic.SubagentStart`/`SubagentStop`/`Stop`/`TaskCreated`/`TaskCompleted`/`Notification`, `session.receive`, `session.append`, `ui.render` UserMessage, and `session.end`.
- Logging: each event goes to an in-memory array, and the whole log is rewritten on each event through `$.fs.write` on a serialized promise chain. Each toast is raised and logged as `TOAST`.
- Passing `$` to top-level functions in the same file (`log($,…)`, `pollAgents($)`) validated.
- `claude plugin validate` passed with only the author warning. `tsc -p` against the engine-written tsconfig passed. `claude plugin test` gave 1 pass.

### 5.2 Gotcha

The first `claude -p --plugin-dir` run printed `hooks module not loaded: hooks modules are turned off for installed plugins in this process: the rollout switch was saved off by an earlier session and is not refreshed yet`. The next run loaded. This is a cached feature flag, and it hits a fresh `-p` process.

### 5.3 Commands and runs

All runs used `cd work && claude -p "<prompt>" --plugin-dir <spike> --permission-mode bypassPermissions --model haiku`, and each took about 13-25 s.

- **R1:** a background Explore agent plus a background Bash `sleep 5; echo done`.

  ```
  t=3334  agent.spawn  {description:"list work dir",subagentType:"Explore",background:true}
  t=3334  TOAST ◆ Explore started: list work dir
  t=3340  classic.SubagentStart {agent_id:"a699d7f71a99541c3",agent_type:"Explore"}
  t=3704  tool.call:Bash {command:"sleep 5; echo done",run_in_background:true}
  t=3704  TOAST $ sleep 5; echo done started in background
  t=3734  tool.call:Bash:result {backgroundTaskId:"b2ks3xm35"}
  t=5783  classic.Stop background_tasks:[{type:"subagent",status:"running"…},{type:"shell",command:"sleep 5; echo done",status:"running"}]
  t=7202  classic.SubagentStop {agent_id:"a699…",last_assistant_message:"a.txt"}
  t=7203  turn.complete {agentId:"a699…",durationMs:3866,reason:"answer"}
  t=7293  session.append origin.kind=task-notification   (agent)
  t=7400  agent.list [{…status:"completed"}]   → TOAST ✓ Explore done · list work dir · 4s
  t=8833  classic.Stop background_tasks:[]      (shell already gone)
  t=8838  session.append origin.kind=task-notification   (shell b2ks3xm35, completed, exit 0)
  session.receive: never
  ```

- **R2:** a failing background shell (`sleep 2; exit 3`), a background `sleep 60` stopped by TaskStop, a general-purpose agent that spawns an Explore, and an Agent call with no background flag.
  - Every spawn was `background:true`.
  - The nested `agent.spawn` had `parentAgentId`, and `agent.list` showed `parentId`.
  - The failed shell's notification arrived mid-turn, as `session.append` only (t=16255).
  - The stopped shell got only `tool.call:TaskStop:result {task_type:"local_bash"}` and never a notification.
  - `agent.list` flipped the parent to `completed` while its child was still `running`.
- **R3:** a background agent that backgrounds its own `sleep 40`, then TaskStop on the agent.
  - `agent.list` went `running` → `completed` (t=13953, when its turn ended) → `killed` (t=14453).
  - The single notification said `completed`, with the note "stopped with background work of its own still running … the result below may be interim."

### 5.4 What headless could not show

- Whether toasts are actually drawn, how they stack, and how `holdToasts` behaves. `-p` draws nothing (CC:overview L196), and `session.start` reported `surface:null, isInteractive:false`.
- `ui.render` UserMessage never fired.
- **How the test covers this.** `tests/toasts.test.ts` drives `$.agent.spawn` and `$.tool.call({tool:'Bash',run_in_background:true})`, and stubs `agent.list` together with `mock.clock`. It asserts all three toast strings. Interactive behaviour of the toasts is still **unverified**.

## 6. Recommended implementation for `register.tsx`

**Hooks.** All of them observe and return `next(e)` unchanged.

1. `agent.spawn` → `await next(e)` to get `agentId`. Then add an entry `{kind:'agent', id, type:e.subagentType, label:e.description, parent:e.parentAgentId, startedAt:await $.clock.now(), status:'running'}`, and toast `◆ ${type} started: ${label}`.
2. `tool.call` `{tool:'Bash'}` → `const r = await next(e)`. If `r.result?.backgroundTaskId` is set, add `{kind:'shell', id: backgroundTaskId, command:e.command, label:e.description ?? e.command, parent:e.agentId, startedAt, status:'running'}`, and toast `$ ${short(e.command)} started in background`.
3. `session.append` with matcher `{ origin: { kind: 'task-notification' } }` (validates and type-checks in the spike) → join the row's text blocks and regex out `<task-id>`, `<status>`, `<summary>`, `<duration_ms>`.
   - For a known shell id: set `completed` or `failed`, and toast `✓ shell done · <label> · <elapsed>` or `✗ shell failed: <exit code N>` (from `summary`).
   - For an agent id: use it as a fast path for the `done` toast. `<duration_ms>` gives the elapsed time, and the result text is available for a tooltip.
   - Parse defensively, because the format is not a documented API (**unverified** stability).
4. `tool.call` `{tool:'TaskStop'}` → after `next`, mark `result.task_id` as `killed` (`local_bash` or `local_agent`) and toast `✗ <type> failed: stopped`.
5. A `$.clock.every(1000)` poll, started in `session.start`, runs only while some entry is `running`. It calls `$.agent.list()` and reconciles agent status: it adds agents a hook missed (spawned before a reload) and catches `failed`/`killed`, which no notification reports.
   - The same tick redraws the `◐` timers. 1 s matches the seconds display. The R1-R3 lag at 500 ms was at most 0.4 s, so 1 s is enough.
6. `classic.Stop` → a sweep. Any shell we hold as `running` that is missing from `background_tasks` is marked `done?` (status unknown) and dropped silently, without a toast.

**Toast rules.**

- Toast an agent's terminal status once, on the first transition out of `running`.
- If it later returns to `running` (a resume), update the sidebar only.
- Toast `killed` if it follows a `completed`, because R3 showed that this sequence is real.
- When several events come within about 300 ms, coalesce them into one line (`◆ 3 agents started`), because no rate limit or stack depth is documented.
- Gate everything on `agents_toasts`.

**Data model.** One `$.state` atom, declared in `types/index.d.ts`, holds `tasks: Record<id, Task>`.

```ts
type Task = {
  id: string; kind: 'agent' | 'shell'
  type: string            // subagentType, or 'shell'
  label: string           // description, or command
  parent?: string         // parentAgentId / tool.call agentId → └ nesting
  status: 'running' | 'completed' | 'failed' | 'killed' | string
  startedAt: number       // $.clock.now() at spawn / backgroundTaskId
  endedAt?: number        // set on transition; drop from view at endedAt + 8000
  reason?: string         // shell: "exit code 3"; agent: status word
}
```

- The `agents` sidebar plugin receives `tasks` and `now` as data.
- It renders `◐` + `now - startedAt` for running entries, `└` by `parent`, `$` for shells, and `✓`/`✗` while `now < endedAt + 8000`.
- The heading count is the number of running entries.
- Elapsed time comes only from `$.clock.now()`, the mod's own clock: `AgentInfo` has no times. The notification's `<duration_ms>` and `turn.complete.durationMs` cover a single run, not the whole lifetime.

## 7. Corrections to existing notes

- **structure doc §4, "Agents & shells" row.** The fields are `description` (not label) and `parentId`, plus `spawnedBy` and `name`. There are no times (DTS L125-161).
  - The `classic.Stop background_tasks` line cites DTS L642-665 and L11423-11433. That is right, but the list holds in-flight work only.
- **structure doc §6b, "`$.agent.list()` gives status changes".** It gives a snapshot. There is no change event, so poll it (§3.1).
- **structure doc §6b and MEMORY, "Its end has no reliable signal" / "shell ends are unreliable".** Wrong for normal ends. Completed and failed shells always produced a `task-notification` row (`session.append`, origin kind `task-notification`). Only kills (TaskStop, and the UI **unverified**) produce none.
- **structure doc §4 "`UserMessage` task notifications (`e.props.task.status`)" as a data source.** It is render-only and does not fire under `-p`. Use `session.append` instead.
- **Task prompt assumption "`session.receive` … `task-notification`".** It did not fire for local background tasks in 2.1.288 (R1-R3).
- **Assumption that background agents are a subset.** In 2.1.288 the Agent tool backgrounds by default (TOOLS L15-16), so filtering on `background` filters out almost nothing.
- **structure doc §6b, toast box.** Add that toasts become one line on the notification bar in the non-fullscreen renderer (DTS L2252), and that the sidebar pane must not use `holdToasts`.

## 8. Open questions

1. Desktop Code tab: are plugin toasts drawn? Nothing documents it. Test in the Desktop app.
2. Toast title: `name` or `displayName`? And the stack's maximum depth and order. Check in an interactive session.
3. An agent that dies on an API error: does `agent.list` say `failed`, and does its notification say `<status>failed</status>` with a reason? Not reproduced.
4. Shells killed from the UI tasks dialog, or orphaned by `/clear` or a reload: do they send any signal besides vanishing from `background_tasks`?
5. Is the `<task-notification>` XML format stable? It is engine text, not typed API. Prefer `UserMessageTask` if a typed source for the data appears.
6. Teammates (`type: 'teammate'`) and Workflow agents: Workflow agents' ids are not in `agent.list` (DTS L177-178). Decide whether to show them.

## Live prototype results (2026-10-03, `prototypes/toasts-mod`, Claude Code 2.1.288, terminal)

Reported by the human after running `/ctui-proto-toasts demo` with variant a:

- **Toasts draw** at the top right.
- **They are queued, not stacked.** They appeared one after another. With 7 toasts in about 6 s of events, the queue fell behind: the `✗ … failed: context limit` toast arrived before the 4th `◆ started` toast had shown. Each toast keeps its 4 s default, so a burst makes later toasts stale.
- **The title is the plugin `name`** (`ctui-proto-toasts`), not `displayName`. For ctui both are `ctui`.
- **Decision: variant a, one toast per event.**
- **Follow-up for the implementation:** keep a toast queue short when events come in bursts. Candidates are a shorter `timeoutMs` for `◆`/`$` start toasts, and dropping a queued start toast once its finish toast is queued. Measure in the real mod.
- **Update-notice probe:** only `InfoNotice` "1 more notice hidden" was observed. The "Auto mode is now the default" announcement did not pass through `InfoNotice` or `PromptHint`, so announcements may be invisible to mods. An update notice has not yet been observed.
