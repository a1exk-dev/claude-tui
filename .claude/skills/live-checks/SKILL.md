---
name: live-checks
description: "Run ctui's live checks against the pinned Claude Code and write the report a release pull request attaches."
disable-model-invocation: true
---

# Live checks

31 **checks** over 7 **scenarios**. A scenario is one seeded config dir and one engine boot — the unit that
costs — so every resize, `/theme`, `setopt` and fold happens inside its session. You are the **lead**: run the
gate, spawn one subagent per scenario, merge the rows they return into one report, print its path.

One run spends 7 boots, 5 model turns and about 550 MB of temp churn. The model and effort it runs on, and
which pull request runs it, are the operator's call: `CONTRIBUTING.md` holds both, and the report's version
block records what this run used.

[`harness/HARNESS.md`](harness/HARNESS.md) holds the step vocabulary, the geometry at each dock width, and the
theme facts the checks compare against. Every scenario drives the harness through it, and no check restates it.

## 1. The gate

```bash
node scripts/check.ts
```

Record its result, test count and duration. On a non-zero exit, stop and name what failed: the boots are too
expensive to spend on a checkout that does not pass.

Then collect the version block's facts and the run dir:

```bash
node -p "require('./ctui/.claude-plugin/plugin.json').version"
git rev-parse --short HEAD
node -p "require('./package.json').devDependencies['@anthropic-ai/claude-code']"
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
- Screen dumps stay with the subagent. One scenario's dumps run 60–120 KB and the lead never needs them: the
  evidence a reader wants is already in the `measured` cell.

## 3. Merge and write the report

Group the rows by the prefix of their check ids — the prefix *is* the report section:

| Prefix | Section | Checks |
|---|---|---|
| `docking/` | Sidebar docking | 6 |
| `layout/` | Sidebar layout and scroll | 3 |
| `rewrites/` | Render-site rewrites | 2 |
| `toasts/` | Toasts | 1 |
| `themes/` | Themes | 10 |
| `menu/` | The `/ctui` menu | 2 |
| `todo/` | Todo | 5 |
| `cost/` | Cost | 2 |

Write `$RUN/report.md` in this shape and print its path as the last thing you say:

```markdown
## ctui live checks — PASS (31/31)

plugin ctui 0.5.0 (95e5d10)
engine @anthropic-ai/claude-code 2.1.292
node scripts/check.ts  PASS  332 tests, 41 s
run 2026-10-13T09:14Z  Sonnet, medium effort, 5 model turns
run dir /tmp/ctui-live-checks-7Qa1Zx

### Sidebar docking
| check | expected | measured | |
|---|---|---|---|
| docking/width-42-at-150 | body 42 columns wide at 150 | #262626:108-149, 42 columns | PASS |

