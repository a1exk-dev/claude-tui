// Run by `node scripts/check.ts`, or alone: `node --test scripts/`.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { manifestVersion, withVersion } from './plugin-version.ts'

const manifest = '{\n  "name": "ctui",\n  "displayName": "ctui",\n  "keywords": [\n    "tui"\n  ]\n}\n'

test('the version is written under the name, the rest left as it was', () => {
  assert.equal(withVersion(manifest, '1.0.2'), '{\n  "name": "ctui",\n  "version": "1.0.2",\n  "displayName": "ctui",\n  "keywords": [\n    "tui"\n  ]\n}\n')
})

test('a version already written is replaced in place', () => {
  const written = '{\n  "name": "ctui",\n  "version": "1.0.1",\n  "displayName": "ctui"\n}\n'
  assert.equal(withVersion(written, '1.0.2'), '{\n  "name": "ctui",\n  "version": "1.0.2",\n  "displayName": "ctui"\n}\n')
})

test('a version that matches the branch passes the check', () => {
  assert.doesNotThrow(() => manifestVersion('{ "name": "ctui", "version": "1.0.2" }', '1.0.2'))
})

test('another version or none fails the check', () => {
  assert.throws(() => manifestVersion('{ "name": "ctui", "version": "1.0.1" }', '1.0.2'), /plugin\.json's version is 1\.0\.1, not 1\.0\.2/)
  assert.throws(() => manifestVersion('{ "name": "ctui" }', '1.0.2'), /plugin\.json's version is missing, not 1\.0\.2/)
})
