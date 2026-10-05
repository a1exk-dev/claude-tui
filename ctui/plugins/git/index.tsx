import type { SidebarPlugin } from '../plugin'

// The Sidebar header: path, branch, ahead/behind and file-status counts, lines changed.
const plugin: SidebarPlugin = {
  id: 'git',
  title: 'Git',
  slot: 'header',
  needs: ['git'],
  view: ({ git }, { Text }) => {
    if (!git) return []
    const rows = [
      <Text bold wrap="truncate-start">
        {git.path}
      </Text>,
    ]
    const repo = git.repo
    if (!repo) return rows
    rows.push(<Text wrap="truncate-end">⎇ {repo.branch}</Text>)
    const counts = [
      ...(repo.ahead === undefined ? [] : [<Text>↑{repo.ahead}</Text>, <Text>↓{repo.behind}</Text>]),
      ...(repo.staged ? [<Text color="success">+{repo.staged}</Text>] : []),
      ...(repo.modified ? [<Text color="warning">!{repo.modified}</Text>] : []),
      ...(repo.untracked ? [<Text color="inactive">?{repo.untracked}</Text>] : []),
      ...(repo.stashes ? [<Text color="suggestion">≡{repo.stashes}</Text>] : []),
    ]
    if (counts.length) rows.push(<Text>{counts.flatMap((count, i) => (i ? ['  ', count] : [count]))}</Text>)
    if (repo.added || repo.removed) {
      rows.push(
        <Text>
          <Text color="success">+{repo.added}</Text> <Text color="error">-{repo.removed}</Text>{' '}
          <Text dimColor>lines changed</Text>
        </Text>,
      )
    }
    return rows
  },
}

export default plugin
