// Run by `node scripts/check.ts`, or alone: `node --test scripts/`.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { nextVersion } from './release-version.ts'

const tags = ['v0.5.0', 'v0.6.0', 'v0.5.1']

test('a release above the latest tag merges as its own version', () => {
  assert.equal(nextVersion('release/1.0.0', tags), '1.0.0')
  assert.equal(nextVersion('release/0.6.1', tags), '0.6.1')
})

test('a release at or below the latest tag throws', () => {
  assert.throws(() => nextVersion('release/0.6.0', tags), /^Error: release\/0\.6\.0 must be above the latest tag v0\.6\.0$/)
  assert.throws(() => nextVersion('release/0.5.9', tags), /must be above the latest tag v0\.6\.0/)
})

test('a release with no tag yet merges as its own version', () => {
  assert.equal(nextVersion('release/1.0.0', []), '1.0.0')
})

test('versions compare as numbers, not text', () => {
  assert.equal(nextVersion('hotfix/fix', ['v0.9.0', 'v0.10.0']), '0.10.1')
})

test('a hotfix after a tag bumps the patch', () => {
  assert.equal(nextVersion('hotfix/footer', tags), '0.6.1')
})

test('a hotfix with no tag throws', () => {
  assert.throws(() => nextVersion('hotfix/footer', []), /No v<semver> tag on main/)
})

test('any other branch throws', () => {
  for (const ref of ['develop', 'feature/x', 'release/1.0', 'hotfix/']) {
    assert.throws(() => nextVersion(ref, tags), /is not a release\/X\.Y\.Z or hotfix\/<name> branch/)
  }
})

test('tags that are not v<semver> are ignored', () => {
  assert.equal(nextVersion('hotfix/footer', ['v0.6.0', 'v9.9.9-rc.1', '1.0.0', 'v2.0', 'latest']), '0.6.1')
  assert.throws(() => nextVersion('hotfix/footer', ['1.0.0', 'nightly']), /No v<semver> tag on main/)
})
