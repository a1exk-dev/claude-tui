// Tags and releases a merge into main. Run by the release job in release.yml.
import { appendFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { nextVersion } from './release-version.ts'

const headRef = process.env.HEAD_REF ?? ''
const mergeSha = process.env.MERGE_SHA ?? ''
const tags = execFileSync('git', ['tag', '--list', 'v*'], { encoding: 'utf8' }).split('\n').filter(Boolean)
try {
  const version = nextVersion(headRef, tags)
  // The back-merge job reads the version from this job output. Write it
  // first, so a failed write leaves no tag behind.
  appendFileSync(process.env.GITHUB_OUTPUT ?? '', `version=${version}\n`)
  execFileSync('gh', ['release', 'create', `v${version}`, '--target', mergeSha, '--generate-notes'], { stdio: 'inherit' })
} catch (error) {
  console.log(`::error::${(error as Error).message}`)
  process.exitCode = 1
}
