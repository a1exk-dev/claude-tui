// The Sidebar's 7 color roles and the Claude Code theme key each draws with
// (MEMORY.md "Sidebar colors inherit the Claude Code theme").
const KEYS = {
  main: 'text',
  muted: 'inactive',
  faint: 'subtle',
  success: 'success',
  warning: 'warning',
  error: 'error',
  accent: 'suggestion',
} as const

export type Role = keyof typeof KEYS
export type Colors = Record<Role, string>

// Each role's color: a selected Theme's override for its key, else the key
// itself, which Claude Code resolves from the person's theme at draw time.
// Under `inherit` there are no overrides.
export const colors = (overrides: Readonly<Record<string, string>> = {}): Colors =>
  Object.fromEntries(Object.entries(KEYS).map(([role, key]) => [role, overrides[key] ?? key])) as Colors
