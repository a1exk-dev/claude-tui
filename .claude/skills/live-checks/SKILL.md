---
name: live-checks
description: "Run ctui's live checks against the pinned Claude Code and write the report a release pull request attaches."
disable-model-invocation: true
---

# Live checks

37 **checks** over 7 **scenarios**. A scenario is one seeded config dir and one engine boot — the unit that
costs — so every resize, `/theme`, `setopt` and fold happens inside its session. You are the **lead**: run the
gate, spawn one subagent per scenario, merge the rows they return into one report, print its path.

One run spends 7 boots, 10 model turns (a floor, not an estimate: a pass has spent 14) and about 550 MB of
temp churn. The model and effort it runs on, and which pull request runs it, are the operator's call:
`CONTRIBUTING.md` holds both, and the report's version block records what this run used.

[`harness/HARNESS.md`](harness/HARNESS.md) holds the step vocabulary, the geometry at each dock width, and the
theme facts the checks compare against. Every scenario drives the harness through it, and no check restates it.

## 1. The gate

```bash
node scripts/check.ts
```

The gate prints one summary line. Copy that line's verdict, test count and duration into the version block, not a
figure from the output above it: the suite runs several hundred tests, so a count in the tens means you copied
a tail. Run it every time, including when the session that launched you just did, so the block records a result
measured at the commit about to be checked. On a non-zero exit, stop and name what failed: the boots are too
expensive to spend on a checkout that does not pass.

Then collect the version block's facts:

```bash
git describe --tags
node -p "require('./package.json').devDependencies['@anthropic-ai/claude-code']"
```

`$RUN` is the run dir. Use the one your invocation named (`RUN=<path>`); only when it named none, mint one:

```bash
RUN=$(mktemp -d -t ctui-live-checks-XXXXXX)
```

Each scenario gets `$RUN/<scenario>/` for its fifo, its output file and its scratch repo; the report lands at
`$RUN/report.md`.

## 2. Spawn the seven

Seven subagents in **one message**, so the boots run concurrently. Give each one:

- its scenario number and name, and `$RUN`,
- `read .claude/skills/live-checks/SKILL.md § "Driving a scenario" and § "Scenario <n>", and harness/HARNESS.md`,
- the row contract below, quoted in full.

### The row contract

A subagent returns **only finished rows**, one per check id, and nothing else:

```
| docking/width-42-at-150 | body 42 columns wide at 150 | #262626:108-149, 42 columns | PASS |
```

- The `measured` cell carries the evidence — the cell color, the column range, the glyph, the ms — so a reviewer
  audits a PASS instead of trusting it. A row with no evidence in that cell is not finished.
- A check the session could not reach is a `FAIL` row whose `measured` cell says what the screen showed instead.
- Every check id of the scenario comes back, in the order this file lists them.
- When any row failed, add one last line `kept: <config dir path>` and leave that dir on disk.
- **No row asserts a frame rate.** A moving glyph is sampled for change and a still one for sameness; the
  interval between two samples is the step's, never an expectation the screen has to meet.
- Screen dumps stay with the subagent. One scenario's dumps run 60–120 KB and the lead never needs them: the
  evidence a reader wants is already in the `measured` cell.

## 3. Merge and write the report

Group the rows by the prefix of their check ids — the prefix *is* the report section:

| Prefix | Section | Checks |
|---|---|---|
| `docking/` | Sidebar docking | 6 |
| `layout/` | Sidebar layout and scroll | 3 |
| `mcp/` | MCP | 3 |
| `rewrites/` | Render-site rewrites | 2 |
| `toasts/` | Toasts | 1 |
| `themes/` | Themes | 9 |
| `menu/` | The `/ctui` menu | 2 |
| `skills/` | Skills | 1 |
| `todo/` | Todo | 6 |
| `agents/` | Agents & shells | 2 |
| `cost/` | Cost | 2 |

Write `$RUN/report.md` in this shape and print its path as the last thing you say:

```markdown
## ctui live checks — PASS (37/37)

plugin ctui v0.6.0-12-gda270ab
engine @anthropic-ai/claude-code 2.1.300
node scripts/check.ts  PASS  360 tests, 9 s
run 2026-10-15T09:14Z  Sonnet, medium effort
cost —  wall —
run dir /tmp/ctui-live-checks-7Qa1Zx

### Sidebar docking
| check | expected | measured | |
|---|---|---|---|
| docking/width-42-at-150 | body 42 columns wide at 150 | #262626:108-149, 42 columns | PASS |

### Themes
| check | expected | measured | |
|---|---|---|---|
| themes/hover-colors | arrow and title in `suggestion` on hover | suggestion on cols 110-147 | PASS |
```

