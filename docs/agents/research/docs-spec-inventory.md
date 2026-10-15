# What `docs/spec/` holds that nothing else does (inventory for #348, map #347)

Scope: facts only. No disposition is proposed. Snapshot: `develop` at `2cdb687` (2026-10-15; ctui 0.5.0, pin Claude Code 2.1.300). `main` and `v0.5.0` hold only `v0.1.md` and `live-checks.md`; `sidebar-icons.md` and `working-now.md` exist on `develop` and no tag. Line numbers are `develop` at that commit. Sources: the four spec files, `MEMORY.md` (385 lines on develop), `CONTEXT.md`, `AGENTS.md`, `ctui/COMPATIBILITY.md`, `git tag`, the code.

## Status each spec claims, and what the repo says

| Spec | Claimed status | Evidence |
|---|---|---|
| `v0.1.md` (279 lines, added 5f39b40, 2026-10-06) | Line 3 banner: "Superseded in part by ctui 0.4.0 (#168) ... The text below records the earlier state." Targets Claude Code 2.1.288. | Shipped: tag `v0.1.0`, `COMPATIBILITY.md` rows 0.1.0 on 2.1.288 and 2.1.292. Last edited at 0.4.0 (ac97c81, 2026-10-09). Names `/ctui:theme`, `/ctui:plugins:enable\|disable`, `hooks/pickers.tsx` and `hooks/commands.ts` (neither file exists; `/ctui` menu is `hooks/menu.tsx`), `scripts/check.sh` (deleted), the old MCP/Todo/Agents glyphs. |
| `live-checks.md` Part 1 (lines 7-206) | "the shipped 0.5.0 record" (line 3), pin 2.1.292, map #266 | Tag `v0.5.0` (2026-10-09 in COMPATIBILITY). Harness, `SKILL.md`, `ctui/evals/`, `docs/testing/live-checks.md`, `CONTEXT.md` "Live check" / "Engine-pinned expectation", `check.ts` third pin tie all exist. |
| `live-checks.md` Part 2 (lines 208-353) | "0.6.0's work", pin 2.1.300, map #328. Slices 7, 8, 9. Spec added by a25e4ad / merged #342 on 2026-10-15 | **Not shipped.** No `v0.6*` tag; `ctui` still 0.5.0 in `plugin.json` and `package.json`; no `release/0.6.0` branch. The pin did move to 2.1.300 (#327, `package.json`, `MEMORY.md:296`). Slice 7: `CONTRIBUTING.md` has no `claude -p` / `permission_denials` / `--strict-mcp-config` text (grep empty). Slice 8: `SKILL.md` still has unconditional `mktemp` (line 35), `themes/hover-underline` (lines 104, 197), "7 model turns" in the version block (line 93), "10 model turns" (line 13), `pkill -f` (line 126), Scenario 1 "14 checks", Scenario 6 "6 checks"; `HARNESS.md:117` still says the engine adds `u=1`. Slice 9: `MEMORY.md:368` (`hover-underline`) was updated to "changed on 2.1.300" and says "Rewriting that row belongs to the live-check spec slice"; the "Sidebar colors inherit" Guidance edit slice 9 asks for (drop the "engine adds its own [underline]" clause) is not made (line 43 still carries the old clause). `no-foreground-sleep` (`MEMORY.md:373`) is already in the class. |
| `sidebar-icons.md` (204 lines, a072bb9) | Lines 12-15: "**ahead of `MEMORY.md`**, not behind it ... Until then this spec is the record." Pin 2.1.292. Line 201 "What is left to decide: Nothing." | **Built, unreleased.** Merged to `develop` as #323 (feature/sidebar-icons) and #324 (feature/working-now-busy), 2026-10-15; no tag contains them. `plugins/marks.tsx` exists; `mcp`, `todo`, `agents`, `skills` plugins import it. The amendments table was applied: `MEMORY.md` entries for `mcp` (91), `todo` (107), `skills` (134), `agents` (154), Workflow (176) and "A Nerd Font icon takes two spaces" (344-350) now carry the new text. So the "ahead of MEMORY.md" claim is stale. |
| `working-now.md` (228 lines, e2f9fe1) | Lines 11-12 same "ahead of `MEMORY.md`" claim. Pin 2.1.292. Line 225 "Nothing left to decide." | Built in the same two PRs (see above). Its "Engine-pinned expectations" amendment was done in its own work (`MEMORY.md:371-372`). `MEMORY.md:91-92, 107` carry its `mcp`/`todo`/`agents` amendments. |

