# Contributing

## Setup

Use Node 22.18 or newer, which runs `.ts` files without a flag. Run `npm ci`. It installs the Claude Code version ctui is tested against (the exact `@anthropic-ai/claude-code` devDependency) and TypeScript. Install [`typos`](https://github.com/crate-ci/typos) for the spell check; the runner warns and skips it when it's missing.

To run the live-check harness, approve node-pty's build script once per checkout with `npm install-scripts approve node-pty`, then `npm install`. The checks never start the harness, so CI and a checkout that only runs `node scripts/check.ts` skip this step.

## Checks

Run `node scripts/check.ts` before each commit. It runs `tsc`, `claude plugin validate ctui --strict` and `validate . --strict`, `claude plugin test ctui`, the consistency checks (Sidebar plugin folders, registry imports and `<id>_enable` keys; themes; versions; the README and `COMPATIBILITY.md` against the pin), the Theme generator's tests in `scripts/themes.test.ts`, the cost live check's fixture generator's tests in `scripts/cost-fixture.test.ts`, a check that `node scripts/themes.ts` would change no Theme and no `docs/configuration.md` table, and `typos`. It exits 1 when `node_modules/.bin/claude` is missing. CI runs the same command. The whole run stays under the 2-minute ceiling in the `MEMORY.md` entry "Tests cover real usage"; nothing asserts it, so watch it as the suite grows.

## Tests

`claude plugin test ctui` runs `ctui/tests/*.test.ts(x)`: unit tests per module, and scenario tests that drive the hooks through real usage with the `claude-code/testing` drivers.

## Live checks

Docking, engine chrome, toast drawing, the Themes' paint and the fullscreen and main-screen looks need a signed-in terminal, so an agent drives them against the pinned Claude Code instead of a mock. To run them: switch the session to an inexpensive model (Sonnet at medium effort), invoke the `live-checks` skill from the repo root, and read the report it prints the path of. [`docs/testing/live-checks.md`](docs/testing/live-checks.md) covers both steps, and the first run in a checkout needs the node-pty approval under Setup.

## Evals

`ctui/evals/` measures whether the task-list nudge's text works, which no test can assert. One run, from the repo root:

    node_modules/.bin/claude plugin eval ./ctui --ablation with-without --scaffold --allow-tools Edit Write 'Bash(node:*)'

That is 18 cheap sessions on `claude-haiku-5-5` — 2 arms × 3 cases × 3 runs — with no judge turn, so the scoring itself costs nothing. There is no threshold: the delta is read, not enforced. `node scripts/check.ts` never runs it.

## Reports

A release's pull request into `main` pastes both reports whole, a live-check run and an eval run, and a human merges it. An outside contributor's pull request into `develop` pastes both too; the maintainer re-runs either one on doubt. The owner's own pull requests into `develop` are asked for neither — auto-merge waits on `node scripts/check.ts` alone — and answer `N/A`. The template takes a whole report or `N/A`, never a tick per section: a report is atomic, so there is no partial run to claim.

## Pull requests and pin bumps

AGENTS.md sets the Git Flow branches and the commit format. The `MEMORY.md` entry "One pinned Claude Code version" lists the steps for moving to a new Claude Code version.
