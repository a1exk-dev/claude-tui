# Live checks build spec

Two maps have specced this page, each against its own pinned Claude Code, and each part below is that map's whole build. **Part 1** is the shipped 0.5.0 record: the harness, the skill, the converted tests and the eval suite, measured on 2.1.292. **Part 2** is 0.6.0's work: driving a whole pass from a `claude -p` subshell and attaching its report to the release pull request, measured on 2.1.300.

A part's rules govern that part's slices and no others. Part 1's branching rule names a release pull request that merged long ago and its reports rule names 0.5.0's, and neither stretches to Part 2. Where the two parts disagree about the engine, the later pin wins and Part 2 says where. A Part 2 slice never edits a Part 1 slice: Part 1 stands as the record of what shipped, and its slice numbers keep running into Part 2 so that "slice 8" names one thing on this page.

## Part 1 — the test kit (map [#266](https://github.com/a1exk-dev/claude-tui/issues/266), Claude Code 2.1.292)

This spec covers the build slice of the map [Map: live checks into the test kit](https://github.com/a1exk-dev/claude-tui/issues/266): the TypeScript pty harness and the operator-run `live-checks` skill, the named check ids that replace the `L<n>` line numbers, `docs/testing/live-checks.md` cut down to the operator page, the five reachable test gaps, and the `ctui/evals/` task-list nudge suite. It targets Claude Code 2.1.292.

The map and its nine closed tickets hold the decisions, and this spec does not re-argue them. Each slice names the tickets it executes and the `MEMORY.md` entries it applies. This spec adds the build order, the file layout, the check-id table, the test plan and the wording each of the six file edits lands. If this spec and a closed ticket disagree, stop and ask the human.

**Running the build is not the map's work.** Each slice below is a ticket; the map closes when they are written.

### Rules for every slice

- While the `release/0.5.0` pull request ([#223](https://github.com/a1exk-dev/claude-tui/pull/223)) is open, every slice is one `bugfix/<name>` cut from `release/0.5.0` with its pull request into `release/0.5.0`, which merges back into `develop` (AGENTS.md). `scripts/cost-fixture.ts`, its `check.ts` wiring and the current text of `docs/testing/live-checks.md` live there and not on `develop`.
- A slice is done when `node scripts/check.ts` exits 0, the slice's tests below exist and pass in `claude plugin test ctui`, and its pull request is merged.
- The pull request template's `## Reports` block answers **N/A** on these pull requests: the two operator reports ride on whichever pull request a human merges ([#272](https://github.com/a1exk-dev/claude-tui/issues/272)), which is 0.5.0's into `main`, not a slice's into the release.
- Every converted row asserts a **measured value, never a shape**, and a row reading "after the reload" converts to its after-state with the transition dropped ([#271](https://github.com/a1exk-dev/claude-tui/issues/271)).
- A timing claim becomes a check only where ctui's own work could move the number. An interval ctui requests is asserted as the requested value (`ms: 100`, the 1 s tick, `SCAN_MS = 60_000`), never as frames or milliseconds on a screen ([#273](https://github.com/a1exk-dev/claude-tui/issues/273)).
- **No Python ships in this repo** (`MEMORY.md`). The harness is a port, not a copy; the eval fixture is `calc.ts`.
- No slice runs the old 133-row sweep of `docs/testing/live-checks.md`: it cost over 15% of a 5 h usage window on 2026-10-12.

### What the build starts from

| Input | Where |
|---|---|
| The Python harness the port rewrites (`pty_serve.py`, `pty_once.py`, `colors.py`, `glass.py`, `newcfg.sh`, eight shell helpers, `HARNESS.md`, `results.md`, the MCP stub) | `.scratch/live-checks-harness-python/`, gitignored, 120 KB |
| The 2026-10-12 PASS evidence the 19 rows rest on | `results.md` in that folder |
| The row text and the `L<n>` numbering every ticket cites | `docs/testing/live-checks.md` on `release/0.5.0`, 185 lines |
| Scenario 7's fixture generator (800 transcripts, 381 MiB, prints the expected month total) | `scripts/cost-fixture.ts` on `release/0.5.0` |
| The eval suite's three jobs | `prototypes/todo-nudge/run.sh` on `prototype/todo-nudge` |

### The file layout

```
.claude/skills/live-checks/
  SKILL.md                      the operator-run skill: scenarios, checks, report
  HARNESS.md                    step vocabulary, geometry, theme facts
  harness/harness.ts            serve (fifo, interactive) and once (one-shot)
  harness/screen.ts             dump, dumpbg, cells, runs
  harness/steps.ts              type, enter, key, click, move, wheel, resize, setopt, setting, sh, watch, anim, grep
  harness/config.ts             seeds a signed-in CLAUDE_CONFIG_DIR, the MCP stub among its servers
  harness/tsconfig.json         the harness project: the Node types, checked beside the root one
  harness/fixtures/             the MCP stub and the custom-theme fixture
ctui/evals/                     the task-list nudge suite and its calc.ts fixture
docs/testing/live-checks.md     the operator page, emptied of rows
```

`.claude/skills/live-checks` is the first **repo-own** skill in a directory that until now held only pinned upstream copies: no `skills-lock.json` entry, and `npx skills update` must leave it alone. `claude plugin validate .` never reads it — the repo root holds a marketplace manifest, not a plugin.

### Slices

#### 1. Port the harness to TypeScript

Executes [#274](https://github.com/a1exk-dev/claude-tui/issues/274). Applies "No Python ships in this repo" and "One pinned Claude Code version".

- Add `node-pty@1.1.0` and `@xterm/headless@6.0.0` to the **root** `devDependencies` only, never to `ctui/package.json`. npm gates `node-pty`'s build script, so `CONTRIBUTING.md` gains the one-time `npm install-scripts approve node-pty`. CI never builds the binding: `check.ts` never starts the harness.
- Write the four modules above, replacing both Python drivers, `colors.py`, `glass.py` and all eight shell helpers. The capabilities the paint rows need are verified on the pin: per-cell `fg`/`bg` truecolor, `b` (bold), `u` (SGR underline), and `p.resize(cols, rows)` reaching the child.
- `config.ts` seeds a scenario's `CLAUDE_CONFIG_DIR` under `$TMPDIR` at run time, as `newcfg.sh` does: copy `~/.claude/.credentials.json` at mode 0600, synthesize `.claude.json` (onboarding complete, this repo trusted) from the operator's own, write the scenario's `settings.json`. Under `--mcp` it also seeds `fixtures/mcp-server.ts` as a local-scope stdio server, so a scenario that reads the process tree has one server to see; it stays a stub, with no network. **Nothing signed-in is ever written into the repo.** A dir grows to ~24 MB (15 MB `plugins/`, 4.4 MB `skills/`); it is deleted on pass and kept on failure.
- Write `HARNESS.md` with the step vocabulary, the geometry (body columns at each dock width) and the theme facts the checks read.
- Give the harness its own `tsconfig.json`, holding the Node types and `allowImportingTsExtensions`, and have `scripts/check.ts` run `tsc` over it beside the root project. (`scripts/*.ts` is not type-checked today; the port must not inherit that gap.) The root config keeps its own types: ctui runs in the engine rather than on Node, so `ctui/hooks`, `ctui/plugins` and `ctui/tests` must never type-check with Node globals in scope.
- `MEMORY.md`: a rule that `live-checks` is repo-own, has no `skills-lock.json` entry, and `npx skills update` must not touch it.
- Tests: none. The harness is skill-only tooling that boots a real engine; `check.ts` never runs it.

#### 2. Write `SKILL.md` and the named check ids

Executes [#274](https://github.com/a1exk-dev/claude-tui/issues/274) and [#273](https://github.com/a1exk-dev/claude-tui/issues/273). Blocked by slice 1. Write it with the `writing-for-agents` skill.

- 7 scenarios, 30 checks, one subagent per scenario. The scenario is the unit that costs — one seeded config dir, one engine boot — and resizes, `/theme`, `setopt` and folds all happen inside a session.
- Each subagent seeds its own dir, drives its checks through one session, and returns **only finished table rows**, each carrying its section prefix. The session is a fifo one, except scenario 7's: its arrival check is timed from the session's own start, where a first `send` would add its own latency, so it drives the harness's `once` over a steps file. Its screen dumps die with it (60–120 KB per scenario in the 2026-10-12 run); the lead never sees one.
- The lead runs `node scripts/check.ts` first, spawns the seven, merges rows into report sections and writes the version block.
- **Scenario 6's two model turns are asked explicitly** ("plan three steps with your task tools") and always run: no skip flag, so every report is the same shape and complete. Three other scenarios spend one turn each — the rule-gutter and ctrl+o checks need a reply and a `$ Bash` row on screen, the fresh-110 docking check needs a submitted prompt, and the main-screen toast check needs a background agent to announce — so a run spends about five turns across scenarios 1, 2, 5 and 6. The count is a field in the report's version block, not a number this spec fixes.
- Peak temp churn is ~550 MB per run (seven dirs plus scenario 7's 381 MiB fixture), against the ~600 MB the old 25-dir sweep produced.
- The report is one Markdown file written to the run dir with its path printed, pasted into the pull request. It carries a `measured` column so a PASS states its evidence, stable named check ids, and one version block naming the plugin version and commit, the engine pin, the `check.ts` result, and the model and effort the run used. A failed scenario's config dir path is in the report.
- Tests: none.

##### The scenarios

| # | Scenario | Seed | Checks |
|---|---|---|---|
| 1 | `default-150` | Fullscreen 150 cols, default settings, a scratch repo with an upstream, one staged, one modified and one untracked file and one stash | 8 |
| 2 | `fresh-110` | A fresh config at 110–143 cols, two launches | 2 |
| 3 | `dock-columns` | `dockColumns` set in `.claude.json` | 1 |
| 4 | `themes` | Everforest → Catppuccin Latte → `inherit` on built-in `dark` → `inherit` on the seeded `custom:fixture` | 11 |
| 5 | `main-screen` | `--settings '{"tui":"default"}'` at 200 then 120 cols | 2 |
| 6 | `todo` | Task tools on, the default model — **the two explicit model turns** | 4 |
| 7 | `cost-cold-cache` | `limits_cost: "on"`, `scripts/cost-fixture.ts` into `$CLAUDE_CONFIG_DIR/projects/fixture`, each file's page cache dropped with `dd if=<f> iflag=nocache count=0` (**no root**), boot with no prompt sent | 2 |

##### The check ids

Ids replace the old document's line numbers, which stop meaning anything once its rows are deleted. The prefix is the report section; `hover-underline` and `clear-swaps-id-and-cost` are fixed by [#275](https://github.com/a1exk-dev/claude-tui/issues/275) (the second is a `MEMORY.md` entry, not a check).

| Scenario | Check id | Expected, and what `measured` carries |
|---|---|---|
| 1 | `docking/width-42-at-150` | The engine grants a 42-column body at 150 cols — the body's column range off the cell grid, not ctui's request |
| 1 | `docking/width-53-at-170` | Resized to 170 inside the session, the body is 53 columns |
| 1 | `docking/close-attempts-ignored` | The Sidebar stays open through an SGR click on `✕`, ctrl+x x and Esc while focused (**ctrl+x x needs the bare pty**: tmux does not deliver it) |
| 1 | `layout/git-glyph-columns` | `U+E725`, `U+E702`, `U+E728` at body column 0 with text at column 2, in their theme roles |
| 1 | `layout/frame-and-footer` | Claude Code's `│`, `✕` and the row below; the footer one row at 53 and two at 42; the `│` on every body row at the dock's edge; no update icon |
| 1 | `layout/no-child-processes` | Over 10 s of `pstree -a <pid>`, only MCP servers and short `git` runs: no `claude -p`, no `claude mcp list` |
| 1 | `rewrites/rule-gutter` | Nothing ctui rewrites — the prompt panel, the reply, the `$ Bash` row — reaches the two columns `paddingRight: 2` reserves, so a reply forced to carry an unbroken 200-character token wraps at 104 against the rule at 107; rows Claude Code draws alone go further |
| 1 | `rewrites/ctrl-o-transcript` | ctrl+o, then ctrl+o again: the same rows, each call with its full result under it |
| 2 | `docking/fresh-110-prompt-docks` | Nothing docks at start; the prompt docks the Sidebar |
| 2 | `docking/fresh-110-next-session-docks` | `pluginPanes.asked` persisted, so the second launch docks at start |
| 3 | `docking/dock-columns-override` | A dragged or keyed `dockColumns` overrides the 42/53 the Sidebar asks for |
| 4 | `themes/glass-flat` | One flat `#363d41` on every body cell, padding included, through scroll, fold, a resize past 160 and back, and a `/theme` file rewrite — with no stripes |
| 4 | `themes/glass-frame` | On built-in `dark` the rule column, the `✕` row and the row below keep the dock color so a frame shows; with Everforest picked in `/theme` too, the frame turns `#363d41` and goes away |
| 4 | `themes/latte-body` | The body is `#e5e7ed` on `dark` and on `Catppuccin Latte`; the frame shows on the first and vanishes on the second |
| 4 | `themes/inherit-no-paint` | Under `inherit`, the body shows the `/theme`'s dock color, the same as the frame |
| 4 | `themes/omarchy-mix` | A custom `/theme`'s background mixed 6% toward its foreground, one flat color, under `inherit`. The theme is `harness/fixtures/theme.json`, committed with Everforest's `#2d353b` and `#d3c6aa` so the expected mix stays `#373e42`, and seeded into every config dir as `custom:fixture`: nothing in the skill may assume the operator runs Omarchy, and the harness neither reads a theme out of their home nor runs `omarchy theme set` (HARNESS.md). The id keeps its name because the rule it measures exists for Omarchy's template, which writes the theme's background to `inverseText` |
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

#### 3. The operator page and the five knowledge edits

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

#### 4. The engine-pinned expectation and the third pin tie

Executes [#275](https://github.com/a1exk-dev/claude-tui/issues/275). Independent of slices 1–3. Applies "One pinned Claude Code version".

- **`MEMORY.md`** gains one entry owning the class: the expectation, the pin it was measured on, and the fact that ctui neither asks for the behaviour nor can suppress it. Two members, named for an operator rather than by line number:
  - `hover-underline` — the engine underlines whatever row the mouse is over. **Not reported upstream**: engine chrome that reads as an intentional hover affordance, with nothing broken on ctui's side.
  - `clear-swaps-id-and-cost` — clearing swaps the session id and the cost total in one step (measured in #153).
  The tmux 256-colour fact stays in its own entry, cross-referenced, because its job is user setup. `tmux capture-pane` under-reporting blank cells is dropped: a fact about a tool the TypeScript harness no longer uses.
- **`CONTEXT.md`** gains **Engine-pinned expectation**, beside "live check".
- **`scripts/check.ts`** gains the **third pin tie** (~6 lines), beside the README "Tested with" line and the `COMPATIBILITY.md` top row: the new `MEMORY.md` entry must name `package.json`'s pin, so a bump **fails the gate** until the entry is edited into the bump pull request's diff. `check.ts` can only tie a string — it never starts an engine.
- **`MEMORY.md`**, the pin entry's bump procedure: one line that a bump re-runs the engine-pinned expectations and edits that entry.
- Tests: none beyond `node scripts/check.ts` exiting 0. Verify the tie by hand on a scratch edit of the pin, then revert it.

#### 5. The five reachable test gaps

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

#### 6. `ctui/evals/`: the task-list nudge suite

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

### Out of scope for Part 1

Carried from the map, so no build ticket picks one up:

- A CI job that drives a signed-in Claude Code session, and any pty or terminal runner inside the release gate. `node scripts/check.ts` never starts a real engine.
- A per-release human smoke list. The manual mechanism stays in the rule with no members today.
- Measuring a clock that is not ctui's: the spinner's on-screen frame rate, the "`✕` and `down` about 10 s after the kill" of a killed MCP server (`MCP_TIMEOUT` and the engine's client), and every other real-time "within a second" clause.
- An `engine: 2.1.292` field per check (the skill runs against one pin and the version block names it once) and a `COMPATIBILITY.md` entry for an engine-pinned expectation (it ships to users).

## Part 2 — the subshell pass and its report on the pull request (map [#328](https://github.com/a1exk-dev/claude-tui/issues/328), Claude Code 2.1.300)

This part covers the build slice of the map [Map: a live-check pass from a subshell, and its report on the pull request](https://github.com/a1exk-dev/claude-tui/issues/328): the `claude -p` invocation that drives a whole pass, the model and effort it runs on, how the starting session gets the report back and what it says about it, the attach step onto the release pull request, and the skill and knowledge edits three measured passes forced. It targets Claude Code **2.1.300**.

The map and its closed tickets hold the decisions, and this part does not re-argue them. Installing Matt Pocock's `/pr` and folding its sections into `.github/pull_request_template.md` was the map's one production change and is already landed ([#331](https://github.com/a1exk-dev/claude-tui/issues/331)): nothing below re-does it, and the template's `## Reports` block is what the attach step writes into.

**Every figure in this part was measured.** Three passes drove the invocation end to end against this pin, and their reports are kept side by side under `~/.claude/projects/-home-a1exk-Projects-claude-tui/live-checks/`, each with its result JSON:

| Pass | Model, effort | Verdict | Cost | Wall | Report |
|---|---|---|---|---|---|
| baseline ([#332](https://github.com/a1exk-dev/claude-tui/issues/332)) | Sonnet, medium | `FAIL 37/38` | $2.82 | 18 min 35 s | `0.6.0-sonnet-baseline.md` |
| haiku ([#333](https://github.com/a1exk-dev/claude-tui/issues/333)) | haiku, medium | `FAIL 35/38` | $0.39 | 21 min 56 s | `0.6.0-haiku-pass.md` |
| low ([#341](https://github.com/a1exk-dev/claude-tui/issues/341)) | Sonnet, low | `FAIL 37/38` | $2.20 | 12 min 56 s | `0.6.0-sonnet-low-pass.md` |

The one FAIL all three share is `themes/hover-underline`, an engine change at this pin rather than a ctui defect; slice 8 deletes the row. **No slice below runs a fourth pass.** The axes this part had to settle are measured, and a slice that wants a new number states the cost first — 7 boots, ~20 minutes, $2.82 — and asks.

### Rules for every slice

- Every slice is one `feature/<name>` cut from `develop` with its pull request into `develop` (AGENTS.md). No release pull request is open for this part, so Part 1's `release/0.5.0` rule governs none of it.
- A slice is done when `node scripts/check.ts` exits 0 and its pull request is merged. No slice here touches `ctui/`, so none adds a test; where a slice would, it says so.
- The pull request template's `## Reports` block answers **N/A** on these pull requests: they are the owner's own into `develop`, where auto-merge waits on `node scripts/check.ts` alone (`CONTRIBUTING.md`). A slice about attaching a report attaches none of its own.
- **One pin: 2.1.300.** A figure measured on 2.1.292 is not carried into this part without a re-measure, and a Part 1 slice's numbers are never edited to match — Part 1 is the 0.5.0 record (see the page preamble).
- The three passes are the evidence. Where a slice's wording and a pass's report disagree, stop and ask the human.

### What Part 2 starts from

| Input | Where |
|---|---|
| The invocation, each flag, and the probe that measured it | [#329](https://github.com/a1exk-dev/claude-tui/issues/329) and [#330](https://github.com/a1exk-dev/claude-tui/issues/330), resolved with the probe output in their answers |
| The three reports and their result JSON | `~/.claude/projects/-home-a1exk-Projects-claude-tui/live-checks/`, 3 reports, kept beside each other |
| The skill as it stands: 38 checks over 7 scenarios, the lead's own `mktemp`, the version block with a turn count | `.claude/skills/live-checks/SKILL.md` |
| The step vocabulary, the geometry and the theme facts a check compares against | `.claude/skills/live-checks/harness/HARNESS.md` |
| The `## Reports` block the attach step writes into | `.github/pull_request_template.md`, landed by [#331](https://github.com/a1exk-dev/claude-tui/issues/331) |
| The two defects the passes raised, both outside this map | [#337](https://github.com/a1exk-dev/claude-tui/issues/337) (the Todo list after a resize out of the dock) and [#338](https://github.com/a1exk-dev/claude-tui/issues/338) (scenario 6's hold turn) |

### Slices

#### 7. The invocation and the starting session's steps, in `CONTRIBUTING.md`

Executes [#329](https://github.com/a1exk-dev/claude-tui/issues/329), [#330](https://github.com/a1exk-dev/claude-tui/issues/330), [#332](https://github.com/a1exk-dev/claude-tui/issues/332), [#333](https://github.com/a1exk-dev/claude-tui/issues/333) and [#341](https://github.com/a1exk-dev/claude-tui/issues/341). Independent of slices 8 and 9. Applies "Tests cover real usage" (`CONTRIBUTING.md` holds the procedure) and "One pinned Claude Code version".

`CONTRIBUTING.md` § `Live checks` keeps its first sentence — why an agent drives these against a real engine — and gains the subshell as the way to start a pass **without switching the session's model**, which is what the subshell buys: an operator or an agent session on any model launches the pass on the model the pass needs.

```bash
RUN=$(mktemp -d -t ctui-live-checks-XXXXXX)
npx claude -p "/live-checks The run dir is already made for you: RUN=$RUN" \
  --model sonnet --effort medium \
  --allowed-tools "Bash Read Write" --strict-mcp-config \
  --output-format json
```

Launched in the background, so the starting session keeps working through the ~20 minutes. Each flag, and what measured it:

| Flag | Why it is there |
|---|---|
| `-p "/live-checks …"` | A slash command in a `-p` prompt is a **user** invocation, so the skill's `disable-model-invocation: true` does not block it: the engine expands the skill body into the session. Measured by a probe that answered `38 checks, 7 scenarios` — two numbers that appear only in the skill body — where the same prompt with the slash command removed answers `NOT PROVIDED` ([#329](https://github.com/a1exk-dev/claude-tui/issues/329)) |
| `--model sonnet --effort medium` | The verdict below. **All seven scenario subagents inherit both**, read off the request bodies the engine logs in the session transcript, each carrying the launch flags in `params.model` and `params.output_config.effort`. So a subshell's model is the whole pass's model, not a lead's that hands the scenarios something else ([#329](https://github.com/a1exk-dev/claude-tui/issues/329)) |
| `--allowed-tools "Bash Read Write"` | The grant the harness needs, traced below ([#330](https://github.com/a1exk-dev/claude-tui/issues/330)) |
| `--strict-mcp-config` | Drops the operator's own MCP servers, and the 38 tool definitions they contribute, from the lead's prompt and all seven subagents'. Nothing in a pass calls one ([#330](https://github.com/a1exk-dev/claude-tui/issues/330)) |
| `--output-format json` | The dollar cost and the `permission_denials` list exist nowhere else. Without it the starting session can report neither ([#332](https://github.com/a1exk-dev/claude-tui/issues/332)) |
| `RUN=` in the prompt | The caller mints the run dir, so the report path is known before anything launches and no line of model-authored prose has to be parsed for it. Slice 8 makes the skill honour it ([#329](https://github.com/a1exk-dev/claude-tui/issues/329), [#335](https://github.com/a1exk-dev/claude-tui/issues/335)) |

**`--allowed-tools` is variadic**, so a prompt placed immediately after it is swallowed as a tool name and the run dies with `Input must be provided either through stdin or as a prompt argument when using --print`. Keep another flag between them, or send the prompt on stdin ([#329](https://github.com/a1exk-dev/claude-tui/issues/329)).

**The grant lifts a per-call approval per *effect*, not per tool name.** A Bash command with no effect outside the session runs whatever the list says; one that writes or reads outside the working directory needs `Bash` listed, and the same path rule governs `Read` and `Write` as whole tools. Every seeded config dir, `$RUN` and every scratch repo lives under `$TMPDIR`, which is what puts all three on the list: `Bash` for every harness step from `mkdir -p $S` to the `rm -rf "$CFG"` cleanup, `Write` for the lead's `$RUN/report.md` and scenario 1's project skill at `$S/repo/.claude/skills/ctuicheck/SKILL.md`, and `Read` for scenario 3's read of the operator's `~/.claude.json` and anything a subagent opens under `$CFG` or `$RUN`. **No `--add-dir`**: with those three listed, writes outside the working directory go through on the grant alone, measured identically with and without it. **`Agent` needs no entry** — it is ungated at this pin, and a lead launched with this list spawned a subagent and got its hand-back with `permission_denials` empty ([#330](https://github.com/a1exk-dev/claude-tui/issues/330)).

**The model and effort are Sonnet at medium effort, with both axes measured and both alternatives rejected.** `CONTRIBUTING.md`'s existing "Sonnet at medium effort" sentence stands word for word; what it gains is the evidence beside it, so the next person to wonder about a cheaper pass reads the answer instead of running one:

- **haiku at medium effort misses the bar.** `FAIL 35/38`, two rows flipped — `themes/dock-tint` and `menu/dock-pane-colors` — and both flipped to a **wrong drive** rather than to anything the screen did differently: the second read `/theme`'s New custom theme form (`Name: xy`, `Enter to continue · Esc to cancel`, Catppuccin's hexes) in place of the `/ctui` menu's field row (`⏎ submit`, the engine's `›`, Flexoki Light's), and read it confidently. Its 36 mechanical cell reads agreed with Sonnet's. So haiku reads a cell grid accurately and fails at the part that is not mechanical — driving a scenario into the state a row asks about, and noticing it is on the wrong screen. $2.43 saved per pass, on a release-pass-only cadence, does not buy that ([#333](https://github.com/a1exk-dev/claude-tui/issues/333)).
- **Sonnet at low effort flips no row and still loses.** Same verdict as medium, `FAIL 37/38`, at $2.20 and 12 min 56 s. It loses on **self-report**: its lead recorded the gate as `PASS 10 tests` where `node scripts/check.ts` runs 360, and returned two PASS rows with no evidence in the `measured` cell — `toasts/main-screen-prefix` with no `runs` read, the toast having cleared, and `themes/focus-arrows` taking the first arrow's inversion without comparing an unfocused cell. Slice 8's gate wording closes the first; the second is judgement that a cheaper effort did not spend, and a PASS with no evidence is the one thing the row contract exists to prevent ([#341](https://github.com/a1exk-dev/claude-tui/issues/341)).

There is no fallback branch to write. A pass that cannot run on Sonnet at medium effort does not run.

**The starting session's own steps**, in this order, as one paragraph of the same section:

1. **Read `permission_denials` first, before a single row.** Non-empty means the pass is **void** — not a pass with FAIL rows in it, because a denial stops a step rather than measuring a cell. Name the denied tool and its full `tool_input`, and start over. All three passes came back empty, so the grant is known to cover a whole pass; a denial means the list or the harness moved.
2. **The exit status proves nothing.** A denied pass still exits `subtype: "success"`, `is_error: false`, and a denial surfaces only as an `is_error=true` tool row inside the subshell's own output and as an entry in that array ([#330](https://github.com/a1exk-dev/claude-tui/issues/330)).
3. **Read `.result` for the lead's last line** — the verdict, the tally and the path, in the report heading's own shape ([#335](https://github.com/a1exk-dev/claude-tui/issues/335)). It is a free cross-check that the lead wrote where it was told; the path itself is the one the caller minted.
4. **Fill the version block's two holes** in `$RUN/report.md`: `cost` from the result JSON's `total_cost_usd`, and `wall` from the caller's own timing. The lead can measure neither and writes both as `—` (slice 8).
5. **Never write a turn count.** `num_turns` counts the **lead's own turns** — 3 on both Sonnet passes against haiku's 28, a gap that is foreground against background scenario spawn rather than model work — so it is not the pass's turn count and no result-JSON field is. The report carries no such field at all (slice 8).
6. **Name each `FAIL` with its measured cell**, so the human reads what the screen showed rather than a tally.
7. **Ask before writing anything into a pull request**, which is the attach step.

**The attach step.** On the operator's word and not before, the whole report is pasted into the release pull request's `## Reports` › `### Live checks` section — the one into `main`, which a human merges. Whole, never a tick per section: a report is atomic and complete, all 37 rows in every run whatever it found, which is what makes it attachable. `CONTRIBUTING.md`'s existing § `Reports` paragraph and the template already say which pull request attaches which report ([#331](https://github.com/a1exk-dev/claude-tui/issues/331)) and need no edit; what this slice adds is that the starting session asks first, and that the report it pastes is the one with the version block filled.

- Tests: none. No `ctui/` file changes, and `node scripts/check.ts` never starts an engine.

#### 8. The skill and harness edits the three passes forced

Executes [#335](https://github.com/a1exk-dev/claude-tui/issues/335), [#338](https://github.com/a1exk-dev/claude-tui/issues/338) and the row edits [#332](https://github.com/a1exk-dev/claude-tui/issues/332) and [#341](https://github.com/a1exk-dev/claude-tui/issues/341) left. Independent of slices 7 and 9. Write it with the `writing-for-agents` skill. Applies "Engine-pinned expectations hold only on the pinned Claude Code version".

Nine edits to `.claude/skills/live-checks/SKILL.md` and one to `harness/HARNESS.md`. Every one of them is a drive-text or report-shape change; none touches a check's subject.

- **§ 1, the run dir.** `mktemp` stops being unconditional: the run dir is `$RUN` — the one the invocation named, or a fresh `mktemp -d -t ctui-live-checks-XXXXXX` when it named none. `$RUN/<scenario>/` and `$RUN/report.md` are unchanged below it. This leaves an operator typing `/live-checks` in their own session with exactly today's behaviour, and gives the subshell caller a deterministic report path ([#335](https://github.com/a1exk-dev/claude-tui/issues/335)).
- **§ 1, the gate line.** The lead keeps writing it — it is the one version-block figure it measures itself — and the wording closes the hole the low pass found. Land this: *the gate prints one summary line; copy that line's verdict, test count and duration into the version block, not a figure from the output above it. The suite runs several hundred tests, so a count in the tens means you copied a tail.* The gate run itself stays unconditional, including when the session that launched the lead just ran it: ~9 s against a 20-minute pass, and the block then records a result measured at the commit about to be checked ([#335](https://github.com/a1exk-dev/claude-tui/issues/335), [#341](https://github.com/a1exk-dev/claude-tui/issues/341)).
- **§ 3, the version block.** The `run` line loses its turn count and the block gains one line with two holes the starting session fills:

  ```markdown
  ## ctui live checks — PASS (37/37)

  plugin ctui 0.6.0 (da270ab)
  engine @anthropic-ai/claude-code 2.1.300
  node scripts/check.ts  PASS  360 tests, 9 s
  run 2026-10-15T09:14Z  Sonnet, medium effort
  cost —  wall —
  run dir /tmp/ctui-live-checks-0.6.0-sonnet
  ```

  The lead writes both as `—`; it can measure neither, the cost living in the result its own caller reads and the wall-clock being the caller's timing. The dashes are deliberate: a line with holes in it is visibly unfilled, where an absent line is invisible — and in an operator's own interactive run the dashes stay and say truthfully that nobody measured them. The model and effort are the ones the invocation named, else the lead's own session's ([#335](https://github.com/a1exk-dev/claude-tui/issues/335)).
- **§ 3, no turn count anywhere.** The field goes from the version block and the skill asks for no replacement. `num_turns` counts only the lead's own turns and no result-JSON field carries the pass's, and a lead that is asked for one writes the budget it was told: both the haiku and the low report recorded "10 model turns", the skill's own prose, where the JSON said 28 and 3 ([#333](https://github.com/a1exk-dev/claude-tui/issues/333), [#341](https://github.com/a1exk-dev/claude-tui/issues/341)).
- **The intro's cost sentence.** "7 boots, 10 model turns and about 550 MB of temp churn" keeps its shape, with the turn figure marked a **floor, not an estimate**: the baseline pass spent 14 — two on Explore agents that ended before sampling, and two re-booting scenario 5 after another scenario killed it ([#332](https://github.com/a1exk-dev/claude-tui/issues/332)).
- **"Driving a scenario", the `pkill` hazard.** `pkill -f 'harness.ts serve'` is today's fallback for a session that will not quit, and its pattern matches **every concurrent scenario's** serve: in the baseline pass it cost scenario 5 its boot and two model turns. Scope the fallback to the scenario's own background pid, and say plainly that the bare pattern is the one way a scenario can cost another its boot. Both later passes carried this as a prompt override, which is why neither lost a boot to it ([#332](https://github.com/a1exk-dev/claude-tui/issues/332), [#333](https://github.com/a1exk-dev/claude-tui/issues/333)).
- **Scenario 6, the hold command.** The engine refuses a standalone foreground `sleep` at this pin (`Blocked: standalone sleep 300`; `MEMORY.md`, `no-foreground-sleep`), and that refusal cost `todo/own-list-hidden` its measurement in the baseline pass. The hold becomes **`timeout 60 tail -f /dev/null`** in the foreground: 60 s is comfortably longer than every hold the scenario takes — the longest sample pair is ~36 s in — and it is the duration that actually ran, where `timeout 300` is long enough to look like a hang to whatever rejected it ([#338](https://github.com/a1exk-dev/claude-tui/issues/338)).
- **Scenario 6, checking the hold took.** One line telling the session to verify it: a refused hold shows as a Bash row reading `interrupted` with the turn ending in seconds instead of parking a sweeping row. On seeing that, re-drive the same turn. This is not belt and braces — the low pass carried the same prompt against the same pin and had one boot hold and one refused, and the scenario that noticed and re-drove got all six todo rows back. A scenario that trusts the hold loses four motion rows ([#341](https://github.com/a1exk-dev/claude-tui/issues/341)).
- **`themes/hover-underline` is deleted**, and the pass becomes **37 checks over 7 scenarios**: scenario 4 `themes` goes from 11 checks to 10, the `themes/` prefix row of § 3's section table from 10 to 9, and the intro's and the report heading's tallies with them. The row asserts an underline the engine stopped drawing at 2.1.300 and is the one FAIL all three passes share. Nothing of ctui's rides on it: ctui sets `underline` nowhere, a mod has no opt-out, and the row was always reading the engine's own paint. **Nothing replaces it** — no check reads the underline again, and `MEMORY.md` says so (slice 9). Part 1's scenario table still reads 11 and is not edited ([#332](https://github.com/a1exk-dev/claude-tui/issues/332)).
- **`harness/HARNESS.md`'s theme facts.** The line "The engine adds SGR underline (`u=1`) to every hovered cell. ctui neither asks for it nor can suppress it" is false at this pin and goes with the row. A check compares against this file, so a stale fact here outlives the row that quoted it.

Two things that look like edits and are **not**:

- **`todo/no-dock-100-cols` needs no drive change** beyond the hold command above. The specced `resize 100 45` path drew Claude Code's list with the footer on `ctrl+t to hide tasks` in both passes that held the turn properly, two of three; the baseline saw nothing because its turn had already died to the refused `sleep`. The row's own text stands ([#337](https://github.com/a1exk-dev/claude-tui/issues/337), [#341](https://github.com/a1exk-dev/claude-tui/issues/341)).
- **`layout/frame-and-footer` needs no edit, and quotes no colour.** The dock rule `│` read as **fg default** on 41 of 41 body rows at both 42 and 53 columns in the low pass and in the baseline, against haiku's one reading of `#b1b9f9`. The row asserts no colour and must not start: the class's own rule is that a live check may assert the rule is there and read the colour it carries, and may not require one ([#341](https://github.com/a1exk-dev/claude-tui/issues/341)).

- Tests: none. The skill is operator tooling that boots a real engine; `node scripts/check.ts` never runs it.

#### 9. The two stale underline facts in `MEMORY.md`

Executes the `hover-underline` edit [#332](https://github.com/a1exk-dev/claude-tui/issues/332) and [#339](https://github.com/a1exk-dev/claude-tui/issues/339) left to this slice. Independent of slices 7 and 8. Apply `domain-modeling` and [`docs/agents/domain.md`](../agents/domain.md).

The engine stopped underlining the hovered cell at 2.1.300, and two `MEMORY.md` entries still tell a reader it does. One was on the map's list; the other was found while writing this part and is the one that would have misled a builder, since it is the entry an agent reads before touching a hover.

- **"Engine-pinned expectations hold only on the pinned Claude Code version", the `hover-underline` bullet.** It already records the change and says rewriting the row belongs here. Finish it: the row is **deleted**, no live check reads the underline any more, and the next pin bump measures it by hand or off the vendored types — the position `clear-swaps-id-and-cost` already sits in. The member stays in the class with its 2.1.292 history intact, because the pin is what makes an expectation expire and this one expired visibly.
- **"Sidebar colors inherit the Claude Code theme", the Guidance.** It reads "ctui asks for no underline anywhere, and the engine adds its own to every hovered cell, which a hover check expects alongside the accent colors". The first clause is still true and the rest is not: the engine added one on 2.1.292 and stopped at 2.1.300, and the hover check now expects the accent colours alone. The entry's Reason keeps its 2.1.292 account as dated history, cross-referencing the engine-pinned entry for what happened since.

**`ctui/tests/sidebar-dock.test.tsx` is not touched, and this slice says why** so that a later reader does not delete it as dead weight. Its test "a title row lights in accent as one with its fold arrow, with no underline" asserts ctui's own hover payload exactly — `toEqual({ scope, color: 'suggestion' })` — so it fails if anyone re-adds `underline: true` to a hover, which `TextHoverProps` permits. That is [#124](https://github.com/a1exk-dev/claude-tui/issues/124)'s decision, ctui's and not the engine's, and it holds whatever the engine paints on top; the mock kit never saw the engine's underline at all. No ctui source changes in this part either: ctui never set `underline`, so there is nothing at 2.1.300 to stop asking for.

- Tests: none beyond `node scripts/check.ts` exiting 0, which ties the engine-pinned entry to `package.json`'s pin by string.

### Out of scope for Part 2

Carried from the map, so no slice above picks one up:

- **Which pull requests get a live run.** Settled before charting and unchanged: the release pass only, with the owner's own `develop` pull requests answering `N/A`. The subshell makes a pass cheaper to **start**, not more frequent. Any widening is a fresh effort against the 2026-10-10 cost decision, with haiku's measured $0.39 as its new evidence.
- **Running the pass in CI.** The checks need a signed-in terminal and a hosted runner has none.
- **Fixing either defect the passes raised.** [#338](https://github.com/a1exk-dev/claude-tui/issues/338) is a drive-text edit that slice 8 lands, and the issue closes with it; the engine's refusal itself is the engine's. [#337](https://github.com/a1exk-dev/claude-tui/issues/337) is now likely not a defect — two of three passes drew the list on the specced path, and the third had a dead turn — and one deliberate boot settles it, outside this part.
- **A haiku fallback branch**, and any per-pass model choice. One model, one effort, named in `CONTRIBUTING.md`.
- **A turn count in the report**, by any route. No result-JSON field carries the pass's, and the lead writes its budget when asked.