## Per file: where each kind of content lives

### `v0.1.md`

Already elsewhere:
- Decisions: the file says it repeats none (line 7); each slice cites `MEMORY.md` entries by heading.
- Tick list, `$.state` contract: the contract is in `ctui/types/index.d.ts` (`PluginState`, `Task`; line 1 of that file cites the spec). The 1 s tick is in `register.tsx` and in `MEMORY.md` entries (mcp, todo, agents, model).
- Row looks that have a code owner: `limits` (bars, `resets in`, `no limits reported`, cost row) in `ctui/plugins/limits/index.tsx`, `hooks/format.ts`, `tests/usage.test.tsx`; git header rows in `MEMORY.md:69`; `nothing running` / `no tasks yet` in the plugin sources; toast texts in `MEMORY.md:154` and `register.tsx`.
- Module layout: the directories exist (`hooks/`, `plugins/`, `tests/`); `pickers.tsx`, `commands.ts` are gone.
- Release/branch rules: `AGENTS.md`, `MEMORY.md` "Publish to Anthropic's plugin directory and to npm".

Exists only in the spec (grep of MEMORY/CONTEXT/code found no other copy):
- The "Known differences from the renders" table (lines 259-279, 15 rows, each with its source ticket). `MEMORY.md:258, 274, 287` mention individual differences and point at "the build spec" (258) but do not hold the table. Linked from `ctui/README.md:57` and `docs/configuration.md:168`. Its header says "Recheck each one on a pin bump" (2.1.288). Rows cite the old Footer/MCP/glyph wording.
- The build order (slices 1-10), per-slice test plans and per-slice live-check lists (historical; v0.1.0 shipped).
- The module-layout table's per-file roles.
- Level-colour thresholds (below 50 / 85) and the `limits` folded-summary formats (`62$ · 5h 34% · wk 81%`) are in the spec; the code in `plugins/limits/index.tsx` and `format.ts` implements them (code is the other copy). `MEMORY.md:148` cites the spec for "the look (variant D, `$` after the digits)".
- Stale-by-now content that nothing else mirrors: slice 7 (commands and pickers), slice 1's `check.sh` text, the 2.1.288 pin.

### `live-checks.md`

Already elsewhere (Part 1):
- Check ids, scenarios, expected values: `.claude/skills/live-checks/SKILL.md` (the skill is the home; `CONTEXT.md` "Live check" says "the ids, the scenarios they run in and the report's shape belong to the skill").
- The three-mechanism placement rule, measured-not-shape, after-state, timing rule, 2-minute ceiling: `MEMORY.md` "Tests cover real usage" (entry at 303-320).
- Engine-pinned class and members: `MEMORY.md` "Engine-pinned expectations ..." (entry at 362-377), `CONTEXT.md:25`. Third pin tie: `scripts/check.ts`.
- No Python: `MEMORY.md` "No Python ships in this repo" (379-385; its Reason cites the spec).
- Repo-own skill rule: `MEMORY.md` "Repository skills".
- Eval suite rules: `MEMORY.md` "The task-list nudge is measured by `ctui/evals/`", `CONTRIBUTING.md`.
- Which PR attaches which report: `CONTRIBUTING.md` Reports paragraph and `.github/pull_request_template.md` (spec says they need no edit).
- The 2026-10-12 PASS evidence and Python harness: `.scratch/` (gitignored, absent from the repo).

Exists only in the spec:
- Part 1: the file-layout tree, slice-by-slice build order (slices 1-6) and per-slice tests, the six converted-test-gap rows (lines 167-174) and the list of live rows deliberately not converted with reasons (line 176), "Out of scope" lists (199-206), the cost figures for the old 133-row sweep (>15% of a 5 h window), 550 MB churn, 18 eval sessions per run.
- Part 2 (all of it is unbuilt, so it is the only copy): the `claude -p` invocation and each flag's justification (lines 251-272); the model/effort verdict with haiku and Sonnet-low evidence (274-279); the starting session's seven steps (281-289); the attach step (291); the nine `SKILL.md` edits and one `HARNESS.md` edit (295-330); the two stale-underline `MEMORY.md` edits (332-343); the three passes' cost/wall/verdict table (216-220) and the report locations under `~/.claude/projects/.../live-checks/` (outside the repo); out-of-scope list (345-353).