### Themes
| check | expected | measured | |
|---|---|---|---|
| themes/hover-underline | engine underlines every hovered cell | u=1 on cols 110-147 | PASS |
```

The heading counts the passes. Under the sections, list each kept config dir as `scenario <name>: <path>` so a
FAIL's config, transcript and settings are still readable at a named path. All 31 rows appear in every report,
whatever the run found: one shape, always complete, is what makes it attachable.

## Driving a scenario

Each subagent owns one scenario end to end:

```bash
CFG=$(node .claude/skills/live-checks/harness/harness.ts seed <scenario> [--settings '<json>'])
S=$RUN/<scenario>; mkdir -p $S; rm -f $S/fifo $S/out
node .claude/skills/live-checks/harness/harness.ts serve $CFG 150 45 $S/fifo $S/out [options] &
printf 'wait 20\ngrep claude cli:\n' | node .claude/skills/live-checks/harness/harness.ts send $S/fifo $S/out 4
```

The `grep` confirms the Sidebar is up before the first check reads it. Then drive the checks in the order below,
a few steps per `send`, reading each batch's output before choosing the next: one boot carries every check of the
scenario. Finish with `printf 'quit\n' | … send $S/fifo $S/out 2`, and `rm -rf "$CFG"` once every row passed.

A step that throws prints `!! …` and leaves the session up, so a mistyped step costs no boot. `pkill -f
'harness.ts serve'` is the fallback when a session will not quit.

## Scenario 1: `default-150` — 8 checks, 1 model turn

Seed a scratch repo in `$S/repo` first — `git init`, a bare repo as `origin` with an upstream branch, one staged,
one modified and one untracked file, one stash — then seed with `--trust $S/repo --mcp` and boot with
`--cwd $S/repo` at 150×45. `--mcp` gives the session the stub server, so the process-tree check reads what the
session does start as well as what it does not.

| Check | Drive | `measured` carries |
|---|---|---|
| `docking/width-42-at-150` | `dumpbg` on a body row | the dock's bg run and its column count (42 at cols 108–149) |
| `docking/width-53-at-170` | `resize 170 45`, `dumpbg` | the run at cols 117–169, 53 columns |
| `docking/close-attempts-ignored` | `resize 150 45`; `grep ✕` for the glyph's cell, `click` it; `key \x18x`; `key \x18\t` then `key \e`; `grep claude cli:` after each | the footer row still present after all three presses |
| `layout/git-glyph-columns` | `grep` the branch row, then `cells <row> 110 114` on the three git rows | each glyph's codepoint at content column 0, its text at column 2, and the `fg` of each |
| `layout/frame-and-footer` | `grep claude cli:`, `runs` the footer rows and the `│` column, at 53 and again at 42 | one footer row at 53 and two at 42, the `│` on every body row at the dock's left edge with the colours its cells carry, no update icon |
| `layout/no-child-processes` | `sh for i in $(seq 10); do pstree -a -p $(pgrep -n -f 'claude --plugin-dir'); sleep 1; done \| sort -u` | the distinct child commands seen over the 10 s: the seeded `ctuistub` server and short `git` runs, and no `claude -p` or `claude mcp list` |
| `rewrites/rule-gutter` | one prompt: a wrapped several-line ask for a reply that ends with a 200-character unbroken token, plus a long `Bash` run; then `dump` | the rightmost text column the prompt panel, the reply and the `$ Bash` row each reach, none of them at 105 or right of it, with the reply's forced token wrapping at 104 and cols 105–106 blank; and, as the control, the rightmost column the prompt box's own border rule reaches, which ctui does not pad |
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

## Scenario 4: `themes` — 11 checks

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
| `themes/hover-underline` | the hovered `runs`/`cells` from the row above | `u=1` on every hovered cell. Engine-pinned, not a ctui defect: see MEMORY.md, "Engine-pinned expectations hold only on the pinned Claude Code version" |
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

## Scenario 6: `todo` — 5 checks, 2 model turns

Task tools are on by default and the default model stays. These two turns always run: no skip flag, so every
report is the same shape. Ask each one explicitly — `plan three steps with your task tools and work through them`
— and drive the four docked checks while the first turn is still working.

| Check | Drive | `measured` carries |
|---|---|---|
| `todo/own-list-hidden` | boot at 150×45, turn 1, then `grep ctrl+t`, `dump`; `key \x14`, `dump` | no list under the spinner, the footer reading `ctrl+t to show tasks`, and Claude Code's own list after ctrl+t |
| `todo/spinner-animates` | `anim 2 0.3 <the in-progress task's text>` | the in-progress cell's glyph in each of the two samples, ~300 ms apart |
| `todo/spinner-focused` | `key \x18\t`, then `anim 2 0.3 <the same text>` | the glyph differing across the samples while the Sidebar holds the engine-granted focus |
| `todo/glyph-columns` | `grep` a completed task's text for its row, then `cells <row> 110 116` over that row | the `checkbox_marked_circle` codepoint at content column 0, its `fg`, the two gap cells, and the task's first text cell at content column 3 |
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
