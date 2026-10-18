// Writes this release's entry on top of ctui/CHANGELOG.md, from the commits since
// the latest v* tag. Run on the release/X.Y.Z or hotfix/<name> branch:
// `node scripts/prepare-release.ts [--note-file <path>]`.
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { addEntry, CHANGELOG, entry, releasedLines } from './changelog.ts'
import { latestTag, nextVersion, versionTags } from './release-version.ts'

const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8' }).trim()

if (import.meta.main) {
  process.chdir(join(dirname(fileURLToPath(import.meta.url)), '..'))
  const args = process.argv.slice(2)
  try {
    if (!(args.length === 0 || (args.length === 2 && args[0] === '--note-file'))) throw new Error('usage: node scripts/prepare-release.ts [--note-file <path>]')
    // Read everything before the one write, so a refusal leaves both files as they were.
    const note = args[1] === undefined ? undefined : readFileSync(args[1], 'utf8').trim()
    if (note === '') throw new Error(`${args[1]} holds no text to use as a release note`)
    const tags = versionTags()
    const version = nextVersion(git('rev-parse', '--abbrev-ref', 'HEAD'), tags)
    const latest = latestTag(tags)
    const since = latest ? `v${latest.join('.')}` : undefined
    const subjects = git('log', '--no-merges', '--format=%s', ...(since ? [`${since}..HEAD`] : [])).split('\n').filter(Boolean)
    const changelog = readFileSync(CHANGELOG, 'utf8')
    // en-CA formats the local date as YYYY-MM-DD.
    const today = new Date().toLocaleDateString('en-CA')
    writeFileSync(CHANGELOG, addEntry(changelog, entry(version, today, subjects, releasedLines(changelog), note)))
    console.log(`Wrote ${version} to ${CHANGELOG} from ${subjects.length} commit(s) since ${since ?? 'the start'}; review it in the pull request into main`)
  } catch (error) {
    console.error(`error: ${(error as Error).message}`)
    process.exitCode = 1
  }
}
