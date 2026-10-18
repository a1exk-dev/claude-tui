// ctui/CHANGELOG.md: one entry per release, newest first, written on the release
// branch by prepare-release.ts and used as the GitHub Release body by release.ts.

export const CHANGELOG = 'ctui/CHANGELOG.md'

const HEADER = '# Changelog\n'

// conventional-changelog's conventionalcommits preset (v8.0.0 src/constants.js), in its order, nothing hidden.
const SECTIONS: [title: string, types: string[]][] = [
  ['Features', ['feat', 'feature']],
  ['Bug Fixes', ['fix']],
  ['Performance Improvements', ['perf']],
  ['Reverts', ['revert']],
  ['Documentation', ['docs']],
  ['Styles', ['style']],
  ['Miscellaneous Chores', ['chore']],
  ['Code Refactoring', ['refactor']],
  ['Tests', ['test']],
  ['Build System', ['build']],
  ['Continuous Integration', ['ci']],
]

// Lines that earlier entries already list: the changelog is the record of what shipped.
export const releasedLines = (changelog: string) => new Set([...changelog.matchAll(/^- (.+)$/gm)].map((match) => match[1]!))

// One release's entry from its commit subjects. A note is body text, so it stands in for "No user-facing changes."
export function entry(version: string, date: string, subjects: string[], released: Set<string>, note?: string): string {
  const lines = new Map(SECTIONS.map(([title]) => [title, [] as string[]]))
  for (const subject of subjects) {
    const match = /^(\w+)(?:\([^)]*\))?!?: *(.+)$/.exec(subject)
    if (!match || released.has(match[2]!)) continue
    // A type the table doesn't list is dropped, as the preset does.
    const section = SECTIONS.find(([, types]) => types.includes(match[1]!))
    if (section) lines.get(section[0])!.push(match[2]!)
  }
  const blocks = [
    ...(note ? [note] : []),
    ...[...lines].filter(([, items]) => items.length > 0).map(([title, items]) => `### ${title}\n\n${items.map((item) => `- ${item}`).join('\n')}`),
  ]
  return `## ${version} (${date})\n\n${blocks.length > 0 ? blocks.join('\n\n') : 'No user-facing changes.'}`
}

// The changelog with the entry on top. Refuses a version it already has.
export function addEntry(changelog: string, newEntry: string): string {
  if (!changelog.startsWith(HEADER)) throw new Error(`${CHANGELOG} must start with "# Changelog"`)
  const version = /^## (\S+) /.exec(newEntry)?.[1]
  if (changelog.split('\n').some((line) => line.startsWith(`## ${version} (`))) throw new Error(`${CHANGELOG} already has an entry for ${version}`)
  const rest = changelog.slice(HEADER.length).trim()
  return `${HEADER}\n${newEntry}${rest ? `\n\n${rest}` : ''}\n`
}

// The top entry, heading included, after checking it names the version the merge into main gets.
export function topEntry(changelog: string, version: string): string {
  const top = changelog.split(/^(?=## )/m)[1]?.trim() ?? ''
  const named = /^## (\S+) \(/.exec(top)?.[1]
  if (named !== version) {
    throw new Error(`The top entry of ${CHANGELOG} is ${named ?? 'missing'}, not ${version}: run node scripts/prepare-release.ts on the branch`)
  }
  return top
}