### `sidebar-icons.md`

Already elsewhere:
- Glyphs by `nf-md-` name and roles: `MEMORY.md` entries for `mcp` (91), `todo` (107), `skills` (134), `agents` (154), Workflow, "A Nerd Font icon takes two spaces" (344-350). Codepoints and roles as code: `ctui/plugins/marks.tsx` `MARKS` (U+F0133, F0130, F05E1, F0028, F043E, F0159, F0377, F1A27; `SWEEP` frames 0xF0A9E..; `frozenSweep` = slice 6), pinned by `ctui/tests/marks.test.tsx`.
- Two-space rule: `MEMORY.md:344-350`, `marks.tsx` `GAP`. Git-header exemption: `MEMORY.md:69, 344-350`, `docs/design/sidebar.html:22-25`.
- Weight meanings: `mcp` ("A filled disc wants you, a ring is steady, a ring with a core is connecting", `MEMORY.md:91`); `skills` (ring at rest).
- Tally fold lines, agents `<kind> · <elapsed>`, skills ring-before-count: `MEMORY.md:91, 107, 134, 154`.
- "One glyph, one colour": Claude auto-memory (`~/.claude/projects/.../memory/one-glyph-one-colour.md`, outside the repo) and the `MARKS` table (role travels with the glyph); no `MEMORY.md` entry states the rule or its motion exception by name (grep for "one glyph, one colour" in `MEMORY.md`/`CONTEXT.md` is empty). `CONTEXT.md:13` points at this spec for "the marks".
- Amendments table, "What is left to decide", "Rules for the build": applied; no longer forward-looking.

Exists only in the spec:
- The U+ codepoint table (lines 33-48) as prose; the codepoints themselves are in `marks.tsx` hex literals, not in `MEMORY.md` (which has names only).
- The claim "All 6,896 `nf-md-*` codepoints are present in the installed font".
- The weight-means table for `todo` and `agents` ("a filled disc is settled; the sweep is running").
- The explicit "One glyph, one colour" rule text (69-75) and `checkbox_marked_circle`/`close_circle` shared between `todo` and `agents`.
- The ASCII mock-ups for `agents` rows and fold-line tallies (107-113, 134-139).
- Row-shape decisions: `⚙`/`$`/`workflow` removed, a subagent's `type` moves right, a wordy reason gives way first (115-120). `MEMORY.md:154` holds the first and last; the `type`-moves-right case is in the code comment (`agents/index.tsx:66`).
- Exemptions list: tool rows, `✻`, toasts (160-163); toasts line is also at `MEMORY.md:156`.
- Test plan and the live-check column rule (asserting the glyph at content column 0, text at column 3).
- The renders instruction (also `MEMORY.md:340`).

### `working-now.md`

Already elsewhere:
- In-progress definition: `CONTEXT.md:13` (names the three sections and says motion is specified in this spec).
- `mcp` busy rules (module-level count, `finally`, outranks connection state, settles at once, no cap, `n/m` unchanged, `serverOfTool`): `MEMORY.md:92`; code `hooks/mcp.ts`, `register.tsx`, `tests/mcp-sidebar.test.tsx` (comments cite this spec at `mcp.ts:32`, `register.tsx:116, 452`, `mcp.test.ts:163`, `mcp-sidebar.test.tsx:102, 486, 588`).
- Sweep frames/speed/colour (`SWEEP`, `SWEEP_ROLE`, `sweeping`): `marks.tsx`; `todo` and `agents` motion in `MEMORY.md:107, 154`.
- Skills never moves: `MEMORY.md:134`, `CONTEXT.md:13`, `MEMORY.md:372`.
- Fold lines never animate, `circle_slice_6`: `MEMORY.md:91, 107, 154, 371`; live checks `todo|agents|mcp/fold-line-still` (`MEMORY.md:371`, `SKILL.md:155`).
- Engine-pinned `no-skill-for-a-call` and `no-nested-client`: `MEMORY.md:371-372` with their full text; this spec names them and links `docs/agents/research/skill-tool-attribution.md`, which lives on branch `research/skill-tool-attribution`, not on develop.
- Ended-status words, `/clear` carry-over: `MEMORY.md` "Task ends come from notifications".

