import type { GitRepo } from '../types'

// Parses `git status --porcelain=v2 --branch`, `git stash list` and
// `git diff --numstat HEAD` into the git header's repo rows.
export function parseGit(status: string, stash: string, numstat: string): GitRepo {
  const repo: GitRepo = { branch: '', staged: 0, modified: 0, untracked: 0, stashes: 0, added: 0, removed: 0 }
  let oid = ''
  for (const line of status.split('\n')) {
    const [kind, field, value = ''] = line.split(' ')
    if (kind === '#') {
      if (field === 'branch.oid') oid = value
      else if (field === 'branch.head') repo.branch = value
      else if (field === 'branch.ab') {
        repo.ahead = Number(value.slice(1))
        repo.behind = Number(line.split(' ')[3]?.slice(1))
      }
    } else if (kind === '1' || kind === '2') {
      if (field?.[0] !== '.') repo.staged++
      if (field?.[1] !== '.') repo.modified++
    } else if (kind === 'u') repo.modified++
    else if (kind === '?') repo.untracked++
  }
  if (repo.branch === '(detached)') repo.branch = oid.slice(0, 7)
  repo.stashes = stash.split('\n').filter(Boolean).length
  for (const line of numstat.split('\n')) {
    const [added, removed] = line.split('\t')
    // Binary files read `-`: they count 0.
    repo.added += Number(added) || 0
    repo.removed += Number(removed) || 0
  }
  return repo
}

// The cwd with the home directory shown as `~`.
export function tildify(cwd: string, home: string | undefined): string {
  if (!home) return cwd
  if (cwd === home) return '~'
  return cwd.startsWith(`${home}/`) ? `~${cwd.slice(home.length)}` : cwd
}
