# OpenCode's todo list: prompts, tool shape and TUI sidebar (v1.18.35)

Scope: ticket #207 for map #205 (ctui 0.5.0 Todo list). How OpenCode (sst/opencode) gets the model to keep a todo list, what the tool accepts, and how its terminal UI draws the list. Every claim cites OpenCode source.

**Source:** tag `v1.18.35` (commit `53d1eab`), read 2026-10-09. `main` at `3884062` (2026-10-08) has byte-identical copies of every cited file (blob SHAs compared). Links below use `https://github.com/sst/opencode/blob/v1.18.35/`.

## 1. Summary

- **Driving.** The push comes mostly from the **tool description** of `todowrite`, which every model sees: "Use proactively when" the task has 3+ steps, "exactly ONE" `in_progress`, mark `completed` at once, and "When in doubt, use it." On top, the **Claude-model system prompt** (`anthropic.txt`) adds a "# Task Management" section: use TodoWrite "VERY frequently", mark todos completed "as soon as you are done", and "IMPORTANT: Always use the TodoWrite tool to plan and track tasks throughout the conversation." There are no runtime reminders: nothing in `session/` injects a todo nudge mid-session.
- **Tool.** One tool, `todowrite`, takes the **whole list** every call (`{ todos: [{ content, status, priority }] }`) and replaces the stored list. `status` is `pending | in_progress | completed | cancelled`; `priority` is `high | medium | low`. Both are free strings in the schema, documented only in descriptions. `todoread` existed but was **removed** on 2026-03-25 (#19128). Subagents are denied `todowrite` by default.
- **Drawing.** The sidebar section is titled bold **`Todo`** with **no count**. Rows are `[✓]`, `[•]`, `[ ]` + content, in the model's order, in two colors: `in_progress` uses theme `warning` (orange), every other status uses `textMuted` (grey). There is **no strikethrough**, and `cancelled` looks exactly like `pending`. All rows show, word-wrapped. A list longer than 2 gets a `▼`/`▶` toggle, starting open. The section is **hidden** when the list is empty or every item is `completed`.

## 2. Prompts that drive the list

### 2.1 Which system prompt a model gets

`session/system.ts` picks one base prompt by model id ([`packages/opencode/src/session/system.ts` L28-L50](https://github.com/sst/opencode/blob/v1.18.35/packages/opencode/src/session/system.ts#L28-L50)): `muse*` → `meta.txt`; `gpt-4`/`o1`/`o3` → `beast.txt`; `gpt-6` → `gpt-astra.txt`; `*codex*` → `codex.txt`; other `gpt` → `gpt.txt`; `gemini-` → `gemini.txt`; `claude` → `anthropic.txt`; trinity, kimi, else `default.txt`.

Only `anthropic.txt`, `meta.txt` and `beast.txt` mention todos. `gpt.txt`, `codex.txt`, `gemini.txt`, `default.txt` and the rest do not; those models learn about todos only from the tool description (§3.2). `copilot-gpt-5.txt` mentions "the todo tool" but nothing imports it.

### 2.2 `anthropic.txt` (Claude models), word for word

[`packages/opencode/src/session/prompt/anthropic.txt` L23-L67](https://github.com/sst/opencode/blob/v1.18.35/packages/opencode/src/session/prompt/anthropic.txt#L23-L67):

```text
# Task Management
You have access to the TodoWrite tools to help you manage and plan tasks. Use these tools VERY frequently to ensure that you are tracking your tasks and giving the user visibility into your progress.
These tools are also EXTREMELY helpful for planning tasks, and for breaking down larger complex tasks into smaller steps. If you do not use this tool when planning, you may forget to do important tasks - and that is unacceptable.

It is critical that you mark todos as completed as soon as you are done with a task. Do not batch up multiple tasks before marking them as completed.

Examples:

<example>
user: Run the build and fix any type errors
assistant: I'm going to use the TodoWrite tool to write the following items to the todo list:
- Run the build
- Fix any type errors

I'm now going to run the build using Bash.

Looks like I found 10 type errors. I'm going to use the TodoWrite tool to write 10 items to the todo list.

marking the first todo as in_progress

Let me start working on the first item...

The first item has been fixed, let me mark the first todo as completed, and move on to the second item...
..
..
</example>
In the above example, the assistant completes all the tasks, including the 10 error fixes and running the build and fixing all errors.

<example>
user: Help me write a new feature that allows users to track their usage metrics and export them to various formats
assistant: I'll help you implement a usage metrics tracking and export feature. Let me first use the TodoWrite tool to plan this task.
Adding the following todos to the todo list:
1. Research existing metrics tracking in the codebase
2. Design the metrics collection system
3. Implement core metrics tracking functionality
4. Create export functionality for different formats

Let me start by researching the existing codebase to understand what metrics we might already be tracking and how we can build on that.

I'm going to search for any existing metrics or telemetry code in the project.

I've found some existing telemetry code. Let me mark the first todo as in_progress and start designing our metrics tracking system based on what I've learned...

[Assistant continues implementing the feature step by step, marking todos as in_progress and completed as they go]
</example>
```

Under "# Doing tasks", the step list's first item ([L73](https://github.com/sst/opencode/blob/v1.18.35/packages/opencode/src/session/prompt/anthropic.txt#L73)):

```text
- Use the TodoWrite tool to plan the task if required
```

And standing alone after the tool-use policy ([L96](https://github.com/sst/opencode/blob/v1.18.35/packages/opencode/src/session/prompt/anthropic.txt#L96)):

```text
IMPORTANT: Always use the TodoWrite tool to plan and track tasks throughout the conversation.
```

The tool is registered as `todowrite`, but the prompt calls it "TodoWrite".

### 2.3 `meta.txt` (Muse models), word for word

[`packages/opencode/src/session/prompt/meta.txt` L36-L40](https://github.com/sst/opencode/blob/v1.18.35/packages/opencode/src/session/prompt/meta.txt#L36-L40):

```text
# Tool Use – `TodoWrite` Tools
- You have access to the `TodoWrite` tools to help you manage and plan tasks. Use these tools VERY frequently to ensure that you are tracking your tasks and giving the user visibility into your progress.
- These tools are also EXTREMELY helpful for planning tasks and for breaking down larger complex tasks into smaller steps. If you do not use this tool when planning, you may forget to do important tasks – and that is unacceptable.
- It is critical that you mark todos as completed as soon as you are done with a task. Do not batch up multiple tasks before marking them as completed.
- Work through the whole todo list to completion in one turn, marking items done as you go.
```

### 2.4 `beast.txt` (gpt-4 / o1 / o3)

This prompt asks for a **markdown checklist in chat**, not the tool ([`beast.txt` L42](https://github.com/sst/opencode/blob/v1.18.35/packages/opencode/src/session/prompt/beast.txt#L42), [L76-L78](https://github.com/sst/opencode/blob/v1.18.35/packages/opencode/src/session/prompt/beast.txt#L76-L78), [L142](https://github.com/sst/opencode/blob/v1.18.35/packages/opencode/src/session/prompt/beast.txt#L142)):

```text
5. Develop a clear, step-by-step plan. Break down the fix into manageable, incremental steps. Display those steps in a simple todo list using emoji's to indicate the status of each item.
- Create a todo list in markdown format to track your progress.
- Each time you complete a step, check it off using `[x]` syntax.
- Each time you check off a step, display the updated todo list to the user.
Remember that todo lists must always be written in markdown format and must always be wrapped in triple backticks.
```

It also says "do not hand back control to the user until the entire todo list is complete" (L22, L28).

### 2.5 When

All of this is static text sent with every request: the base prompt goes in the system prompt, and the tool description goes in the tool list. No hook, reminder, or "your todo list is empty/stale" message is injected at runtime. A search of `packages/opencode/src/session/` for "todo" finds only `todo.ts` (storage) and the prompt files.

## 3. Tool shape

### 3.1 Schema

[`packages/schema/src/session-todo.ts`](https://github.com/sst/opencode/blob/v1.18.35/packages/schema/src/session-todo.ts):

```ts
export const Info = Schema.Struct({
  content: Schema.String.annotate({ description: "Brief description of the task" }),
  status: Schema.String.annotate({
    description: "Current status of the task: pending, in_progress, completed, cancelled",
  }),
  priority: Schema.String.annotate({
    description: "Priority level of the task: high, medium, low",
  }),
}).annotate({ identifier: "Todo" })
export interface Info extends Schema.Schema.Type<typeof Info> {}

```

The tool input is `{ todos: Todo[] }`, described as "The updated todo list" ([`packages/opencode/src/tool/todo.ts`](https://github.com/sst/opencode/blob/v1.18.35/packages/opencode/src/tool/todo.ts)). Notes:

- There is **no id field**. Items are identified only by their position in the array.
- `status` and `priority` are `Schema.String`. The allowed values appear only in descriptions and are not validated.
- **Full replace.** `Todo.update` deletes the session's rows and inserts the new array with `position` = index, all in one transaction. It then publishes the `todo.updated` event ([`packages/opencode/src/session/todo.ts`](https://github.com/sst/opencode/blob/v1.18.35/packages/opencode/src/session/todo.ts)). Reads return rows ordered by `position`.
- **Result:** title `${n} todos`, where n counts items whose status is not `completed` (cancelled ones count). The output is the list as pretty JSON, and the metadata is `{ todos }`.
- **Permission:** `todowrite` is an ordinary permission (`ctx.ask({ permission: "todowrite", patterns: ["*"] })`). The built-in `general` subagent sets `todowrite: "deny"` ([`agent/agent.ts`](https://github.com/sst/opencode/blob/v1.18.35/packages/opencode/src/agent/agent.ts#L182-L193)). Any subagent spawned through `task` gets a default deny unless its own ruleset mentions `todowrite` ([`agent/subagent-permissions.ts`](https://github.com/sst/opencode/blob/v1.18.35/packages/opencode/src/agent/subagent-permissions.ts)). So only the primary agent keeps the list.
- **Priority is never drawn.** It is stored but no TUI code reads it (§4).
- **`todoread` is gone.** It took no parameters and returned the stored list. Commit [`77fc88c`](https://github.com/sst/opencode/commit/77fc88c8a) "chore: remove dead code for todoread tool (#19128)", 2026-03-25, removed it with its `todoread.txt` description ("This tool should be used proactively and frequently..."). Today the model sees its own list only in its last `todowrite` call and result.
- A newer v2 core (`packages/core/src/tool/todowrite.ts`) registers the same tool with the same schema and a one-line description: "Create and maintain a structured task list for the current coding session. Use it to track progress during multi-step work and keep todo statuses current."

### 3.2 Tool description, word for word

[`packages/opencode/src/tool/todowrite.txt`](https://github.com/sst/opencode/blob/v1.18.35/packages/opencode/src/tool/todowrite.txt). This is the main nudge, and every model sees it:

```markdown
Create and maintain a structured task list for the current coding session. Tracks progress, organizes multi-step work, and surfaces status to the user.

## When to use
Use proactively when:
- The task requires 3+ distinct steps or actions (not just 3 tool calls for a single conceptual step)
- The work is non-trivial and benefits from planning
- The user provides multiple tasks (numbered or comma-separated) or explicitly asks for a todo list
- New instructions arrive - capture them as todos
- You start a task - mark it `in_progress` (only one at a time) before working
- You finish a task - mark it `completed` and add any follow-ups discovered during the work

## When NOT to use
Skip when:
- The work is a single, straightforward task (or <3 trivial steps)
- The request is purely informational or conversational
- Tracking adds no organizational value

## States
- `pending` - not started
- `in_progress` - actively working (exactly ONE at a time)
- `completed` - finished successfully
- `cancelled` - no longer needed

## Rules
- Update status in real time; don't batch completions
- Mark `completed` only after the required work is actually done, including any required verification. Never based on intent.
- Keep exactly one `in_progress` while work remains
- If blocked or partial, keep it `in_progress` and add a follow-up todo describing the blocker
- Preserve user-provided commands verbatim (flags, args, order)
- Items should be specific and actionable; break large work into smaller steps

## Examples

Use it:
- "Add a dark mode toggle and run the tests" -> multi-step feature + explicit verification
- "Rename getCwd -> getCurrentWorkingDirectory across the repo" -> grep reveals 15 occurrences in 8 files
- "Implement registration, catalog, cart, checkout" -> multiple complex features

Skip it:
- "How do I print Hello World in Python?" -> informational
- "Add a comment to calculateTotal" -> single edit
- "Run npm install and tell me what happened" -> one command

When in doubt, use it.
```

## 4. How the TUI draws it

### 4.1 Sidebar section

[`packages/tui/src/feature-plugins/sidebar/todo.tsx`](https://github.com/sst/opencode/blob/v1.18.35/packages/tui/src/feature-plugins/sidebar/todo.tsx) is a built-in TUI plugin (`internal:sidebar-todo`) in the `sidebar_content` slot at `order: 400`. The other sections are context and footer (100), MCP (200), LSP (300) and files (500), so Todo sits between LSP and Modified files.

```tsx
function View(props: { api: TuiPluginApi; session_id: string }) {
  const [open, setOpen] = createSignal(true)
  const theme = () => props.api.theme.current
  const list = createMemo(() => props.api.state.session.todo(props.session_id))
  const show = createMemo(() => list().length > 0 && list().some((item) => item.status !== "completed"))

  return (
    <Show when={show()}>
      <box>
        <box flexDirection="row" gap={1} onMouseDown={() => list().length > 2 && setOpen((x) => !x)}>
          <Show when={list().length > 2}>
            <text fg={theme().text}>{open() ? "▼" : "▶"}</text>
          </Show>
          <text fg={theme().text}>
            <b>Todo</b>
          </text>
        </box>
        <Show when={list().length <= 2 || open()}>
          <For each={list()}>{(item) => <TodoItem status={item.status} content={item.content} />}</For>
        </Show>
      </box>
    </Show>
  )
}
```

- **Visibility:** the section is shown only when the list is non-empty **and** some item is not `completed`. An empty list draws nothing, with no placeholder. When every item is `completed`, the whole section disappears. A list of only `completed` + `cancelled` items stays visible, because `cancelled` is not `completed`.
- **Title:** `Todo` in bold, theme `text`. **No count**, not even when collapsed. The MCP section shows `(N active, M errors)` when collapsed; Todo shows no summary.
- **Collapse:** with more than 2 items, the title row gets a `▼` (open) / `▶` (closed) prefix and toggles on mouse-down. It starts open (`createSignal(true)`) and the state is not persisted. With 2 or fewer items there is no toggle and the rows always show.
- **Rows:** every item, with no cap or "+N more". Order is the model's array order: no sorting, no grouping by status. The data comes from the sync store `todo[sessionID]`, which the `todo.updated` event replaces ([`context/sync.tsx` L265-L266](https://github.com/sst/opencode/blob/v1.18.35/packages/tui/src/context/sync.tsx#L265-L266)).
- **Container:** the sidebar box is 42 columns wide, padded 2 left and 2 right, on `backgroundPanel`, inside a scrollbox. It shows automatically when the terminal is wider than 120 columns and the session is not a subagent session ([`routes/session/sidebar.tsx`](https://github.com/sst/opencode/blob/v1.18.35/packages/tui/src/routes/session/sidebar.tsx), [`routes/session/index.tsx` L270-L278](https://github.com/sst/opencode/blob/v1.18.35/packages/tui/src/routes/session/index.tsx#L270-L278)).

### 4.2 Row

[`packages/tui/src/component/todo-item.tsx`](https://github.com/sst/opencode/blob/v1.18.35/packages/tui/src/component/todo-item.tsx), shared by the sidebar and the chat transcript:

```tsx
export function TodoItem(props: TodoItemProps) {
  const { theme } = useTheme()

  return (
    <box flexDirection="row" gap={0}>
      <text
        flexShrink={0}
        style={{
          fg: props.status === "in_progress" ? theme.warning : theme.textMuted,
        }}
      >
        [{props.status === "completed" ? "✓" : props.status === "in_progress" ? "•" : " "}]{" "}
      </text>
      <text
        flexGrow={1}
        wrapMode="word"
        style={{
          fg: props.status === "in_progress" ? theme.warning : theme.textMuted,
        }}
      >
        {props.content}
      </text>
    </box>
  )
```

| status | glyph | color (theme key; default `opencode` theme dark / light) |
|---|---|---|
| `in_progress` | `[•] ` | `warning`: `#f5a742` orange (`lightOrange` in light) |
| `completed` | `[✓] ` | `textMuted`: `#808080` |
| `pending` | `[ ] ` | `textMuted` |
| `cancelled` (or anything else) | `[ ] ` | `textMuted` |

- The glyph is a fixed-width, non-shrinking cell. Content wraps by word in the remaining width, so long items take several lines with a hanging indent.
- **No strikethrough, dim or italic** in the TUI. Completed and pending rows differ only by `✓` versus a space. Theme colors come from [`packages/tui/src/theme/assets/opencode.json`](https://github.com/sst/opencode/blob/v1.18.35/packages/tui/src/theme/assets/opencode.json).
- Priority is not shown.

### 4.3 In the transcript

Each `todowrite` call renders inline as a block titled `# Todos` with the same `TodoItem` rows. While the call is pending or has no metadata, it shows `⚙ Updating todos…` ([`routes/session/index.tsx` L2519-L2537](https://github.com/sst/opencode/blob/v1.18.35/packages/tui/src/routes/session/index.tsx#L2519-L2537)). So the user also sees a snapshot of the list after every update, in the chat.

### 4.4 Contrast: desktop/web app dock (not the TUI)

The GUI app draws the list differently, in [`packages/app/src/pages/session/composer/session-todo-dock.tsx`](https://github.com/sst/opencode/blob/v1.18.35/packages/app/src/pages/session/composer/session-todo-dock.tsx). It is a collapsible dock above the composer with a count, "{{done}} of {{total}} todos completed" (`session.todo.progress` in `packages/app/src/i18n/en.ts`). Collapsed, it previews the current item: the in-progress one, else the first pending, else the last completed. A pulsing dot marks the in-progress item, rows have checkboxes, and **completed and cancelled items get a strikethrough** (`TextStrikethrough`, active for `completed || cancelled`). So OpenCode's count and strikethrough exist only in the GUI, not in its terminal sidebar.

## 5. Takeaways for ctui 0.5

- OpenCode's "nudge" is mostly the tool description plus a short system-prompt section, with no runtime reminders. A ctui nudge that injects text (for example a SessionStart/system-reminder hook) would be stronger than what OpenCode does.
- The TUI look is spare: bold `Todo`, `[✓]/[•]/[ ]` rows, one accent color for the active item, everything else muted, the whole list in model order, and the section hidden when empty or all done.
- Cancelled items are indistinguishable from pending ones in the TUI. That is a gap to avoid copying; the GUI's strikethrough covers it.