Exists only in the spec:
- The reasoning for "Several at once: no cap": no two rows share a phase (each `Client` clock starts at mount), nothing redraws the Sidebar, and "Do not add a cap, a global clock, or a shared phase later without reopening those two reasons" (lines 82-96). `MEMORY.md:92` has only "there is no cap on how many rows sweep at once".
- The reasoning why Skills is a log with "no present tense" and why no caveat line is drawn (41-59); `MEMORY.md:134` and `372` carry shorter versions.
- "A connecting server is waiting, not working" is in `CONTEXT.md:13`; the rest of the busy-vs-state rationale (sweeping only on `ok` would hide motion on the call about to fail, line 112-115) is only here.
- Reuse-not-fork rule for `spinner.tsx` (79-80).
- Test plan and live-check additions.

## Every reference to `docs/spec/` outside `prototypes/` (develop)

Files that name the path or link it. Inside the spec dir itself (cross-links): `sidebar-icons.md:9, 12, 204`; `working-now.md:8, 228`.

| File:line | What it says |
|---|---|
| `AGENTS.md:14` | "Build:" bullet. Four links, one per spec: `v0.1.md` (before building ctui v0.1 in `ctui/`, slice by slice); `live-checks.md` (before building the live-check skill, harness, converted tests, eval suite); `sidebar-icons.md` (before changing a Sidebar glyph, colour role or spacing); `working-now.md` (before changing which rows move, the sweep, or a folded in-progress term). All on one line. |
| `CONTEXT.md:13` | "The motion itself is specified in `docs/spec/working-now.md`, the marks in `docs/spec/sidebar-icons.md`." (the **in progress** term) |
| `MEMORY.md:91` | `mcp` Guidance: marks "(`docs/spec/sidebar-icons.md`)" |
| `MEMORY.md:92` | `mcp` busy bullet: "(`docs/spec/working-now.md`, `docs/spec/sidebar-icons.md`)" |
| `MEMORY.md:107` | `todo` rows: "(`docs/spec/sidebar-icons.md`)" |
| `MEMORY.md:137` | `skills` Reason: "(`docs/spec/sidebar-icons.md`)" |
| `MEMORY.md:148` | `limits` Reason: "The look (variant D, `$` after the digits) is in `docs/spec/v0.1.md` from #151." |
| `MEMORY.md:156` | `agents` toasts: "(`docs/spec/sidebar-icons.md`)" |
| `MEMORY.md:340` | "Redraw the renders": "The 'Known differences from the renders' table in `docs/spec/v0.1.md` lists engine limits only, never ctui's own design changes." |
| `MEMORY.md:371` | `no-nested-client`: "(see `docs/spec/working-now.md`)" |
| `MEMORY.md:372` | `no-skill-for-a-call`: "which `docs/spec/working-now.md` rules out for its own reason" |
| `MEMORY.md:385` | "No Python": "`docs/spec/live-checks.md` cited this entry twice before it existed" |

`MEMORY.md` also names a spec without the path at: `97` ("Busy is the working-now spec's (#320, from the map #301)"), `258` ("The build spec lists both as known differences", v0.1.md), `368` ("Rewriting that row belongs to the live-check spec slice", live-checks.md Part 2 slice 9), `377` ("arrived with the working-now spec in #309").

Code and test comments:

