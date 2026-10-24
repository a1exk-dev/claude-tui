// Repo checks. Run locally and in CI: `node scripts/check.ts`.
// Node strips the types, so there is no build step.
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FLOOR as floor } from '../ctui/hooks/floor.ts'
import { MONTHLY_DEFAULT } from '../ctui/hooks/monthly-default.ts'
import { ICON, png } from './icon.ts'
import { claude, staged } from './stage.ts'
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
// Strict: every error and warning fails.
type Issue = { path: string; message: string }
type Report = { errors: Issue[]; warnings: Issue[] }
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
  const issues = reports.flatMap((report) => [...report.errors, ...report.warnings])
  for (const { path, message } of issues) console.error(`${dir}: ${path}: ${message}`)
  if (status !== 0 || reports.length === 0 || issues.length > 0) error(`claude plugin validate ${dir} failed or warned`)
}
validate('ctui')
validate('.')
// tests/ lives outside ctui/, which the directory scans whole, and joins a scratch copy of it.
staged('tests', (plugin) => run(claude, ['plugin', 'test', plugin]))

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
// The monthly cost default: the manifest declares it, and the settings reader and the Limits view read the constant.
same(
  'the limits_cost_monthly default in plugin.json and MONTHLY_DEFAULT in ctui/hooks/monthly-default.ts',
  String(manifest.userConfig.limits_cost_monthly.default),
  String(MONTHLY_DEFAULT),
)

// ctui/ holds only what ships: every tracked file is in ctui/package.json's `files` (npm adds package.json itself),
// and every `files` entry names a tracked file. The directory scans the whole folder (#415).
const shipped: string[] = [...json('ctui/package.json').files, 'package.json']
const tracked = spawnSync('git', ['ls-files', 'ctui'], { encoding: 'utf8' })
  .stdout.split('\n')
  .filter(Boolean)
  .map((path) => path.replace(/^ctui\//, ''))
const isUnder = (path: string, entry: string) => path === entry || path.startsWith(`${entry}/`)
const unshipped = tracked.filter((path) => !shipped.some((entry) => isUnder(path, entry)))
if (unshipped.length > 0) error(`ctui/ tracks files ctui/package.json's files leaves out: ${unshipped.join(' ')}`)
const missing = shipped.filter((entry) => !tracked.some((path) => isUnder(path, entry)))
if (missing.length > 0) error(`ctui/package.json's files names what ctui/ does not track: ${missing.join(' ')}`)

// The `void` call closes with the handler: after it come only the closers of the expression around it,
// and the call before it is whole, so the handler isn't inside its arguments.
const endsInHandler = (line: string) => {
  const call = /\bvoid\s+([\w$.]+\(.*)\.catch\(\(\) => undefined\)[)},;\s]*$/.exec(line)?.[1]
  if (call === undefined) return false
  let depth = 0
  for (const char of call) if ((depth += char === '(' ? 1 : char === ')' ? -1 : 0) < 0) return false
  return depth === 0
}

// The directory's Validate reads a `Client` only as an element written in a hook's own tree, from elements
// destructured by name off `$.ui.resolve(e)`, with a string-literal `module` (MOD_IMPORT_DYNAMIC_COMPUTED, #428)
// beside the hooks module, as `./<name>.tsx` (#433). `claude plugin validate` checks none of it. A Sidebar
// plugin leaves a Client placeholder that register.tsx's render hook draws as its Client in its own body.
for (const path of tracked.filter((path) => /\.tsx?$/.test(path)).map((path) => `ctui/${path}`)) {
  const source = readFileSync(path, 'utf8')
  if (/const \{[^}]*\.\.\.[^}]*\} = \$\.ui\.resolve\(/.test(source)) error(`${path} binds $.ui.resolve(e)'s elements with a rest pattern`)
  const clients = [...source.matchAll(/<Client\b[^>]*>/g)].map((m) => m[0])
  if (clients.length > 0 && path !== 'ctui/hooks/register.tsx') error(`${path} writes a <Client>: only register.tsx's hooks do`)
  for (const tag of clients) if (!/ module="\.\/[a-z]+\.tsx"/.test(tag)) error(`${path} writes a <Client> whose module is not "./<name>.tsx": ${tag}`)
  // An un-awaited call is one line ending in the one fixed handler, so a refusal from another mod
  // never reaches the test runner as an unhandled rejection (#462). `void` in a type takes no call.
  source.split('\n').forEach((line, index) => {
    if (/\bvoid\s+[\w$.]+\(/.test(line) && !endsInHandler(line))
      error(`${path}:${index + 1} leaves an un-awaited call that doesn't end in .catch(() => undefined)`)
  })
}

// The pin and the support floor: both READMEs name them, the toast's constant
// and the floor's vendored types name the floor.
const pin: string = json('package.json').devDependencies['@anthropic-ai/claude-code']
if (!/^\d+\.\d+\.\d+$/.test(pin)) error(`the Claude Code pin must be an exact version, got [${pin}]`)
// The engine heads the types it writes with its version; claude-code-tools has no such line.
const floorWritten = /^\/\/ Written by Claude Code (\S+)\.$/m.exec(readFileSync('vendor/claude-code-types-floor/claude-code/index.d.ts', 'utf8'))?.[1] ?? ''
same('the floor in ctui/hooks/floor.ts and the version that wrote vendor/claude-code-types-floor', floor, floorWritten)
const supported = `Needs Claude Code ${floor} or later. Tested with ${pin}.`
// Each README is read once.
const readmes: Record<string, string> = Object.fromEntries(['README.md', 'ctui/README.md'].map((path) => [path, readFileSync(path, 'utf8')]))
const readmeLines = (path: string) => readmes[path].split('\n')
for (const readme of Object.keys(readmes)) {
  if (!readmeLines(readme).includes(supported)) error(`${readme} has no line "${supported}"`)
}

// The root README repeats ctui/README.md's install commands, so they cannot drift.
const pluginCommands = (path: string) => readmeLines(path).filter((line) => line.startsWith('/plugin '))
const ctuiInstall = pluginCommands('ctui/README.md')
if (ctuiInstall.length === 0) error('ctui/README.md has no /plugin install lines')
same('the /plugin lines in README.md and ctui/README.md', pluginCommands('README.md').join(' | '), ctuiInstall.join(' | '))

// The directory policy asks the README for examples (§3E), support and a security contact (§3B),
// privacy and data handling (§3A) and troubleshooting (§3C).
const ctuiReadme = readmeLines('ctui/README.md')
for (const section of ['## Examples', '## Support', '## Privacy and data', '## Troubleshooting']) {
  if (!ctuiReadme.includes(section)) error(`ctui/README.md has no "${section}" section`)
}
const SECURITY = 'https://github.com/a1exk-dev/claude-tui/security/advisories/new'
if (!readmes['ctui/README.md'].includes(SECURITY)) error(`ctui/README.md does not link ${SECURITY} for security reports`)

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

// plugin.json's version, which prepare-release.ts writes and the check on pull requests into main enforces.
run('node', ['--test', 'scripts/plugin-version.test.ts'])

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
