// Repo checks. Run locally and in CI: `node scripts/check.ts`.
// Node strips the types, so there is no build step.
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FLOOR as floor } from '../ctui/hooks/floor.ts'
import { ICON, png } from './icon.ts'
import { outputs } from './themes.ts'

process.chdir(join(dirname(fileURLToPath(import.meta.url)), '..'))

let failed = false
const error = (message: string) => {
  console.error(`error: ${message}`)
  failed = true
}
const json = (path: string) => JSON.parse(readFileSync(path, 'utf8'))
const words = (items: Iterable<string>) => [...items].sort().join(' ')
const same = (what: string, a: string, b: string) => {
  if (a !== b) error(`${what} differ: [${a}] vs [${b}]`)
}
const run = (command: string, args: string[]) => {
  if (spawnSync(command, args, { stdio: 'inherit' }).status !== 0) error(`${command} ${args.join(' ')} failed`)
}
const subfolders = (dir: string) =>
  readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)

const tsc = 'node_modules/.bin/tsc'
const claude = 'node_modules/.bin/claude'
const cspell = 'node_modules/.bin/cspell'
if (![tsc, claude, cspell].every(existsSync)) {
  console.error('error: tsc, claude or cspell is not installed, run npm ci')
  process.exit(1)
}

// validate misses unbound tags in imported Sidebar plugin views; tsc catches them.
// Two projects: ctui runs in the engine with no Node globals, the live-check harness runs on Node.
run(tsc, ['-p', '.'])
run(tsc, ['-p', '.claude/skills/live-checks/harness'])
// ctui's production code against the support floor's types: a change that needs a newer engine fails here.
run(tsc, ['-p', 'tsconfig.floor.json'])
// Strict, but for the one warning ctui means: no file stores its version (scripts/release-version.ts).
type Issue = { path: string; message: string }
type Report = { errors: Issue[]; warnings: Issue[] }
const noVersion = ({ path, message }: Issue) => /(^|→ )version$/.test(path) && message.startsWith('No version specified')
const validate = (dir: string) => {
  const { status, stdout, stderr } = spawnSync(claude, ['plugin', 'validate', dir, '--json'], { encoding: 'utf8' })
  process.stderr.write(stderr)
  let reports: Report[] = []
  try {
    const result: { manifest: Report; contents: Report[] } = JSON.parse(stdout)
    reports = [result.manifest, ...result.contents]
  } catch {
    process.stdout.write(stdout)
  }
  const issues = reports.flatMap((report) => [...report.errors, ...report.warnings.filter((warning) => !noVersion(warning))])
  for (const { path, message } of issues) console.error(`${dir}: ${path}: ${message}`)
  if (status !== 0 || reports.length === 0 || issues.length > 0) error(`claude plugin validate ${dir} failed, or warned of more than a missing version`)
}
validate('ctui')
validate('.')
run(claude, ['plugin', 'test', 'ctui'])

// Registry consistency.
const manifestPath = 'ctui/.claude-plugin/plugin.json'
const manifest = json(manifestPath)
const folders = words(subfolders('ctui/plugins'))
const imports = words(
  [...readFileSync('ctui/plugins/index.ts', 'utf8').matchAll(/^import [a-z]+ from '\.\/([a-z]+)'$/gm)].map((m) => m[1]!),
)
const keys = words(
  Object.keys(manifest.userConfig)
    .filter((key) => key.endsWith('_enable'))
    .map((key) => key.replace(/_enable$/, '')),
)
same('Sidebar plugin folders and ctui/plugins/index.ts imports', folders, imports)
// The git header and versions footer are always on: every other plugin is a section with an `<id>_enable` key.
const FIXED = ['git', 'versions']
same(
  'Sidebar section folders (all but git and versions) and <id>_enable keys',
  words(folders.split(' ').filter((id) => !FIXED.includes(id))),
  keys,
)
// The `theme` options: `inherit`, then every Theme file's slug A–Z.
const themes = readdirSync('ctui/themes')
  .map((f) => f.replace(/\.json$/, ''))
  .sort()