Write `cost` and `wall` as `—`: you can measure neither, since the cost lives in the result your caller reads and
the wall clock is the caller's timing. The caller fills them; in an operator's own run the dashes stay and say
nobody measured them. The `run` line's model and effort are the ones your invocation named, else your own
session's. The block carries no turn count: `num_turns` counts only your own turns and no result field carries
the pass's, so write none.

The heading counts the passes. Under the sections, list each kept config dir as `scenario <name>: <path>` so a
FAIL's config, transcript and settings are still readable at a named path. All 37 rows appear in every report,
whatever the run found: one shape, always complete, is what makes it attachable.

## Driving a scenario

Each subagent owns one scenario end to end:

```bash
CFG=$(node .claude/skills/live-checks/harness/harness.ts seed <scenario> [--settings '<json>'])
S=$RUN/<scenario>; mkdir -p $S; rm -f $S/fifo $S/out
node .claude/skills/live-checks/harness/harness.ts serve $CFG 150 45 $S/fifo $S/out [options] &
echo $! > $S/pid
printf 'wait 20\ngrep claude cli:\n' | node .claude/skills/live-checks/harness/harness.ts send $S/fifo $S/out 4
```

The `grep` confirms the Sidebar is up before the first check reads it. Then drive the checks in the order below,
a few steps per `send`, reading each batch's output before choosing the next: one boot carries every check of the
scenario. Finish with `printf 'quit\n' | … send $S/fifo $S/out 2`, and `rm -rf "$CFG"` once every row passed.

A step that throws prints `!! …` and leaves the session up, so a mistyped step costs no boot. When a session
will not quit, kill only your own: start `serve` with `&` and write its pid to `$S/pid` in the same call, as above (a shell variable does not survive from one Bash call to the next), then `kill $(cat $S/pid)`.
The pattern `pkill -f 'harness.ts serve'` matches every concurrent scenario's serve, so it is the one way a
scenario costs another its boot.

## Scenario 1: `default-150` — 14 checks, 5 model turns

Seed a scratch repo in `$S/repo` first — `git init`, a bare repo as `origin` with an upstream branch, one staged,
one modified and one untracked file, one stash, and a project skill at `$S/repo/.claude/skills/ctuicheck/SKILL.md`
whose body is `Reply with ok and nothing else.` — then seed with `--trust $S/repo --mcp` and boot with
`--cwd $S/repo` at 150×45. That skill is the one the Skills section draws a row for, and its turn is the
cheapest in the run. `--mcp` gives the session the stub server, so the process-tree check reads what the
session does start as well as what it does not. Seed `--settings
'{"permissions":{"allow":["mcp__ctuistub"]}}'` too: without it the stub's tool waits on a permission prompt
and no call ever crosses the wire for `mcp/busy-animates` to read.

At 150×45 the sections window ends at Skills, so **MCP and Agents start below it**, under `↓ more`. Scroll
them into view with three `wheel 120 20 down` notches before the first check that reads either section, and
`grep` the title row again after any fold: folding a section lifts the rows under it, so the cell that folded
it is not the cell that unfolds it.

