import type { SidebarPlugin } from './plugin'

import agents from './agents'
import context from './context'
import git from './git'
import limits from './limits'
import mcp from './mcp'
import skills from './skills'
import todo from './todo'
import versions from './versions'

// Static registry in default Sidebar order: validation rejects dynamic
// import(). Keep folders and these imports equal, and an `<id>_enable` key in
// plugin.json for each section; the git header and versions footer are always
// on (scripts/check.ts checks).
export const plugins: readonly SidebarPlugin[] = [git, context, limits, todo, skills, mcp, agents, versions]

// The sections between the header and footer, the ones a person can turn off and reorder.
export const sections = plugins.filter((plugin) => plugin.slot === 'section')