| File:line | Cites |
|---|---|
| `ctui/hooks/format.ts:1` | `docs/spec/v0.1.md` |
| `ctui/types/index.d.ts:1` | `docs/spec/v0.1.md` ($.state contract) |
| `ctui/hooks/register.tsx:116` | `docs/spec/working-now.md` |
| `ctui/hooks/register.tsx:452` | `docs/spec/working-now.md` |
| `ctui/hooks/register.tsx:1288` | `docs/spec/v0.1.md slice 8` |
| `ctui/hooks/mcp.ts:32` | `docs/spec/working-now.md`, "It settles at once" |
| `ctui/plugins/marks.tsx:6` | `docs/spec/sidebar-icons.md` |
| `ctui/plugins/marks.tsx:60` | `docs/spec/working-now.md`, "The motion" |
| `ctui/plugins/mcp/index.tsx:7` | `docs/spec/sidebar-icons.md` |
| `ctui/plugins/agents/index.tsx:66` | `docs/spec/sidebar-icons.md`, section "`agents`: no kind glyph at all" |
| `ctui/tests/marks.test.tsx:9` | `docs/spec/sidebar-icons.md` |
| `ctui/tests/mcp.test.ts:163` | `docs/spec/working-now.md` |
| `ctui/tests/mcp-sidebar.test.tsx:102` | `docs/spec/working-now.md` |
| `ctui/tests/mcp-sidebar.test.tsx:486` | `docs/spec/working-now.md`, "`mcp`: when a server is in progress" |
| `ctui/tests/mcp-sidebar.test.tsx:588` | `docs/spec/working-now.md`, "The count lives in a module variable" |
| `ctui/tests/prompt-footer-hooks.test.tsx:4` | `docs/spec/v0.1.md` slice 9 |
| `ctui/tests/rewrites.test.tsx:4` | `docs/spec/v0.1.md slice 8` |

Docs and the skill:

| File:line | Cites |
|---|---|
| `ctui/README.md:57` | "Known differences" section (55-57): `[the full list](https://github.com/a1exk-dev/claude-tui/blob/main/docs/spec/v0.1.md#known-differences-from-the-renders)`. **A `main`-branch URL**; `ctui/` ships in the npm package, so the link is part of the published README. `v0.1.md` exists on `main`. |
| `docs/configuration.md:168` | "Known differences from the renders" section: `[the build spec](spec/v0.1.md#known-differences-from-the-renders)` (relative path, so the earlier plain `docs/spec` grep missed it) |
| `docs/design/sidebar.html:25` | header comment: "the exemption in `docs/spec/sidebar-icons.md`" |
| `.claude/skills/live-checks/SKILL.md:155` | `agents/fold-line-still` row: "`docs/spec/working-now.md`, '`agents`: the running rows': 'A nested background shell sweeps on the same rule as its parent's rows'" |

Checked and clean: `scripts/check.ts` (no `docs/spec` or spec-file name; grep for "spec" empty), `scripts/` generally, `.github/` (workflows and `pull_request_template.md`), `CONTRIBUTING.md`, `docs/testing/live-checks.md`, `docs/agents/*.md`, `.claude/skills/live-checks/harness/*`, `README.md`, `ctui/evals/` (`01-medium/case.yaml` matched `working-now`/`sidebar-icons` only as a bare word in a broader grep, no `docs/spec` path).

`scripts/check.ts` does not read `docs/spec/`: no check ties its content to code, so nothing fails if the files are removed except the `AGENTS.md` links being dead (no link checker in `check.ts`).

## Facts the next ticket may want

- `v0.1.md` is the only spec whose pin (2.1.288) predates `COMPATIBILITY.md`'s current row; `sidebar-icons`/`working-now` say 2.1.292; `live-checks` Part 2 says 2.1.300 (the current pin).
- The "ahead of `MEMORY.md`" banner in `sidebar-icons.md` (12-15) and `working-now.md` (11-12) is stale; `v0.1.md`'s banner (line 3) says "records the earlier state".
- Part 2 of `live-checks.md` carries an instruction to stop and ask if it and a pass report disagree (line 230); the three passes' reports are outside the repo (`~/.claude/projects/-home-a1exk-Projects-claude-tui/live-checks/`).
- `docs/agents/research/skill-tool-attribution.md`, linked by `working-now.md:196`, is on branch `research/skill-tool-attribution`, not on develop.
- Part 1 of `live-checks.md` cites ephemeral inputs (`.scratch/...`, `release/0.5.0` text of `docs/testing/live-checks.md`, `prototype/todo-nudge`) no longer reachable from `develop`.