| Check | Drive | `measured` carries |
|---|---|---|
| `docking/width-42-at-150` | `dumpbg` on a body row | the dock's bg run and its column count (42 at cols 108–149) |
| `docking/width-53-at-170` | `resize 170 45`, `dumpbg` | the run at cols 117–169, 53 columns |
| `docking/close-attempts-ignored` | `resize 150 45`; `grep ✕` for the glyph's cell, `click` it; `key \x18x`; `key \x18\t` then `key \e`; `grep claude cli:` after each | the footer row still present after all three presses |
| `layout/git-glyph-columns` | `grep` the branch row, then `cells <row> 110 114` on the three git rows | each glyph's codepoint at content column 0, its text at column 2, and the `fg` of each |
| `mcp/glyph-columns` | `grep` the stub server's label for its row, then `cells <row> 112 118` over that row | the `check_circle_outline` codepoint at content column 0, its `fg`, the two gap cells, and the label's first text cell at content column 3 |
| `mcp/busy-animates` | one prompt asking Claude to call the `ctuistub_tool_1` tool; `watch 30 ctuistub_tool_1`, then `anim 2 0.3 ctuistub` while the stub holds the call | the `ctuistub` row's glyph in each of the two samples, ~300 ms apart. The stub answers a call after 10 s (HARNESS.md), so the row is busy for both; the check asserts the glyph differs, never which frame |
| `mcp/fold-line-still` | `grep MCP:` for the title row in an earlier send; then, in the same send as `mcp/busy-animates` and while the stub still holds the call, `click 113 <that row>` to fold, `anim 2 0.3 MCP:`, then `grep MCP:` again and click that row to unfold | the folded `MCP:` row's busy term in each of its two samples, **identical**, beside the `ctuistub` row's glyph in the two samples above, which **differ** — the still fold line and the moving row are one fact seen twice. This is `no-nested-client` on the screen (MEMORY.md, "Engine-pinned expectations hold only on the pinned Claude Code version"): the title row is one `Client` carrying its tally as plain data, so the busy term holds a frozen frame while the row under it sweeps. A call that ended before the second folded sample is a FAIL naming what the row showed |
| `agents/glyph-columns` | one prompt asking Claude to start a background Explore agent that lists the folder; `watch 30 Agents`, `grep` the agent's own row, then `cells <row> 112 118` over it | the `circle_slice` codepoint at content column 0 (or `checkbox_marked_circle` once the agent has ended), its `fg`, the two gap cells, and the agent's name at content column 3 |
| `agents/fold-line-still` | one prompt asking Claude to run `sleep 600` with Bash in the background and not wait; `watch 60 1 running`, `grep shells:` for the title row and `grep shell ·` for the row itself, then `anim 2 0.3 shell · `, `click 113 <the title row>` to fold, `anim 2 0.3 shells:`, then `grep shells:` again and click that row to unfold | the folded `Agents & shells:` row's in-progress term in each of its two samples, **identical**, beside the shell row's own glyph in its two samples, which **differ**. Same fact, same expectation: `no-nested-client` (MEMORY.md) means a fold line's term cannot animate, so a running tally sits frozen above a sweeping row. A background shell, not the Explore agent above: that agent ends in about 3 s and its row is then dropped, leaving nothing to sample, while a shell holds the section in progress for as long as its command runs. The shell is the same state, not a stand-in for one: a running row sweeps whatever its kind (MEMORY.md, "Agent and shell events go to toasts, the live list goes to the sidebar"). A row that ended before the second folded sample is a FAIL naming what the row showed |
| `layout/frame-and-footer` | `grep claude cli:`, `runs` the footer rows and the `│` column, at 53 and again at 42 | one footer row at 53 and two at 42, the `│` on every body row at the dock's left edge with the colours its cells carry, no update icon |
| `layout/no-child-processes` | `sh for i in $(seq 10); do pstree -a -p $(pgrep -n -f 'claude --plugin-dir'); sleep 1; done \| sort -u` | the distinct child commands seen over the 10 s: the seeded `ctuistub` server and short `git` runs, and no `claude -p` or `claude mcp list` |
| `rewrites/rule-gutter` | one prompt: a wrapped several-line ask for a reply that ends with a 200-character unbroken token, plus a long `Bash` run; then `dump` | the rightmost text column the prompt panel, the reply and the `$ Bash` row each reach, none of them at 105 or right of it, with the reply's forced token wrapping at 104 and cols 105–106 blank; and, as the control, the rightmost column the prompt box's own border rule reaches, which ctui does not pad |
| `skills/glyph-columns` | `type /ctuicheck`, `enter`, `wait 10`; `grep ctuicheck` for its Skills row, then `cells <row> 112 118` over that row | the `asterisk_circle_outline` codepoint (U+F1A27) at content column 0, its `fg`, the two gap cells, and the skill name's first text cell at content column 3 |
| `rewrites/ctrl-o-transcript` | `key \x0f`, `dump`, `key \x0f`, `dump` | the rows both views show, and each call carrying its full result under it |

## Scenario 2: `fresh-110` — 2 checks, 1 model turn, two launches

Seed fresh (no `pluginPanes` entry) and boot at 110×45.

| Check | Drive | `measured` carries |
|---|---|---|
| `docking/fresh-110-prompt-docks` | `dump` at rest, then `type hi`, `enter`, `wait 8`, `grep claude cli:` | no Sidebar row before the prompt, the footer row after it |
| `docking/fresh-110-next-session-docks` | `quit`; `sh jq .pluginPanes "$CFG/.claude.json"`; boot the **same** `CFG` again at 110×45 and `grep claude cli:` before any prompt | the persisted `asked` entry, and the footer row at start of the second launch |

