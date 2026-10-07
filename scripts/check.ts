// Repo checks. Run locally and in CI: `node scripts/check.ts`.
// Node strips the types, so there is no build step.
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { outputs } from './themes.ts'

process.chdir(join(dirname(fileURLToPath(import.meta.url)), '..'))

let failed = false
const warn = (message: string) => console.warn(`warning: ${message}`)
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
if (!existsSync(tsc) || !existsSync(claude)) {
  console.error('error: tsc or claude is not installed, run npm ci')
  process.exit(1)
}

// validate misses unbound tags in imported Sidebar plugin views; tsc catches them.
run(tsc, ['-p', '.'])
run(claude, ['plugin', 'validate', 'ctui', '--strict'])
run(claude, ['plugin', 'validate', '.', '--strict'])
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
same('Sidebar plugin folders and <id>_enable keys', folders, keys)
// The `theme` options don't list the bundled Themes yet (#90); each one they name needs a file.
const themes = readdirSync('ctui/themes').map((f) => f.replace(/\.json$/, ''))
for (const option of manifest.userConfig.theme.options) {
  if (option !== 'inherit' && !themes.includes(option)) error(`theme option ${option} has no ctui/themes/${option}.json`)
}
same('plugin.json and ctui/package.json versions', manifest.version, json('ctui/package.json').version)

// The pin: README and COMPATIBILITY.md follow package.json.
const pin: string = json('package.json').devDependencies['@anthropic-ai/claude-code']
if (!/^\d+\.\d+\.\d+$/.test(pin)) error(`the Claude Code pin must be an exact version, got [${pin}]`)
const tested = `Tested with Claude Code ${pin} ([all tested versions](COMPATIBILITY.md)).`
if (!readFileSync('ctui/README.md', 'utf8').split('\n').includes(tested)) {
  error(`ctui/README.md has no line "${tested}"`)
}
// The first table row after the `---` separator is the newest tested pair.
const rows = readFileSync('ctui/COMPATIBILITY.md', 'utf8')
  .split('\n')
  .filter((line) => line.startsWith('|'))
  .slice(2)
if (rows[0]) {
  const [version, claudeVersion] = rows[0].split('|').slice(1).map((cell) => cell.trim())
  same('COMPATIBILITY.md top row and plugin.json versions', version ?? '', manifest.version)
  same('COMPATIBILITY.md top row and the pin', claudeVersion ?? '', pin)
}

// Themes and the docs/configuration.md table: regenerating must change nothing.
run('node', ['--test', 'scripts/themes.test.ts'])
const generated = outputs()
for (const [path, contents] of generated) {
  if (!existsSync(path) || readFileSync(path, 'utf8') !== contents) error(`${path} is stale, run node scripts/themes.ts`)
}
for (const file of readdirSync('ctui/themes')) {
  if (!generated.has(`ctui/themes/${file}`)) error(`ctui/themes/${file} is not a generated Theme`)
}

if (spawnSync('typos', ['--version'], { stdio: 'ignore' }).error) warn('typos not installed, skipping spell check')
else run('typos', [])

process.exit(failed ? 1 : 0)
