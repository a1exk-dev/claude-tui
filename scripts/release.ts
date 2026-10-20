// Tags and releases a merge into main. Run by the release job in release.yml.
import { appendFileSync, readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { CHANGELOG, topEntry } from './changelog.ts'
import { MANIFEST, manifestVersion } from './plugin-version.ts'
import { nextVersion, versionTags } from './release-version.ts'

if (import.meta.main) {
  const headRef = process.env.HEAD_REF ?? ''
  const mergeSha = process.env.MERGE_SHA ?? ''
  try {
    const version = nextVersion(headRef, versionTags())
    // The source-branch check passed this entry and plugin.json's version; check again so a mismatch tags nothing.
    const notes = topEntry(readFileSync(CHANGELOG, 'utf8'), version)
    manifestVersion(readFileSync(MANIFEST, 'utf8'), version)
    // The back-merge job reads the version from this job output. Write it
    // first, so a failed write leaves no tag behind.
    appendFileSync(process.env.GITHUB_OUTPUT ?? '', `version=${version}\n`)
    execFileSync('gh', ['release', 'create', `v${version}`, '--target', mergeSha, '--notes-file', '-'], { input: notes, stdio: ['pipe', 'inherit', 'inherit'] })
  } catch (error) {
    console.log(`::error::${(error as Error).message}`)
    process.exitCode = 1
  }
}