## Scenario 3: `dock-columns` — 1 check

The engine writes a dragged or keyed dock width into `.claude.json`. Read the key's exact path from the
operator's own file (`jq '.pluginPanes' ~/.claude.json`) and seed it with `--claude-json` at a width that is
neither 42 nor 53 (70). When that file has no such key, boot without it, key the dock wider inside the session,
and read back what the engine wrote into `$CFG/.claude.json`.

| Check | Drive | `measured` carries |
|---|---|---|
| `docking/dock-columns-override` | boot at 150×45, `dumpbg` a body row | the dock's column range under the override, against the 42 the Sidebar asks for at that width |

## Scenario 4: `themes` — 10 checks

Seed default (`theme: dark`) and boot at 150×45. `setopt theme=<slug>` picks a ctui Theme, `/theme` picks the
engine's. The seed writes `$CFG/themes/fixture.json` from `harness/fixtures/theme.json`, which `/theme` lists as
`Live Check Fixture` and ctui reads as `custom:fixture`. **Never read a theme out of the operator's home and
never run `omarchy theme set`** — nothing here assumes the operator's desktop, and the harness leaves it alone.

| Check | Drive | `measured` carries |
|---|---|---|
| `themes/glass-flat` | `setopt theme="everforest"`; `dumpbg`; `wheel` a body row, fold a section, `resize 170 45`, `resize 150 45`, rewrite `$CFG/themes/fixture.json` with `sh`; `dumpbg` after each | one flat `#363d41` over every body cell including the padding, at each step, with no second run |
| `themes/glass-frame` | the same session on `dark`: `cells` the rule column, the `✕` row and the row below; then pick `Everforest` in `/theme` and read them again | the dock color on all three while a frame shows, then `#363d41` on all three |
| `themes/latte-body` | `setopt theme="catppuccin-latte"` on `dark`, then `/theme` → `Catppuccin Latte`; `dumpbg` and the frame cells each time | `#e5e7ed` on the body both times, the frame differing then matching |
| `themes/inherit-no-paint` | `setopt theme="inherit"` with `/theme` on `dark`; `dumpbg` the body and the frame | the same color on body and frame |
| `themes/omarchy-mix` | `/theme` → `Live Check Fixture` under `inherit`; `dumpbg` | the body's flat color against the fixture's `inverseText` `#2d353b` mixed 6% toward its `text` `#d3c6aa`, which is `#373e42`. The id keeps its name because the rule exists for Omarchy's template, which writes a theme's background to `inverseText` |
| `themes/hover-colors` | `setopt theme="flexoki-light"`; `move` onto a title row's blank middle, `runs` that row; `move` off the Sidebar, `runs` again | the arrow, title and `:` in `suggestion` on the row; `inactive` and bold `text` off it |
| `themes/focus-arrows` | `key \x18\t`, `runs` an arrow row; `key \t`; `key \r`; `key \e`, `runs` again | the arrows in the `/theme`'s grey while focused, the first inverted after Tab, its section folded after Enter, `#706e69` after Esc |
| `themes/theme-list-from-ctui` | `type /theme`, `wait 2`, `dump` (scroll the list) | the 22 ctui Themes A–Z from `Catppuccin` to `White`, each tagged `from ctui`. The seeded `Live Check Fixture` is a custom theme, not one of the 22 |
| `themes/dock-tint` | pick `Everforest`, then `Catppuccin Latte` in `/theme`; `dumpbg` the whole screen each time | the transcript and dock recolored in one step, the dock one flat `#363d41` then `#e5e7ed` |
| `menu/dock-pane-colors` | `type /ctui`, `enter`; `runs` the breadcrumb, a label, a value, the footer and a field row, at 53 and again at 42 | ctui's own text in the Sidebar's colors, and the engine's `›`, placeholder, typed text and `⏎ submit` in the `/theme`'s |

## Scenario 5: `main-screen` — 2 checks, 1 model turn

Boot at 200×45 with `-- --settings '{"tui":"default"}'`.

| Check | Drive | `measured` carries |
|---|---|---|
| `toasts/main-screen-prefix` | one prompt asking Claude to start a background Explore agent that lists the folder; `watch 30 ctui:`, `runs` that row | the toast text as `ctui: ◆ Explore started: …` and its start column against the line under the prompt |
| `menu/frame-fits-content` | `resize 120 45`; `type /ctui`, `enter`; open each screen with `key` and `dump` | the body's column span against the frame, and the `─` and footer rows sitting directly under each screen's last content row |

