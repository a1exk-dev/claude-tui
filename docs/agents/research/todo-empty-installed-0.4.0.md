# What installed ctui 0.4.0 gives Sonnet 5.5 on pin 2.1.300 (#355)

Scope: question of #355, child of map #354. Every claim cites a file in the installed plugin or a git object in this repo. **Not run** marks what no source settles.

**Source keys**

- **INST**: `~/.claude/plugins/cache/claude-tui/ctui/0.4.0/`, the installed copy (`.claude-plugin/plugin.json` says `version 0.4.0`).
- **TAG**: `git show v0.4.0:<path>` and `git show v0.5.0:<path>` in this repo.
- **740f6c7**, **db4db87**: the commits named below.

## 1. Result

The premise of #355 is half wrong. Installed 0.4.0 does **not** pin the Task tools and does not add a `ctui:todo` section. It only sets `CLAUDE_CODE_ENABLE_TODO_TOOLS=1`.

| Question | 0.4.0 | 0.5.0 | Source |
|---|---|---|---|
| Sets `CLAUDE_CODE_ENABLE_TODO_TOOLS=1` when unset | yes | yes | INST `hooks/register.tsx` `setTodoEnv` (L402-409) |
| `tool.describe` returns `isDeferred: false` for TaskCreate, TaskUpdate, TodoWrite | **no** | yes | INST has no `isDeferred` anywhere (`grep -rn "isDeferred\|deferred" .` is empty); its `tool.describe` hook only records MCP names (L820-824); TAG `v0.4.0:ctui/hooks/register.tsx` has 0 matches; 740f6c7 adds the pin and is an ancestor of `v0.5.0`, not of `v0.4.0` |
| `prompt.compose` hook adding the `ctui:todo` section | **no** | yes | INST has no `prompt.compose` or `ctui:todo`; db4db87 adds both and is in 0.5.0 |

So on 2.1.300 with 0.4.0 the task tools are turned on by the variable, but the engine decides whether they are deferred behind ToolSearch, and nothing tells Sonnet 5.5 to keep a list. That is a plausible cause of an empty Todo section, but this note does not show it (section 2).

## 2. Not confirmed: Sonnet 5.5's behaviour

No live run was made. The throwaway config dir `CLAUDE_CONFIG_DIR=<scratchpad>/cfg` reports `loggedIn: false` (`claude auth status`, 2.1.300), and no `ANTHROPIC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN` is set. Signing in would mean copying the user's real `~/.claude/.credentials.json` into it, which the task rules out. Not confirmed:

- Whether TaskCreate is listed or deferred in a 0.4.0 session on Sonnet 5.5.
- Whether Sonnet 5.5 calls TaskCreate for a multi-step prompt without the section.
- The same under 0.5.0 (`--plugin-dir ctui`).

Runs used: 0. Turns and tokens spent: 0 (only `claude auth status`, which makes no model call).

To finish it, the person signs in once in a throwaway dir (`CLAUDE_CONFIG_DIR=<dir> claude auth login`), then at most 6 `claude -p --model sonnet` runs: 3 with 0.4.0 installed there, 3 with `--plugin-dir ctui`, one multi-step prompt, comparing the tool list and whether TaskCreate appears in the transcript.
