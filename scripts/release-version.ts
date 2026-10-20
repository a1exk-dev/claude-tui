// The version a merge into main gets, from the branch name and the `v*` tags,
// its only source: plugin.json's `version` mirrors it (plugin-version.ts). Used by the source-branch job
// before the merge and by the release job after it.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { CHANGELOG, topEntry } from './changelog.ts'
import { assertManifestVersion, MANIFEST } from './plugin-version.ts'

type Semver = [number, number, number]

const semver = (match: RegExpExecArray): Semver => [Number(match[1]), Number(match[2]), Number(match[3])]

// Semver order: major, then minor, then patch, each as a number.
const compare = (a: Semver, b: Semver) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]

// The highest v<semver> tag, ignoring any other.
export const latestTag = (tags: string[]): Semver | undefined =>
  tags
    .map((tag) => /^v(\d+)\.(\d+)\.(\d+)$/.exec(tag))
    .filter((match) => match !== null)
    .map(semver)
    .sort(compare)
    .at(-1)

// The repo's tags that start with v, for nextVersion, which ignores any that are not v<semver>.
export const versionTags = () => execFileSync('git', ['tag', '--list', 'v*'], { encoding: 'utf8' }).split('\n').filter(Boolean)

export function nextVersion(headRef: string, tags: string[]): string {
  const latest = latestTag(tags)
  const release = /^release\/(\d+)\.(\d+)\.(\d+)$/.exec(headRef)
  if (release) {
    const version = semver(release)
    if (latest && compare(version, latest) <= 0) throw new Error(`${headRef} must be above the latest tag v${latest.join('.')}`)
    return version.join('.')
  }
  // Hotfix branch names hold no version, so a hotfix bumps the patch.
  if (/^hotfix\/.+$/.test(headRef)) {
    if (!latest) throw new Error('No v<semver> tag on main; merge a release/X.Y.Z first')
    return [latest[0], latest[1], latest[2] + 1].join('.')
  }
  throw new Error(`${headRef} is not a release/X.Y.Z or hotfix/<name> branch`)
}

// The version a merge of headRef into main gets, and its changelog entry. Fails unless
// that entry is on top of the changelog and plugin.json's version equals it.
export function checkedRelease(headRef: string): { version: string; notes: string } {
  const version = nextVersion(headRef, versionTags())
  const notes = topEntry(readFileSync(CHANGELOG, 'utf8'), version)
  assertManifestVersion(readFileSync(MANIFEST, 'utf8'), version)
  return { version, notes }
}