## Scenario 6: `todo` — 6 checks, 3 model turns

Task tools are on by default and the default model stays. These three turns always run: no skip flag, so every
report is the same shape. Ask the first explicitly — `plan three steps with your task tools and work through them`
— and drive the four docked checks while it is still working.

The three motion checks need an item **held** in progress, and that first turn does not give them one: it
marks a step done and the next one in progress in separate calls, so the list reads all-pending between
steps and runs 0/3 to 3/3 in seconds. Spend a turn of its own on the hold — `create three new tasks, mark
the second one in progress, then run "timeout 60 tail -f /dev/null" with Bash in the foreground and wait for
it` — which parks one sweeping row for 60 s, longer than any hold the scenario takes (the longest sample pair
is ~36 s in). The engine refuses a standalone foreground `sleep`, so the hold is never a bare `sleep`. Check the
hold took before sampling: look at the `timeout 60 tail -f /dev/null` Bash row, which reads `interrupted` and
ends the turn in seconds when the hold was refused, instead of parking a sweeping row. On seeing that, re-drive
the same turn. Drive `todo/spinner-animates`, `todo/fold-line-still` and `todo/spinner-focused` inside that window.

| Check | Drive | `measured` carries |
|---|---|---|
| `todo/own-list-hidden` | boot at 150×45, turn 1, then `grep ctrl+t`, `dump`; `key \x14`, `dump` | no list under the spinner, the footer reading `ctrl+t to show tasks`, and Claude Code's own list after ctrl+t |
| `todo/spinner-animates` | `anim 2 0.3 <the in-progress task's text>` | the in-progress cell's glyph in each of the two samples, ~300 ms apart |
| `todo/fold-line-still` | `grep Todo:` for the title row, then, inside the hold above, `click 113 <that row>` to fold, `anim 2 0.3 Todo:`, and click that row again to unfold before the next check | the folded `Todo:` row's in-progress term in each of its two samples, **identical**, beside the in-progress cell's glyph in the two samples above, which **differ**. `no-nested-client` (MEMORY.md) is what holds the fold line still: the title row is one `Client` and its tally crosses as plain data, so the term is frozen while the item below it sweeps. A turn that finished its list before the second folded sample is a FAIL naming what the row showed |
| `todo/spinner-focused` | `key \x18\t`, then `anim 2 0.3 <the same text>` | the glyph differing across the samples while the Sidebar holds the engine-granted focus |
| `todo/glyph-columns` | `grep` a completed task's text for its row, then `cells <row> 112 118` over that row | the `checkbox_marked_circle` codepoint at content column 0, its `fg`, the two gap cells, and the task's first text cell at content column 3 |
| `todo/no-dock-100-cols` | `resize 100 45`, turn 2, then `grep ctrl+t`, `dump` | Claude Code's list drawn under the spinner and the footer reading `ctrl+t to hide tasks` |

## Scenario 7: `cost-cold-cache` — 2 checks

The arrival is timed from the session's own start, so this scenario is the one that drives `once` rather than a
fifo: its steps are known before the boot. Seed `limits_cost: "on"`, generate the fixture, drop its page cache,
then run the steps file — and send no prompt, so the live session adds 0 to the total.

```bash
CFG=$(node .claude/skills/live-checks/harness/harness.ts seed cost-cold-cache \
  --settings '{"pluginConfigs":{"ctui@inline":{"options":{"limits_cost":"on"}}}}')
node scripts/cost-fixture.ts "$CFG/projects/fixture"          # prints the expected month total
for f in "$CFG"/projects/fixture/*; do dd if="$f" iflag=nocache count=0; done   # no root
printf 'watch 10 cost\ngrep $ of\nquit\n' > $S/steps
node .claude/skills/live-checks/harness/harness.ts once $CFG 150 45 $S/steps
```

The fixture is 800 transcripts and 381 MiB, so keep ~400 MB free and `rm -rf "$CFG"` once both rows pass.

| Check | Drive | `measured` carries |
|---|---|---|
| `cost/cold-cache-total` | the `grep` above, against the generator's printed total | the `cost` row's total and the printed one |
| `cost/cold-cache-arrival` | the `watch` above | the ms it reports, passing under 3 s and reported whichever way it goes. The 2026-10-12 baseline on this pin was 1.5 s, of which the grep was 0.4 s |
