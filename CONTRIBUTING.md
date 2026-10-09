# Contributing

## Setup

Use Node 22.18 or newer, which runs `.ts` files without a flag. Run `npm ci`. It installs the Claude Code version ctui is tested against (the exact `@anthropic-ai/claude-code` devDependency) and TypeScript. Install [`typos`](https://github.com/crate-ci/typos) for the spell check; the runner warns and skips it when it's missing.

## Checks

Run `node scripts/check.ts` before each commit. It runs `tsc`, `claude plugin validate ctui --strict` and `validate . --strict`, `claude plugin test ctui`, the consistency checks (Sidebar plugin folders, registry imports and `<id>_enable` keys; themes; versions; the README and `COMPATIBILITY.md` against the pin), the Theme generator's tests in `scripts/themes.test.ts`, a check that `node scripts/themes.ts` would change no Theme and no `docs/configuration.md` table, and `typos`. It exits 1 when `node_modules/.bin/claude` is missing. CI runs the same command.

## Tests

`claude plugin test ctui` runs `ctui/tests/*.test.ts(x)`: unit tests per module, and scenario tests that drive the hooks through real usage with the `claude-code/testing` drivers.

## Live checks

Docking, engine chrome, toast drawing and the fullscreen and main-screen looks need a signed-in terminal. [`docs/testing/live-checks.md`](docs/testing/live-checks.md) lists each as setup, action and expected result, by section. Only a release's pull request runs them: every section, on the pinned version. Every other pull request answers `release pass` in the pull request template. Auto-merge doesn't wait on the answer.

## Pull requests and pin bumps

AGENTS.md sets the Git Flow branches and the commit format. The `MEMORY.md` entry "One pinned Claude Code version" lists the steps for moving to a new Claude Code version.
