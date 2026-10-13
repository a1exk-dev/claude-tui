# Live checks build spec

This spec covers the build slice of the map [Map: live checks into the test kit](https://github.com/a1exk-dev/claude-tui/issues/266): the TypeScript pty harness and the operator-run `live-checks` skill, the named check ids that replace the `L<n>` line numbers, `docs/testing/live-checks.md` cut down to the operator page, the five reachable test gaps, and the `ctui/evals/` task-list nudge suite. It targets Claude Code 2.1.292.

The map and its nine closed tickets hold the decisions, and this spec does not re-argue them. Each slice names the tickets it executes and the `MEMORY.md` entries it applies. This spec adds the build order, the file layout, the check-id table, the test plan and the wording each of the six file edits lands. If this spec and a closed ticket disagree, stop and ask the human.

**Running the build is not the map's work.** Each slice below is a ticket; the map closes when they are written.

## Rules for every slice

- While the `release/0.5.0` pull request ([#223](https://github.com/a1exk-dev/claude-tui/pull/223)) is open, every slice is one `bugfix/<name>` cut from `release/0.5.0` with its pull request into `release/0.5.0`, which merges back into `develop` (AGENTS.md). `scripts/cost-fixture.ts`, its `check.ts` wiring and the current text of `docs/testing/live-checks.md` live there and not on `develop`.
- A slice is done when `node scripts/check.ts` exits 0, the slice's tests below exist and pass in `claude plugin test ctui`, and its pull request is merged.
- The pull request template's `## Reports` block answers **N/A** on these pull requests: the two operator reports ride on whichever pull request a human merges ([#272](https://github.com/a1exk-dev/claude-tui/issues/272)), which is 0.5.0's into `main`, not a slice's into the release.
- Every converted row asserts a **measured value, never a shape**, and a row reading "after the reload" converts to its after-state with the transition dropped ([#271](https://github.com/a1exk-dev/claude-tui/issues/271)).
- A timing claim becomes a check only where ctui's own work could move the number. An interval ctui requests is asserted as the requested value (`ms: 100`, the 1 s tick, `SCAN_MS = 60_000`), never as frames or milliseconds on a screen ([#273](https://github.com/a1exk-dev/claude-tui/issues/273)).
- **No Python ships in this repo** (`MEMORY.md`). The harness is a port, not a copy; the eval fixture is `calc.ts`.
- No slice runs the old 133-row sweep of `docs/testing/live-checks.md`: it cost over 15% of a 5 h usage window on 2026-10-12.

## What the build starts from

| Input | Where |
|---|---|
| The Python harness the port rewrites (`pty_serve.py`, `pty_once.py`, `colors.py`, `glass.py`, `newcfg.sh`, eight shell helpers, `HARNESS.md`, `results.md`, the MCP stub) | `.scratch/live-checks-harness-python/`, gitignored, 120 KB |
| The 2026-10-12 PASS evidence the 19 rows rest on | `results.md` in that folder |
| The row text and the `L<n>` numbering every ticket cites | `docs/testing/live-checks.md` on `release/0.5.0`, 185 lines |
| Scenario 7's fixture generator (800 transcripts, 381 MiB, prints the expected month total) | `scripts/cost-fixture.ts` on `release/0.5.0` |
| The eval suite's three jobs | `prototypes/todo-nudge/run.sh` on `prototype/todo-nudge` |

## The file layout

```
.claude/skills/live-checks/
  SKILL.md                      the operator-run skill: scenarios, checks, report
  HARNESS.md                    step vocabulary, geometry, theme facts
  harness/harness.ts            serve (fifo, interactive) and once (one-shot)
  harness/screen.ts             dump, dumpbg, cells, runs
  harness/steps.ts              type, enter, key, click, move, wheel, resize, setopt, setting, sh, watch, anim, grep
  harness/config.ts             seeds a signed-in CLAUDE_CONFIG_DIR
  harness/fixtures/             the MCP stub
ctui/evals/                     the task-list nudge suite and its calc.ts fixture
docs/testing/live-checks.md     the operator page, emptied of rows
```

`.claude/skills/live-checks` is the first **repo-own** skill in a directory that until now held only pinned upstream copies: no `skills-lock.json` entry, and `npx skills update` must leave it alone. `claude plugin validate .` never reads it — the repo root holds a marketplace manifest, not a plugin.

## Slices

### 1. Port the harness to TypeScript

Executes [#274](https://github.com/a1exk-dev/claude-tui/issues/274). Applies "No Python ships in this repo" and "One pinned Claude Code version".

- Add `node-pty@1.1.0` and `@xterm/headless@6.0.0` to the **root** `devDependencies` only, never to `ctui/package.json`. npm gates `node-pty`'s build script, so `CONTRIBUTING.md` gains the one-time `npm install-scripts approve node-pty`. CI never builds the binding: `check.ts` never starts the harness.
- Write the four modules above, replacing both Python drivers, `colors.py`, `glass.py` and all eight shell helpers. The capabilities the paint rows need are verified on the pin: per-cell `fg`/`bg` truecolor, `b` (bold), `u` (SGR underline), and `p.resize(cols, rows)` reaching the child.
- `config.ts` seeds a scenario's `CLAUDE_CONFIG_DIR` under `$TMPDIR` at run time, as `newcfg.sh` does: copy `~/.claude/.credentials.json` at mode 0600, synthesize `.claude.json` (onboarding complete, this repo trusted) from the operator's own, write the scenario's `settings.json`. **Nothing signed-in is ever written into the repo.** A dir grows to ~24 MB (15 MB `plugins/`, 4.4 MB `skills/`); it is deleted on pass and kept on failure.
- Write `HARNESS.md` with the step vocabulary, the geometry (body columns at each dock width) and the theme facts the checks read.
- Add `.claude/skills/live-checks/harness` to the root `tsconfig.json` `include`. (`scripts/*.ts` is not type-checked today; the port must not inherit that gap.)
- `MEMORY.md`: a rule that `live-checks` is repo-own, has no `skills-lock.json` entry, and `npx skills update` must not touch it.
- Tests: none. The harness is skill-only tooling that boots a real engine; `check.ts` never runs it.

### 2. Write `SKILL.md` and the named check ids

Executes [#274](https://github.com/a1exk-dev/claude-tui/issues/274) and [#273](https://github.com/a1exk-dev/claude-tui/issues/273). Blocked by slice 1. Write it with the `writing-for-agents` skill.

- 7 scenarios, 30 checks, one subagent per scenario. The scenario is the unit that costs — one seeded config dir, one engine boot — and resizes, `/theme`, `setopt` and folds all happen inside a session.
- Each subagent seeds its own dir, drives its checks through one session, and returns **only finished table rows**, each carrying its section prefix. The session is a fifo one, except scenario 7's: its arrival check is timed from the session's own start, where a first `send` would add its own latency, so it drives the harness's `once` over a steps file. Its screen dumps die with it (60–120 KB per scenario in the 2026-10-12 run); the lead never sees one.
- The lead runs `node scripts/check.ts` first, spawns the seven, merges rows into report sections and writes the version block.
- **Scenario 6's two model turns are asked explicitly** ("plan three steps with your task tools") and always run: no skip flag, so every report is the same shape and complete. Three other scenarios spend one turn each — the rule-gutter and ctrl+o checks need a reply and a `$ Bash` row on screen, the fresh-110 docking check needs a submitted prompt, and the main-screen toast check needs a background agent to announce — so a run spends about five turns across scenarios 1, 2, 5 and 6. The count is a field in the report's version block, not a number this spec fixes.
- Peak temp churn is ~550 MB per run (seven dirs plus scenario 7's 381 MiB fixture), against the ~600 MB the old 25-dir sweep produced.
- The report is one Markdown file written to the run dir with its path printed, pasted into the pull request. It carries a `measured` column so a PASS states its evidence, stable named check ids, and one version block naming the plugin version and commit, the engine pin, the `check.ts` result, and the model and effort the run used. A failed scenario's config dir path is in the report.
- Tests: none.

#### The scenarios

| # | Scenario | Seed | Checks |
|---|---|---|---|
| 1 | `default-150` | Fullscreen 150 cols, default settings, a scratch repo with an upstream, one staged, one modified and one untracked file and one stash | 8 |
| 2 | `fresh-110` | A fresh config at 110–143 cols, two launches | 2 |
| 3 | `dock-columns` | `dockColumns` set in `.claude.json` | 1 |
| 4 | `themes` | Everforest → Catppuccin Latte → `inherit` on built-in `dark` → `inherit` on `custom:omarchy` | 11 |
| 5 | `main-screen` | `--settings '{"tui":"default"}'` at 200 then 120 cols | 2 |
| 6 | `todo` | Task tools on, the default model — **the two explicit model turns** | 4 |
| 7 | `cost-cold-cache` | `limits_cost: "on"`, `scripts/cost-fixture.ts` into `$CLAUDE_CONFIG_DIR/projects/fixture`, each file's page cache dropped with `dd if=<f> iflag=nocache count=0` (**no root**), boot with no prompt sent | 2 |

#### The check ids

Ids replace the old document's line numbers, which stop meaning anything once its rows are deleted. The prefix is the report section; `hover-underline` and `clear-swaps-id-and-cost` are fixed by [#275](https://github.com/a1exk-dev/claude-tui/issues/275) (the second is a `MEMORY.md` entry, not a check).

| Scenario | Check id | Expected, and what `measured` carries |
|---|---|---|
| 1 | `docking/width-42-at-150` | The engine grants a 42-column body at 150 cols — the body's column range off the cell grid, not ctui's request |
| 1 | `docking/width-53-at-170` | Resized to 170 inside the session, the body is 53 columns |
| 1 | `docking/close-attempts-ignored` | The Sidebar stays open through an SGR click on `✕`, ctrl+x x and Esc while focused (**ctrl+x x needs the bare pty**: tmux does not deliver it) |
| 1 | `layout/git-glyph-columns` | `U+E725`, `U+E702`, `U+E728` at body column 0 with text at column 2, in their theme roles |
| 1 | `layout/frame-and-footer` | Claude Code's `│`, `✕` and the row below; the footer one row at 53 and two at 42; the `│` in `subtle`; no update icon |
| 1 | `layout/no-child-processes` | Over 10 s of `pstree -a <pid>`, only MCP servers and short `git` runs: no `claude -p`, no `claude mcp list` |
| 1 | `rewrites/rule-gutter` | The prompt panel, the reply and the `$ Bash` row end 2 columns before the rule; rows Claude Code draws alone still reach it |
| 1 | `rewrites/ctrl-o-transcript` | ctrl+o, then ctrl+o again: the same rows, each call with its full result under it |
| 2 | `docking/fresh-110-prompt-docks` | Nothing docks at start; the prompt docks the Sidebar |
| 2 | `docking/fresh-110-next-session-docks` | `pluginPanes.asked` persisted, so the second launch docks at start |
| 3 | `docking/dock-columns-override` | A dragged or keyed `dockColumns` overrides the 42/53 the Sidebar asks for |
| 4 | `themes/glass-flat` | One flat `#363d41` on every body cell, padding included, through scroll, fold, a resize past 160 and back, and a `/theme` file rewrite — with no stripes |
| 4 | `themes/glass-frame` | On built-in `dark` the rule column, the `✕` row and the row below keep the dock color so a frame shows; with Everforest picked in `/theme` too, the frame turns `#363d41` and goes away |
| 4 | `themes/latte-body` | The body is `#e5e7ed` on `dark` and on `Catppuccin Latte`; the frame shows on the first and vanishes on the second |
| 4 | `themes/inherit-no-paint` | Under `inherit`, the body shows the `/theme`'s dock color, the same as the frame |
| 4 | `themes/omarchy-mix` | The Omarchy theme's background mixed 6% toward its foreground (`#373e42` for Everforest), one flat color, under `custom:omarchy`. The operator's own `~/.claude/themes/omarchy.json` is copied into the scenario's config dir and the expected mix computed from it: the harness reads the operator's home and never runs `omarchy theme set` (HARNESS.md) |
| 4 | `themes/hover-colors` | Anywhere on a title row, the arrow and the title with its `:` draw in `suggestion`; off the row, `inactive` and bold `text` |
| 4 | `themes/hover-underline` | **Engine-pinned**: Claude Code adds SGR underline to every hovered cell, which ctui neither asks for nor can suppress (`u=1`). Not a ctui defect; see the `MEMORY.md` entry |
| 4 | `themes/focus-arrows` | ctrl+x tab turns the arrows the `/theme`'s grey; Tab inverts the first, Enter folds its section, Esc returns them to `#706e69` |
| 4 | `themes/theme-list-from-ctui` | `/theme` lists the 22 ctui Themes A–Z, `Catppuccin` to `White`, each tagged `from ctui` |
| 4 | `themes/dock-tint` | Each pick recolors all of Claude Code at once; the dock is a flat tint (`#363d41`, `#e5e7ed`) |
| 4 | `menu/dock-pane-colors` | In the dock at 42 and 53, ctui's own text is in the Sidebar's colors; the engine's `›`, placeholders, typed text and `⏎ submit` keep the `/theme`'s |
| 5 | `toasts/main-screen-prefix` | On the main screen the toast reads `ctui: <text>` at the right of the line under the prompt |
| 5 | `menu/frame-fits-content` | At 120 cols the body spans the frame and each screen's `─` and footer sit right under its rows |
| 6 | `todo/own-list-hidden` | While Claude works the spinner has no list under it and the footer reads `ctrl+t to show tasks`; ctrl+t opens Claude Code's own list |
| 6 | `todo/no-dock-100-cols` | At 100 cols, where the Sidebar cannot dock, Claude Code's list draws under the spinner and the footer reads `ctrl+t to hide tasks` |
| 6 | `todo/spinner-animates` | The in-progress cell's glyph differs between two dumps ~300 ms apart — that the animation reaches the screen, not its frame rate |
| 6 | `todo/spinner-focused` | After ctrl+x tab, the spinner keeps turning under engine-granted focus |
| 7 | `cost/cold-cache-total` | The `cost` row's total is the generator's printed total exactly (no prompt sent, so the live session adds 0) |
| 7 | `cost/cold-cache-arrival` | The row arrives inside **3 s** of the session start; the measured ms is in the report whether it passes or fails. The 2026-10-12 baseline was 1.5 s, of which the grep was 0.4 s and the store writes the rest |

30 checks over 7 boots, refining #274's ~22 and #273's ~24: naming the ids split some rows (the dock widths, the fresh-110 pair, the cold-cache `cost` row) and merged others (the three close attempts, the glass body and its frame).

### 3. The operator page and the five knowledge edits

Executes [#269](https://github.com/a1exk-dev/claude-tui/issues/269), [#272](https://github.com/a1exk-dev/claude-tui/issues/272) and [#273](https://github.com/a1exk-dev/claude-tui/issues/273). Blocked by slice 2: these files point at the skill's name and ids. Apply `domain-modeling` and `docs/agents/domain.md`.

- **`docs/testing/live-checks.md`** keeps its intro and loses all 133 rows: how to run the skill, how to read the report, and ctui's promise that the cold-cache `cost` row arrives **within 2 s** (scenario 7's gate is 3 s; the promise is the operator's number).
- **`MEMORY.md`**, entry "Tests cover real usage": the third leg is rewritten from "live checks for the rest" to the **three mechanisms** — (1) tests under `node scripts/check.ts`, (2) the operator-run agent skill, (3) manual, with no members today — the placement rule (*automate a check unless no test and no agent can reach it, or an agent would cost too much*), its three parts (measured-not-shape, after-state, and the timing rule), and the **2-minute ceiling** on `node scripts/check.ts`, stated and never asserted. It points at `CONTRIBUTING.md` for the procedure instead of restating it.
- **`CONTEXT.md`** gains **live check**: a check an **agent** drives against a real engine through the pty harness — not a check a human runs by hand.
- **`CONTRIBUTING.md`**: `Checks` points at the ceiling rather than naming a second figure; `Live checks` becomes "switch to an inexpensive model (Sonnet, medium effort), run the live-check skill, read the report"; a new `Evals` paragraph names the suite and its 18 sessions; one paragraph says which pull request attaches which report.
- **`.github/pull_request_template.md`**: the 7 section checkboxes go — the report is atomic and complete, so there is no partial run left to tick — replaced by one `## Reports` block with two whole-report-or-N/A fields.

| pull request | merged by | required check | reports |
|---|---|---|---|
| `release/<semver>` → `main` | human | `check.ts` | both, attached |
| external contributor → `develop` | human (auto-merge not armed) | `check.ts` | both, attached; the contributor attaches, the maintainer re-runs on doubt |
| owner's own → `develop` | auto-merge | `check.ts` | none asked |

- Tests: `scripts/check.ts`'s existing consistency checks must still pass; no new test. The ceiling is never asserted — a wall-clock assert on a shared runner is flaky by construction.

### 4. The engine-pinned expectation and the third pin tie

Executes [#275](https://github.com/a1exk-dev/claude-tui/issues/275). Independent of slices 1–3. Applies "One pinned Claude Code version".

- **`MEMORY.md`** gains one entry owning the class: the expectation, the pin it was measured on, and the fact that ctui neither asks for the behaviour nor can suppress it. Two members, named for an operator rather than by line number:
  - `hover-underline` — the engine underlines whatever row the mouse is over. **Not reported upstream**: engine chrome that reads as an intentional hover affordance, with nothing broken on ctui's side.
  - `clear-swaps-id-and-cost` — clearing swaps the session id and the cost total in one step (measured in #153).
  The tmux 256-colour fact stays in its own entry, cross-referenced, because its job is user setup. `tmux capture-pane` under-reporting blank cells is dropped: a fact about a tool the TypeScript harness no longer uses.
- **`CONTEXT.md`** gains **Engine-pinned expectation**, beside "live check".
- **`scripts/check.ts`** gains the **third pin tie** (~6 lines), beside the README "Tested with" line and the `COMPATIBILITY.md` top row: the new `MEMORY.md` entry must name `package.json`'s pin, so a bump **fails the gate** until the entry is edited into the bump pull request's diff. `check.ts` can only tie a string — it never starts an engine.
- **`MEMORY.md`**, the pin entry's bump procedure: one line that a bump re-runs the engine-pinned expectations and edits that entry.
- Tests: none beyond `node scripts/check.ts` exiting 0. Verify the tie by hand on a scratch edit of the pin, then revert it.

### 5. The five reachable test gaps

Executes [#268](https://github.com/a1exk-dev/claude-tui/issues/268), [#271](https://github.com/a1exk-dev/claude-tui/issues/271) and [#273](https://github.com/a1exk-dev/claude-tui/issues/273). Independent of slices 1–4. Applies "Tests cover real usage".

Six rows, every one asserting a **measured value**: ~20 lines of assertions each where the host already exists, ~0.3 s each against a 324-test suite that runs in 5.6 s. What shipped: 337 tests in 6.43 s, up from 332 in 6.44 s.

| Row | Test file | What to assert |
|---|---|---|
| The dock at 53, then 42 again | `sidebar-dock.test.tsx` | The dock asks 53 on widening past 160 and 42 again on narrowing back. The two width tests already there each assert one width from a fresh session; nothing walks the transition |
| Re-docking after a narrow below 110 | `sidebar-dock.test.tsx` | Re-docking after a narrow below 110 and a widen back. The test there asserts that nothing opens; nothing asserts the re-open |
| The month total across `/clear` (half) | `usage.test.tsx` | After `/clear`, switching `session.id()` and `usage().cost` together, the total reads as before — never counted twice. The measured total before and after, not a shape. The "about a second" is the rescan's schedule and drops |
| Skills rows across `/compact` | `skills-sidebar.test.tsx` | Skills rows surviving `/compact`. A reload and `/clear` are covered; `/compact` is not driven |
| The spinner after a `/theme` switch (half) | `todo-sidebar.test.tsx` | After a `/theme` switch the spinner turns in the new theme's `warning` — the after-state, with the transition and the "within 0.5 s" dropped |
| `/ctui` while a reply streams | `menu.test.tsx` | `/ctui` opening while a reply streams. The test there opens it at rest |

Rows this slice does **not** convert, with their reason on the record: the `CLAUDE_CODE_ENABLE_TODO_TOOLS` question pair and the `/ctui` refusal under `claude -p` are deleted, already asserted better than the live check asks ([#268](https://github.com/a1exk-dev/claude-tui/issues/268)); the `resets in` countdown is asserted in full in `ctui/tests/usage.test.tsx`, which advances `mock.clock` 30 s and then 60 s and reads `resets in 2h 17m`, `2h 16m` and `2h 15m` off each redraw, so the clock advancing the text was covered before this spec was written; the git glyphs' "full size in the Nerd Font" and the frame row's one-cell `▶` in Alacritty and Ghostty are deleted as facts about a font and two terminals ([#269](https://github.com/a1exk-dev/claude-tui/issues/269)); the Todo spinner's "about ten frames a second" **is** `ms: 100` and is already asserted (`spinner.test.tsx`, `todo-sidebar.test.tsx`); the git counts after an Edit, a rewritten `/theme` file, an Omarchy theme switch and the three `/mcp` state changes are the 1 s tick, its 5th beat, `SCAN_MS = 60_000` and `ms: 100`, where asserting the requested value *is* the assertion ([#273](https://github.com/a1exk-dev/claude-tui/issues/273)).

### 6. `ctui/evals/`: the task-list nudge suite

Executes [#270](https://github.com/a1exk-dev/claude-tui/issues/270). Independent of slices 1–5. Applies "The `todo` Sidebar plugin turns the task tools on by default" and "No Python ships in this repo".

The nudge's mechanism is already asserted (`register.tsx:871`, `todo-sidebar.test.tsx:491-509`). What no test can reach is whether the text *works* — and `todo_tools` is on by default at ~1.2k cached tokens per request for every user, so it is a question about ctui's value.

- Three cases, all three of the spike's jobs:

  | Case | The job | Grader |
  |---|---|---|
  | medium (`j208`) | A subagent reads the file and reports its bugs in one line; then fix both bugs and add a `sub` function. **"Be brief."** | `tool_order`: `TaskCreate` before the first `Edit`/`Write` |
  | big (`j6`) | Fix both bugs, add two functions, a docstring each, write tests, run them, fix failures | `tool_order`: the same |
  | one-line (`j1`) | Fix the one bug in `add` | `tool_used`, expecting **absence**: no `TaskCreate` at all |

  The medium job hides its steps and asks for brevity, so a list there is ctui's doing. The big job's delta is near zero and it is kept as the floor. The one-line job is the over-trigger guard, and its ablation delta must stay zero.
- **`claude-haiku-5-5`**, a correctness choice: measured on the pin, the cheapest model's tool list holds `TaskCreate`, `TaskList` and `TaskUpdate` with or without `CLAUDE_CODE_ENABLE_TODO_TOOLS`, so the plugin-off arm still *can* make a list and declines to. With ctui off on Opus 5.x there are no Task tools and "no list" is forced, which makes the delta a tautology about an environment variable.
- `--runs` at its default of **3** (the spike's three sessions per job), `--ablation with-without`: **18 cheap sessions per run**. Only the `llm` and `baseline` graders spend a judge turn, so this suite scores **free**. No `--threshold` gate: the report is read, not enforced.
- The fixture is **`calc.ts`**, committed with the same two bugs and shape as the spike's `calc.py`. The big job's "write tests and run them" step then has `node --test` to hand. The run's numbers are not comparable row-for-row with the 2026-10-12 measurement, which the model change had already broken.
- Read `claude plugin eval --help` against the pin for the suite file's format before writing it; this spec fixes the cases, graders, model, fixture and flags, not the schema.
- Tests: none. The suite spends model turns, so `check.ts` never runs it; `claude plugin validate ctui --strict` must still pass with `evals/` present, and npm's `files` whitelist must leave it out of the published package.

## Out of scope for this slice

Carried from the map, so no build ticket picks one up:

- A CI job that drives a signed-in Claude Code session, and any pty or terminal runner inside the release gate. `node scripts/check.ts` never starts a real engine.
- A per-release human smoke list. The manual mechanism stays in the rule with no members today.
- Measuring a clock that is not ctui's: the spinner's on-screen frame rate, the "`✕` and `down` about 10 s after the kill" of a killed MCP server (`MCP_TIMEOUT` and the engine's client), and every other real-time "within a second" clause.
- An `engine: 2.1.292` field per check (the skill runs against one pin and the version block names it once) and a `COMPATIBILITY.md` entry for an engine-pinned expectation (it ships to users).
