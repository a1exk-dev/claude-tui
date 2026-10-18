// Opens or updates the back-merge pull request from main into develop. Run by the
// back-merge job in release.yml after the release job. Safe to re-run alone.
import { execFileSync } from 'node:child_process'
import { setTimeout } from 'node:timers/promises'

export type PrAction = { kind: 'create' } | { kind: 'update'; number: number }

// An open pull request from main into develop already carries the new commits,
// because its head is main, so the script updates it instead of opening a second one.
export function prAction(openPrs: number[]): PrAction {
  const open = openPrs[0]
  return open === undefined ? { kind: 'create' } : { kind: 'update', number: open }
}

export type MergeDecision = 'wait' | 'conflict' | 'auto-merge' | 'leave'

// The values of `gh pr view --json mergeable`.
export type Mergeable = 'MERGEABLE' | 'CONFLICTING' | 'UNKNOWN'

export function mergeDecision(mergeable: Mergeable, ownerMerged: boolean): MergeDecision {
  if (mergeable === 'UNKNOWN') return 'wait'
  if (mergeable === 'CONFLICTING') return 'conflict'
  // Any other actor's back-merge follows the normal develop rule.
  return ownerMerged ? 'auto-merge' : 'leave'
}

// GitHub cuts an annotation at a raw newline, so the steps use %0A.
export function conflictError(version: string, pr: number): string {
  return [
    `::error::The back-merge pull request #${pr} from main into develop has a conflict. Fix it:`,
    `1. Run git fetch, then make bugfix/back-merge-v${version} from origin/develop.`,
    '2. Run git merge origin/main and fix the conflict.',
    '3. Open a pull request into develop.',
    `4. Close the automatic pull request #${pr}.`,
  ].join('%0A')
}

const MAX_TRIES = 10
const RETRY_MS = 6000

const gh = (...args: string[]) => execFileSync('gh', args, { encoding: 'utf8' }).trim()

if (import.meta.main) {
  const version = process.env.VERSION ?? ''
  const mergedBy = process.env.MERGED_BY ?? ''
  const ownerMerged = mergedBy !== '' && mergedBy === process.env.REPO_OWNER
  const title = `chore: merge main v${version} into develop`
  const release = `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/releases/tag/v${version}`

  const openPrs = gh('pr', 'list', '--base', 'develop', '--head', 'main', '--state', 'open', '--json', 'number', '--jq', '.[].number')
    .split('\n')
    .filter(Boolean)
    .map(Number)
  const action = prAction(openPrs)
  let pr: number
  if (action.kind === 'create') {
    const url = gh('pr', 'create', '--base', 'develop', '--head', 'main', '--title', title, '--body', `Merges main into develop after release [v${version}](${release}).`)
    pr = Number(url.split('/').at(-1))
  } else {
    pr = action.number
    gh('pr', 'edit', String(pr), '--title', title)
    gh('pr', 'comment', String(pr), '--body', `Now also carries release [v${version}](${release}).`)
  }
  console.log(`Back-merge pull request #${pr}: ${title}`)

  let decision: MergeDecision = 'wait'
  for (let tries = 1; tries <= MAX_TRIES; tries++) {
    decision = mergeDecision(gh('pr', 'view', String(pr), '--json', 'mergeable', '--jq', '.mergeable') as Mergeable, ownerMerged)
    if (decision !== 'wait') break
    if (tries < MAX_TRIES) await setTimeout(RETRY_MS)
  }

  if (decision === 'wait') {
    console.log(`::error::GitHub did not compute the mergeability of pull request #${pr} after ${MAX_TRIES} tries; re-run the back-merge job`)
    process.exitCode = 1
  } else if (decision === 'conflict') {
    console.log(conflictError(version, pr))
    process.exitCode = 1
  } else if (decision === 'auto-merge') {
    gh('pr', 'merge', String(pr), '--auto', '--merge', '--subject', `${title} (#${pr})`)
    console.log(`Auto-merge is on for pull request #${pr}`)
  } else {
    console.log(`Pull request #${pr} waits for an agent to merge it once the checks pass`)
  }
}
