# Does the Todo section show Claude's tasks live? (Claude Code 2.1.292)

Ticket: #206, part of map #205. Question: does the `todo` Sidebar plugin show Claude's task list on the pinned Claude Code, and if it stays empty, why?

Runs: 2026-10-09, `node_modules/.bin/claude --plugin-dir ./ctui` (2.1.292, ctui 0.4.0 from `develop`), fullscreen, in tmux at 150×45. The config was a scratch `CLAUDE_CONFIG_DIR` with a copy of the credentials, and the working folder was a small Python repo outside this one. The harness and raw captures are in `prototypes/research-206/` (local only).

## 1. Answer

The section works. The empty Todo comes from Claude, not from ctui: Opus 5.5 doesn't start a task list unless someone asks it to.

- **Unprompted, Opus 5.5 made no list in 3 out of 3 runs.** Each run was a fresh session with a 5- to 7-step job: functions with tests, CLI and README; a package refactor with pyproject; a history feature. None of them made a TaskCreate call. ctui had the tools on (`CLAUDE_CODE_ENABLE_TODO_TOOLS=1`, header `0/0`), and Todo stayed `0/0` with no rows. This matches the baseline in #208.
- **Asked to use its task tools, Claude made a list every time**, and the Sidebar followed it live. Each TaskCreate and TaskUpdate showed up in Todo within a moment. The count went `0/3` → `0/4` → `2/4` → `3/4` → `4/4`, the in-progress row showed its spinner text, and finished rows turned `✓`.
- **I found no bug in how ctui reads the list.** Every case below drew the list Claude Code holds.

## 2. Runs

| Case | Claude made a list | Claude Code's own list (above the prompt) | Sidebar Todo |
|---|---|---|---|
| Opus 5.5, multi-step job, no mention of tasks (3 sessions) | No (0 task calls) | None | `0/0`, no rows |
| Opus 5.5, "use your task tools to plan and track this" | Yes, 4 tasks | Shown while working, with `ctrl+t to hide tasks`; hidden once all are done | Live, matched it at every step; stays `4/4` with all `✓` after Claude Code hides its own |
| A TaskCreate after every task is done | Yes | Fresh list | Fresh list: the 4 finished rows drop, the new 3 show (`0/3`) |
| `/reload-plugins` | n/a | Unchanged | Same rows; the in-progress row keeps its spinner text (`Adding sqrt`) |
| `/clear` | n/a | Gone | `0/0`, no rows, within a second |
| `/resume <id>` inside the running process | n/a | **Not drawn** until the next task change | Same rows; the in-progress row shows its subject (`Add sqrt function`), as `MEMORY.md` says for `TaskList` |
| Exit, then `claude --resume <id>` | n/a | Hidden, footer reads `ctrl+t to show tasks` | Same rows, subject on the in-progress row |
| General-purpose subagent told to use its own task tools | **No: the subagent has no task tools** (its ToolSearch for TaskCreate/TaskUpdate found nothing) | Unchanged | Unchanged (the main list) |
| Haiku 4.5, ctui default | Yes, when asked | Shown | Live |
| Haiku 4.5, `CLAUDE_CODE_ENABLE_TODO_TOOLS=0` in the shell | Yes, when asked: it still has TaskCreate/TaskList | Shown | Live |

The variable: under ctui's default a Bash `echo` printed `ENV=1`. `$.state`'s `todo` was read through the render, which reads only `$.state`, not inspected directly. In every row it held `tools: 'task'` (a count shows, with no hint), with items matching Claude Code's list.

## 3. Facts later tickets depend on

- **TodoWrite is out of reach in an interactive 2.1.292 session.** Opus 5.5 and Haiku 4.5 both get the Task tools (TaskCreate, TaskList, TaskGet, TaskUpdate, TaskStop), and Haiku gets them even with the variable at `0`. The `todowrite` path in `loadTodo` couldn't be tried live.
- **Subagents get no task tools**, so only the main session's list exists, and there are no subagent tasks for the Sidebar to show. #208 said the `isDeferred: false` fallback "reaches subagents too". That only matters for an agent type that has the tools; the general-purpose agent doesn't.
- **Claude Code's own list and the Sidebar overlap only while Claude works.** Claude Code hides its list once every task is done, after `--resume`, and after `/resume` until the next task change. The Sidebar keeps the list in all three cases.
- Unrelated to Todo: on `claude --resume` of a session with file changes, Claude Code opened a `Diff` tab in the dock next to `Sidebar` and selected it. After ctrl+x tab and a trip in and out of the agents view, the Sidebar showed again. I didn't pin down which step brought it back. This is worth a check in the Sidebar docking live checks.

## 4. Screenshots

Renders of `tmux capture-pane -e` output in JetBrainsMono Nerd Font. Cell spacing and the dock background are approximate, not a real terminal grab.

- [In progress, whole screen](todo-live/in-progress-full.png): the Sidebar's `0/4` beside Claude Code's own list above the prompt.
- [Half done](todo-live/half-done.png): `2/4`, two `✓`, one `◐` with spinner text, one `○`.
- [All done](todo-live/all-done.png): `4/4`, after Claude Code has hidden its own list.
- [After `/resume`](todo-live/after-resume.png): `0/3`, the in-progress row showing its subject.

There's no capture of a folded Todo header, because tmux can't click the fold arrow. The scenario tests cover the folded summary.
