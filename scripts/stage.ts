// Stages ctui/ with tests/ or evals/ inside, in a scratch folder under the OS temp dir.
// `claude plugin test` runs only tests under the plugin's folder and `claude plugin eval`
// reads its cases only from below it, while the directory scans that whole folder, so
// tests/ and evals/ live at the repo root and join a copy of ctui/ for each run (#415).
import { cpSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

/** Runs `use` on a scratch copy of ctui/ holding `suite`, then removes the copy. */
export function staged<T>(suite: 'tests' | 'evals', use: (plugin: string) => T): T {
  const scratch = mkdtempSync(join(tmpdir(), 'ctui-stage-'))
  try {
    // Named ctui, as the real folder is.
    const plugin = join(scratch, 'ctui')
    cpSync(join(root, 'ctui'), plugin, { recursive: true })
    // An earlier run's results stay at the repo root, out of the copy.
    cpSync(join(root, suite), join(plugin, suite), {
      recursive: true,
      filter: (path) => path !== join(root, suite, 'results'),
    })
    return use(plugin)
  } finally {
    rmSync(scratch, { recursive: true, force: true })
  }
}
