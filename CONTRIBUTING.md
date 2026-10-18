# Contributing

## Setup

Use Node 22.18 or newer, which runs `.ts` files without a flag. Run `npm ci`. It installs the Claude Code version ctui is tested against (the exact `@anthropic-ai/claude-code` devDependency), TypeScript and [cspell](https://cspell.org/) for the spell check.

`npm ci` also builds node-pty's native binding, because `package.json`'s `allowScripts` allows its build script: the live-check harness loads that binding and nothing else in the repo does. A checkout that only runs `node scripts/check.ts` carries it unused, the gate never starting the harness.

## Checks

Run `node scripts/check.ts` before each commit. It runs `tsc` (against the pin's types and, for ctui's production code, the support floor's), `claude plugin validate ctui` and `validate .` (failing on any error or warning but the missing `version`, since no file stores ctui's version), `claude plugin test ctui`, the consistency checks (Sidebar plugin folders, registry imports and `<id>_enable` keys; themes; both READMEs, `ctui/hooks/floor.ts` and the floor types against the pin and the floor; the root README's `/plugin` lines against `ctui/README.md`'s), the Theme generator's tests in `scripts/themes.test.ts`, the cost live check's fixture generator's tests in `scripts/cost-fixture.test.ts`, the release version's tests in `scripts/release-version.test.ts`, the back-merge's tests in `scripts/back-merge.test.ts`, a check that `node scripts/themes.ts` would change no Theme and no `docs/configuration.md` table, and `cspell`. A word it flags that is spelled right, such as a new name, goes in `cspell.json`'s `words`. It exits 1 when `node_modules/.bin/claude` or `cspell` is missing. CI runs the same command. The whole run stays under the 2-minute ceiling in the `MEMORY.md` entry "Tests cover real usage"; nothing asserts it, so watch it as the suite grows.

## Tests

`claude plugin test ctui` runs `ctui/tests/*.test.ts(x)`: unit tests per module, and scenario tests that drive the hooks through real usage with the `claude-code/testing` drivers.

## Live checks

Docking, engine chrome, toast drawing, the Themes' paint and the fullscreen and main-screen looks need a signed-in terminal, so an agent drives them against the pinned Claude Code instead of a mock. To run them: switch the session to an inexpensive model — **Sonnet at medium effort**, which is enough because the checks read colors and column ranges off a cell grid and take no judgement — invoke the `live-checks` skill from the repo root, and read the report it prints the path of. [`docs/testing/live-checks.md`](docs/testing/live-checks.md) is the operator's page for starting a run and reading what comes back, including how long one takes.

A session that stays on its own model starts the same pass in a subshell instead, which runs on Sonnet at medium effort without switching the starting session's model, so an operator or an agent session on any model launches a whole pass. From the repo root:

```bash
RUN=$(mktemp -d -t ctui-live-checks-XXXXXX)
npx claude -p "/live-checks The run dir is already made for you: RUN=$RUN" \
  --model sonnet --effort medium \
  --allowed-tools "Bash Read Write" --strict-mcp-config \
  --output-format json
```

Launch it in the background, so the starting session keeps working through the ~20 minutes. `-p "/live-checks …"` is a user invocation of the skill, so its `disable-model-invocation: true` does not block it. `--model` and `--effort` reach all seven scenario subagents, so the subshell's model is the whole pass's model. `--allowed-tools "Bash Read Write"` is the grant the harness needs: every seeded config dir, `$RUN` and scratch repo lives under `$TMPDIR`, outside the working directory, and `Agent` needs no entry. `--strict-mcp-config` drops the operator's own MCP servers, which nothing in a pass calls. `--output-format json` is the only place the dollar cost and `permission_denials` exist. `RUN=` is minted by the caller, so the report path is known before anything launches. `--allowed-tools` is variadic: a prompt placed immediately after it is swallowed as a tool name and the run dies with `Input must be provided either through stdin or as a prompt argument when using --print`. Keep another flag between them, or send the prompt on stdin.

Both cheaper axes were measured on 2.1.300 and rejected, so nobody has to run them again. **haiku at medium effort** misses the bar: `FAIL 35/38` at $0.39, with `themes/dock-tint` and `menu/dock-pane-colors` flipped to a wrong drive (the second read `/theme`'s New custom theme form in place of the `/ctui` menu's field row, confidently). It reads a cell grid accurately and fails at driving a scenario into the state a row asks about. **Sonnet at low effort** flips no row, `FAIL 37/38` at $2.20, and still loses on self-report: its lead recorded the gate as `PASS 10 tests` where `node scripts/check.ts` runs 360, and returned two PASS rows with no evidence in the `measured` cell. Medium effort, `FAIL 37/38` at $2.82, is the baseline. A pass that cannot run on Sonnet at medium effort does not run.

The starting session then does these steps, in order, when the subshell returns:

1. Read `permission_denials` first, before a single row. A non-empty array means the pass is **void**, not a pass with FAIL rows in it, because a denial stops a step rather than measuring a cell. Name the denied tool and its full `tool_input`, and start over. All three passes came back empty, so the grant is known to cover a whole pass; a denial means the list or the harness moved.
2. The exit status proves nothing: a denied pass still exits `subtype: "success"`, `is_error: false`, and a denial surfaces only as an `is_error=true` tool row inside the subshell's own output and as an entry in that array.
3. Read `.result` for the lead's last line (the verdict, the tally and the path) as a cross-check that the lead wrote where it was told.
4. Fill the version block's two holes in `$RUN/report.md`: `cost` from the result JSON's `total_cost_usd`, and `wall` from your own timing. The lead can measure neither and writes both as `—`.
5. Never write a turn count. `num_turns` counts the lead's own turns, not the pass's, and no result-JSON field is the pass's turn count.
6. Name each `FAIL` with its measured cell, so the human reads what the screen showed rather than a tally.
7. Ask before writing anything into a pull request. On the operator's word and not before, paste the whole report, with the version block filled, into the release pull request's `## Reports` › `### Live checks` section, the one into `main`.

## Evals

`ctui/evals/` measures whether the task-list nudge's text works, which no test can assert. One run, from the repo root:

    node_modules/.bin/claude plugin eval ./ctui --ablation with-without --scaffold --trust-plugin --no-publish --allow-tools Edit Write 'Bash(node:*)'

That is 18 cheap sessions on `claude-haiku-5-5` — 2 arms × 3 cases × 3 runs — with no judge turn, so the scoring itself costs nothing; the 2026-10-13 run spent $4.47 in about 5 minutes. Without `--trust-plugin` the run stops at the first-run trust prompt; `--no-publish` keeps the report out of claude.ai, under the gitignored `ctui/evals/results/`.

The command exits non-zero whenever a case scores under the threshold, which defaults to 1.0 because the suite passes no `--threshold`. That exit is not the result: the result is the per-case delta between the arms, which the report carries and the pull request pastes. `node scripts/check.ts` never runs it.

## Reports

A release's pull request into `main` pastes both reports whole, a live-check run and an eval run, and a human merges it. An outside contributor's pull request into `develop` pastes both too; the maintainer re-runs either one on doubt. The owner's own pull requests into `develop` are asked for neither — auto-merge waits on `node scripts/check.ts` alone — and answer `N/A`. The template takes a whole report or `N/A`, never a tick per section: a report is atomic, so there is no partial run to claim.

## Pull requests and pin bumps

AGENTS.md sets the Git Flow branches and the commit format. The `MEMORY.md` entry "Support floor, no ceiling; the pin is the tested version only" lists the steps for moving the pin or the floor.
