// Seeds a scenario's CLAUDE_CONFIG_DIR under $TMPDIR: signed in, onboarded, this repo trusted.
// Nothing signed-in is ever written into the repo: every file below lands in a temp dir.
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** The checkout the harness drives: `<repo>/.claude/skills/live-checks/harness` is this folder. */
export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..')

export interface SeedOptions {
  /** Names the temp dir, so a kept one says which scenario failed. */
  scenario: string
  /** Merged over the base `settings.json`; an `env` object is merged key by key. */
  settings?: Record<string, unknown>
  /** Merged over the synthesized `.claude.json`. */
  claudeJson?: Record<string, unknown>
  /** Extra directories to mark trusted, beside the checkout. */
  trust?: string[]
}

const baseSettings = { tui: 'fullscreen', theme: 'dark', env: { CLAUDE_CODE_TMUX_TRUECOLOR: '1' } }

const trusted = () => ({
  allowedTools: [],
  hasTrustDialogAccepted: true,
  hasClaudeMdExternalIncludesApproved: true,
  hasClaudeMdExternalIncludesWarningShown: true,
  mcpServers: {},
  enabledMcpjsonServers: [],
  disabledMcpjsonServers: [],
  mcpContextUris: [],
})

const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}

/** Writes a fresh config dir and returns its path. The caller passes it to the engine as CLAUDE_CONFIG_DIR. */
export const seedConfigDir = (options: SeedOptions): string => {
  const dir = mkdtempSync(join(tmpdir(), `ctui-live-check-${options.scenario}-`))
  mkdirSync(join(dir, 'projects'), { recursive: true })

  // The operator's own sign-in, copied at mode 0600. The harness never writes a credential anywhere else.
  const credentials = join(dir, '.credentials.json')
  copyFileSync(join(homedir(), '.claude', '.credentials.json'), credentials)
  chmodSync(credentials, 0o600)

  const extra = options.settings ?? {}
  const settings = { ...baseSettings, ...extra, env: { ...baseSettings.env, ...object(extra.env) } }
  writeFileSync(join(dir, 'settings.json'), `${JSON.stringify(settings, null, 2)}\n`)

  // Onboarding answers and the account fields come from the operator's own ~/.claude.json, which is never written to.
  const own = object(JSON.parse(readFileSync(join(homedir(), '.claude.json'), 'utf8')))
  const projects: Record<string, unknown> = {}
  for (const path of [repoRoot, ...(options.trust ?? [])]) projects[path] = trusted()
  const claudeJson = {
    hasCompletedOnboarding: true,
    lastOnboardingVersion: own.lastOnboardingVersion,
    theme: 'dark',
    numStartups: 50,
    installMethod: 'global',
    hasSeenTasksHint: true,
    firstStartTime: own.firstStartTime,
    machineID: own.machineID,
    userID: own.userID,
    oauthAccount: own.oauthAccount,
    claudeCodeFirstTokenDate: own.claudeCodeFirstTokenDate,
    lastReleaseNotesSeen: own.lastReleaseNotesSeen,
    migrationVersion: own.migrationVersion,
    opusProMigrationComplete: true,
    sonnet1m45MigrationComplete: true,
    additionalModelOptionsAnsweredAt: own.additionalModelOptionsAnsweredAt,
    projects,
    ...(options.claudeJson ?? {}),
  }
  writeFileSync(join(dir, '.claude.json'), `${JSON.stringify(claudeJson, null, 2)}\n`)
  return dir
}

/** Delete a seeded dir. A scenario deletes its dir on pass and keeps it on failure, so the report can name it. */
export const removeConfigDir = (dir: string): void => {
  if (dir.startsWith(tmpdir())) rmSync(dir, { recursive: true, force: true })
  else throw new Error(`refusing to delete ${dir}: not under ${tmpdir()}`)
}
