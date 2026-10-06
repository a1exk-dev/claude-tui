import type { SidebarPlugin } from './plugin'

import agents from './agents'
import context from './context'
import git from './git'
import limits from './limits'
import mcp from './mcp'
import todo from './todo'
import versions from './versions'

// Static registry in Sidebar order: validation rejects dynamic import().
// Keep folders, these imports and the `<id>_enable` keys in plugin.json equal
// (scripts/check.ts checks).
export const plugins: readonly SidebarPlugin[] = [git, context, limits, mcp, todo, agents, versions]
