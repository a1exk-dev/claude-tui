// Runs the eval suite: `node scripts/evals.ts <claude plugin eval flags>`, from CONTRIBUTING.md's Evals.
// Stages ctui/ with evals/ inside, and writes the results under the gitignored evals/results/.
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { staged } from './stage.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const results = join(root, 'evals', 'results', new Date().toISOString().replace(/[:.]/g, '-'))
const claude = join(root, 'node_modules', '.bin', 'claude')
// Ctrl-C reaches claude too: let it end the run, so this process lives on to remove the copy.
process.on('SIGINT', () => {})
const status = staged('evals', (plugin) => {
  const args = ['plugin', 'eval', plugin, '--output-dir', results, '--report', join(results, 'report.html'), ...process.argv.slice(2)]
  return spawnSync(claude, args, { stdio: 'inherit' }).status
})
process.exit(status ?? 1)
