import type { RenderNode } from 'claude-code'

import type { SidebarPlugin } from '../plugin'

// The Devicons glyphs leading the git rows (#132), from the person's Nerd Font.
const BRANCH = '\ue725' // dev-git_branch
const CHANGESET = '\ue702' // dev-git
const LINES = '\ue728' // dev-git_compare

// The Sidebar header: path; in a repo a blank row, then branch, ahead/behind
// and file-status counts, lines changed, each led by its glyph.
const plugin: SidebarPlugin = {
  id: 'git',
  title: 'Git',
  slot: 'header',
  needs: ['git'],
  view: ({ git }, { Text }, _cfg, _width, c) => {
    if (!git) return []
    const rows: RenderNode[] = [
      <Text bold color={c.main} wrap="truncate-start">
        {git.path}
      </Text>,
    ]
    const repo = git.repo
    if (!repo) return rows
    // A glyph in muted and a space: glyphs in column 0, text in column 2.
    const lead = (glyph: string) => [<Text color={c.muted}>{glyph}</Text>, ' ']
    rows.push(
      '',
      <Text color={c.main} wrap="truncate-end">
        {lead(BRANCH)}
        {repo.branch}
      </Text>,
    )
    const counts = [
      ...(repo.ahead === undefined
        ? []
        : [<Text color={c.main}>↑{repo.ahead}</Text>, <Text color={c.main}>↓{repo.behind}</Text>]),
      ...(repo.staged ? [<Text color={c.success}>+{repo.staged}</Text>] : []),
      ...(repo.modified ? [<Text color={c.warning}>!{repo.modified}</Text>] : []),
      ...(repo.untracked ? [<Text color={c.muted}>?{repo.untracked}</Text>] : []),
      ...(repo.stashes ? [<Text color={c.accent}>≡{repo.stashes}</Text>] : []),
    ]
    if (counts.length) {
      rows.push(
        <Text>
          {lead(CHANGESET)}
          {counts.flatMap((count, i) => (i ? ['  ', count] : [count]))}
        </Text>,
      )
    }
    if (repo.added || repo.removed) {
      rows.push(
        <Text>
          {lead(LINES)}
          <Text color={c.success}>+{repo.added}</Text> <Text color={c.error}>-{repo.removed}</Text>{' '}
          <Text color={c.muted}>lines changed</Text>
        </Text>,
      )
    }
    return rows
  },
}

export default plugin
