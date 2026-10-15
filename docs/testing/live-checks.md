# Live checks

Checks that mocks can't reach: docking, engine chrome, toast drawing, the Themes' paint, the Todo spinner and a busy MCP row's sweep, a folded section's fold line holding still while the rows under it sweep, the column a Sidebar row's text lands in once the terminal has drawn its Nerd Font glyph two cells wide, and the fullscreen and main-screen looks. An agent drives them against a real, signed-in Claude Code on the pinned version (`@anthropic-ai/claude-code` in the root `package.json`) through the pty harness in `.claude/skills/live-checks/`, which is where the scenarios, the checks and the report's shape live. `CONTEXT.md` defines the term; this page is the operator's, for starting a run and reading what comes back. `CONTRIBUTING.md` says which pull request runs one.

## Running them

A run boots the engine once per scenario, spends a few model turns and takes 20–40 minutes, so it runs once, on the pull request a human merges.

1. Switch the session to an inexpensive model. `CONTRIBUTING.md`'s `Live checks` names the model and effort, and why they are enough.
2. From the repo root, invoke the `live-checks` skill.
3. It runs `node scripts/check.ts` first and stops on a non-zero exit: the boots are too expensive to spend on a checkout that doesn't pass. Then it boots the scenarios concurrently, one subagent each, and merges their rows.
4. It prints the path of the report it wrote. Paste that report whole into the pull request.

Nothing signed-in is ever written into the repo: each scenario seeds its own `CLAUDE_CONFIG_DIR` under `$TMPDIR` and deletes it on a pass.

## Reading the report

One Markdown file, always the same shape: a heading counting the passes against the total, a version block, then a table per section with one row per check.

- Every check comes back in every report, whatever the run found. A report missing rows is a broken run, not a partial one.
- The version block names the plugin version and commit, the engine pin, the `node scripts/check.ts` result, and the model, effort and model turns the run spent. A pin that isn't `package.json`'s pin measured a different engine, so the report doesn't apply to this one.
- Each row's `measured` cell carries the evidence — the cell color, the column range, the glyph, the milliseconds — so a PASS states what it saw and you can audit it instead of trusting it. An empty `measured` cell means the row is unfinished.
- A FAIL's `measured` cell says what the screen showed instead, and its scenario's config dir is listed under the sections at a named path, left on disk with its transcript and settings.
- Three checks assert Claude Code's own behaviour rather than ctui's, the `fold-line-still` checks that hold the engine drawing no nested `Client`: no ctui change can regress one and a FAIL there means the engine moved. `MEMORY.md`, "Engine-pinned expectations hold only on the pinned Claude Code version", holds that class and every member.

## What ctui promises

Over a cost store of 800 transcripts and 381 MiB with every file's page cache dropped, the Limits `cost` row arrives **within 2 s** of the session start. That is the number ctui promises a user, and it is the one to read the report against: `cost/cold-cache-arrival` gates at 3 s and reports the milliseconds it measured either way, so a passing 2.6 s is the promise slipping. On 2.1.292 the 2026-10-12 baseline was 1.5 s, of which the grep was 0.4 s and the store writes the rest.
