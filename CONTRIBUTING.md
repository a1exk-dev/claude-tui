# Contributing

## Setup

Use Node 22.18 or newer, which runs `.ts` files without a flag. Run `npm ci`. It installs the Claude Code version ctui is tested against (the exact `@anthropic-ai/claude-code` devDependency) and TypeScript. Install [`typos`](https://github.com/crate-ci/typos) for the spell check; the runner warns and skips it when it's missing.

`npm ci` also builds node-pty's native binding, because `package.json`'s `allowScripts` allows its build script: the live-check harness loads that binding and nothing else in the repo does. A checkout that only runs `node scripts/check.ts` carries it unused, the gate never starting the harness.

## Checks

Run `node scripts/check.ts` before each commit. It runs `tsc`, `claude plugin validate ctui --strict` and `validate . --strict`, `claude plugin test ctui`, the consistency checks (Sidebar plugin folders, registry imports and `<id>_enable` keys; themes; versions; the README and `COMPATIBILITY.md` against the pin), the Theme generator's tests in `scripts/themes.test.ts`, the cost live check's fixture generator's tests in `scripts/cost-fixture.test.ts`, a check that `node scripts/themes.ts` would change no Theme and no `docs/configuration.md` table, and `typos`. It exits 1 when `node_modules/.bin/claude` is missing. CI runs the same command. The whole run stays under the 2-minute ceiling in the `MEMORY.md` entry "Tests cover real usage"; nothing asserts it, so watch it as the suite grows.

## Tests

`claude plugin test ctui` runs `ctui/tests/*.test.ts(x)`: unit tests per module, and scenario tests that drive the hooks through real usage with the `claude-code/testing` drivers.

## Live checks

Docking, engine chrome, toast drawing, the Themes' paint and the fullscreen and main-screen looks need a signed-in terminal, so an agent drives them against the pinned Claude Code instead of a mock. To run them: switch the session to an inexpensive model — **Sonnet at medium effort**, which is enough because the checks read colors and column ranges off a cell grid and take no judgement — invoke the `live-checks` skill from the repo root, and read the report it prints the path of. [`docs/testing/live-checks.md`](docs/testing/live-checks.md) is the operator's page for starting a run and reading what comes back, including how long one takes.

## Evals

`ctui/evals/` measures whether the task-list nudge's text works, which no test can assert. One run, from the repo root:

    node_modules/.bin/claude plugin eval ./ctui --ablation with-without --scaffold --trust-plugin --no-publish --allow-tools Edit Write 'Bash(node:*)'

That is 18 cheap sessions on `claude-haiku-5-5` — 2 arms × 3 cases × 3 runs — with no judge turn, so the scoring itself costs nothing; the 2026-10-13 run spent $4.47 in about 5 minutes. Without `--trust-plugin` the run stops at the first-run trust prompt; `--no-publish` keeps the report out of claude.ai, under the gitignored `ctui/evals/results/`.

The command exits non-zero whenever a case scores under the threshold, which defaults to 1.0 because the suite passes no `--threshold`. That exit is not the result: the result is the per-case delta between the arms, which the report carries and the pull request pastes. `node scripts/check.ts` never runs it.

## Reports

A release's pull request into `main` pastes both reports whole, a live-check run and an eval run, and a human merges it. An outside contributor's pull request into `develop` pastes both too; the maintainer re-runs either one on doubt. The owner's own pull requests into `develop` are asked for neither — auto-merge waits on `node scripts/check.ts` alone — and answer `N/A`. The template takes a whole report or `N/A`, never a tick per section: a report is atomic, so there is no partial run to claim.

## Pull requests and pin bumps

AGENTS.md sets the Git Flow branches and the commit format. The `MEMORY.md` entry "One pinned Claude Code version" lists the steps for moving to a new Claude Code version.
