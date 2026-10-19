// Git Flow test for pull requests into main. Run by the Git Flow workflow's source-branch job.
import { readFileSync } from 'node:fs'
import { CHANGELOG, topEntry } from './changelog.ts'
import { nextVersion, versionTags } from './release-version.ts'

if (import.meta.main) {
  const headRef = process.env.HEAD_REF ?? ''
  const headRepo = process.env.HEAD_REPO ?? ''
  const repo = process.env.GITHUB_REPOSITORY ?? ''
  // nextVersion rejects any branch but release/X.Y.Z and hotfix/<name>, so only the repo is tested here.
  if (headRepo !== repo) {
    console.log(`::error::PRs into main must come from release/X.Y.Z or hotfix/<name> in ${repo}, got ${headRepo}:${headRef}`)
    process.exitCode = 1
  } else {
    // Fail on a bad version or changelog entry before the merge, not in the release job after it.
    try {
      const version = nextVersion(headRef, versionTags())
      topEntry(readFileSync(CHANGELOG, 'utf8'), version)
      console.log(`${headRef} merges as v${version}, with its ${CHANGELOG} entry on top`)
    } catch (error) {
      console.log(`::error::${(error as Error).message}`)
      process.exitCode = 1
    }
  }
}