same('inherit plus the ctui/themes/*.json slugs A–Z and the theme options', ['inherit', ...themes].join(' '), manifest.userConfig.theme.options.join(' '))

// The pin and the support floor: both READMEs name them, the toast's constant
// and the floor's vendored types name the floor.
const pin: string = json('package.json').devDependencies['@anthropic-ai/claude-code']
if (!/^\d+\.\d+\.\d+$/.test(pin)) error(`the Claude Code pin must be an exact version, got [${pin}]`)
// The engine heads the types it writes with its version; claude-code-tools has no such line.
const floorWritten = /^\/\/ Written by Claude Code (\S+)\.$/m.exec(readFileSync('vendor/claude-code-types-floor/claude-code/index.d.ts', 'utf8'))?.[1] ?? ''
same('the floor in ctui/hooks/floor.ts and the version that wrote vendor/claude-code-types-floor', floor, floorWritten)
const supported = `Needs Claude Code ${floor} or later. Tested with ${pin}.`
const readmeLines = (path: string) => readFileSync(path, 'utf8').split('\n')
for (const readme of ['README.md', 'ctui/README.md']) {
  if (!readmeLines(readme).includes(supported)) error(`${readme} has no line "${supported}"`)
}

// The root README repeats ctui/README.md's install commands, so they cannot drift.
const pluginCommands = (path: string) => readmeLines(path).filter((line) => line.startsWith('/plugin '))
const ctuiInstall = pluginCommands('ctui/README.md')
if (ctuiInstall.length === 0) error('ctui/README.md has no /plugin install lines')
same('the /plugin lines in README.md and ctui/README.md', pluginCommands('README.md').join(' | '), ctuiInstall.join(' | '))

// The engine-pinned expectations hold on one engine, so their MEMORY.md entry names the pin.
const PINNED = 'Engine-pinned expectations hold only on the pinned Claude Code version'
const entry = readFileSync('MEMORY.md', 'utf8').split('\n## ').find((section) => section.startsWith(PINNED))
if (!entry) error(`MEMORY.md has no entry "## ${PINNED}"`)
else if (!entry.includes(pin)) {
  error(`MEMORY.md entry "## ${PINNED}" does not name the pin ${pin}: re-run the engine-pinned expectations on ${pin} and record the measured values there`)
}

// The cost live check's fixture generator.
run('node', ['--test', 'scripts/cost-fixture.test.ts'])

// The version a merge into main gets, from its branch name and the v* tags.
run('node', ['--test', 'scripts/release-version.test.ts'])

// The changelog entry prepare-release.ts writes and the check on pull requests into main.
run('node', ['--test', 'scripts/changelog.test.ts'])

// The back-merge from main into develop after a release.
run('node', ['--test', 'scripts/back-merge.test.ts'])

// Themes and the docs/configuration.md table: regenerating must change nothing.
run('node', ['--test', 'scripts/themes.test.ts'])
const generated = outputs()
for (const [path, contents] of generated) {
  if (!existsSync(path) || readFileSync(path, 'utf8') !== contents) error(`${path} is stale, run node scripts/themes.ts`)
}
for (const file of readdirSync('ctui/themes')) {
  if (!generated.has(`ctui/themes/${file}`)) error(`ctui/themes/${file} is not a generated Theme`)
}

// The directory listing icon: regenerating must change nothing.
run('node', ['--test', 'scripts/icon.test.ts'])
if (!existsSync(ICON) || !readFileSync(ICON).equals(png())) error(`${ICON} is stale, run node scripts/icon.ts`)

// Spelling, against cspell.json's words. A new name that is spelled right goes in its `words`.
run(cspell, ['lint', '--no-progress', '--no-summary', '**'])

process.exit(failed ? 1 : 0)
