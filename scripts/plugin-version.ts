// ctui/.claude-plugin/plugin.json's `version`: a mirror of the branch's version,
// written on the release branch by prepare-release.ts and checked before the merge
// into main and before the tag. The branch name stays the version's only source.

export const MANIFEST = 'ctui/.claude-plugin/plugin.json'

// The manifest with `version` under `name`, every other key in its place.
export function withVersion(manifest: string, version: string): string {
  const { name, version: _, ...rest } = JSON.parse(manifest)
  return `${JSON.stringify({ name, version, ...rest }, null, 2)}\n`
}

// Fails unless the manifest's `version` is the one the merge into main gets.
export function assertManifestVersion(manifest: string, version: string): void {
  const written: unknown = JSON.parse(manifest).version
  if (written !== version) {
    throw new Error(`${MANIFEST}'s version is ${written ?? 'missing'}, not ${version}: run node scripts/prepare-release.ts on the branch`)
  }
}
