// Tags and releases a merge into main. Run by the release job in release.yml.
import { appendFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { nextVersion, versionTags } from './release-version.ts'

if (import.meta.main) {
  const headRef = process.env.HEAD_REF ?? ''
  const mergeSha = process.env.MERGE_SHA ?? ''
  try {
    const version = nextVersion(headRef, versionTags())
    // The back-merge job reads the version from this job output. Write it
    // first, so a failed write leaves no tag behind.
    appendFileSync(process.env.GITHUB_OUTPUT ?? '', `version=${version}\n`)
    execFileSync('gh', ['release', 'create', `v${version}`, '--target', mergeSha, '--generate-notes'], { stdio: 'inherit' })
  } catch (error) {
    console.log(`::error::${(error as Error).message}`)
    process.exitCode = 1
  }
}
