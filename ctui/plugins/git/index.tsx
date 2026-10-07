import type { SidebarPlugin } from '../plugin'

// The Sidebar header: path, branch, ahead/behind and file-status counts, lines changed.
const plugin: SidebarPlugin = {
  id: 'git',
  title: 'Git',
  slot: 'header',
  needs: ['git'],
  view: ({ git }, { Text }, _cfg, _width, c) => {
    if (!git) return []
    const rows = [
      <Text bold color={c.main} wrap="truncate-start">
        {git.path}
      </Text>,
    ]
    const repo = git.repo
    if (!repo) return rows
    rows.push(
      <Text color={c.main} wrap="truncate-end">
        <Text color={c.muted}>⎇</Text> {repo.branch}
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
    if (counts.length) rows.push(<Text>{counts.flatMap((count, i) => (i ? ['  ', count] : [count]))}</Text>)
    if (repo.added || repo.removed) {
      rows.push(
        <Text>
          <Text color={c.success}>+{repo.added}</Text> <Text color={c.error}>-{repo.removed}</Text>{' '}
          <Text color={c.muted}>lines changed</Text>
        </Text>,
      )
    }
    return rows
  },
}

export default plugin
