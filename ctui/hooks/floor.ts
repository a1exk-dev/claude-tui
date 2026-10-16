// The support floor: the lowest Claude Code version ctui runs on (CONTEXT.md
// "Support floor"). `node scripts/check.ts` ties it to ctui/README.md and to
// the types in vendor/claude-code-types-floor/.
export const FLOOR = '2.1.292'

const core = (version: string) => /^(\d+)\.(\d+)\.(\d+)/.exec(version)?.slice(1).map(Number)

// Whether an engine version is older than the floor. A version not spelled
// `x.y.z…` is taken as new enough: a wrong toast is worse than none.
export function belowFloor(version: string): boolean {
  const have = core(version)
  const need = core(FLOOR)!
  if (!have) return false
  for (let i = 0; i < 3; i++) if (have[i] !== need[i]) return have[i]! < need[i]!
  return false
}

export const floorToast = (version: string) => `ctui needs Claude Code ${FLOOR} or later; this is ${version}`
