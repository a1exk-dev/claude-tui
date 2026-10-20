import { expect, test } from 'claude-code/testing'

import { parseGit, tildify } from '../hooks/git'

// Captured from git 2.51 `status --porcelain=v2 --branch`, `stash list` and `diff --numstat HEAD`.
const OID = '# branch.oid c1e879e48fada468970e942e80559adfe77c8713'
const ZERO = { staged: 0, modified: 0, untracked: 0, stashes: 0, added: 0, removed: 0 }

test('clean, with an upstream', () => {
  const status = [OID, '# branch.head main', '# branch.upstream origin/main', '# branch.ab +0 -0'].join('\n')
  expect(parseGit(status, '', '')).toEqual({ branch: 'main', ahead: 0, behind: 0, ...ZERO })
})

test('ahead and behind, staged, modified, untracked, stashed, lines changed', () => {
  const status = [
    OID,
    '# branch.head main',
    '# branch.upstream origin/main',
    '# branch.ab +2 -1',
    '1 .M N... 100644 100644 100644 422c2b7ab3b3c668038da977e4e93a5fc623169c 422c2b7ab3b3c668038da977e4e93a5fc623169c f',
    '1 A. N... 000000 100644 100644 0000000000000000000000000000000000000000 b68025345d5301abad4d9ec9166f455243a0d746 g',
    '1 MM N... 100644 100644 100644 422c2b7ab3b3c668038da977e4e93a5fc623169c 422c2b7ab3b3c668038da977e4e93a5fc623169c h',
    '? new',
    '',
  ].join('\n')
  const stash = 'stash@{0}: WIP on main: c1e879e 2\n'
  const numstat = '1\t0\tf\n1\t0\tg\n3\t2\th\n-\t-\tbin\n'
  expect(parseGit(status, stash, numstat)).toEqual({
    branch: 'main',
    ahead: 2,
    behind: 1,
    staged: 2,
    modified: 2,
    untracked: 1,
    stashes: 1,
    added: 5,
    removed: 2,
  })
})

test('detached shows the short sha', () => {
  const status = '# branch.oid 63568e2e396d887fc74b6f1d1f21f4c539c12044\n# branch.head (detached)\n? new\n'
  expect(parseGit(status, '', '')).toEqual({ branch: '63568e2', ...ZERO, untracked: 1 })
})

test('conflicts count as modified', () => {
  const status = [
    '# branch.oid ae87e1fea670d7104dac8bffc4533082e27e8a87',
    '# branch.head main',
    '# branch.upstream origin/main',
    '# branch.ab +2 -0',
    'u UU N... 100644 100644 100644 100644 78981922613b2afb6025042ff6bd878ac1994e85 975fbec8256d3e8a3797e7a3611380f27c49f4ac 587be6b4c3f93f93c489c0111bba5596147a26cb f',
  ].join('\n')
  expect(parseGit(status, '', '4\t0\tf\n')).toMatchObject({ ahead: 2, behind: 0, modified: 1, staged: 0, added: 4 })
})

test('no upstream leaves ahead and behind out', () => {
  const status = '# branch.oid a91dbbb6bbe8909a99be3e0ba0f5a7252025e584\n# branch.head side\n? new\n'
  const repo = parseGit(status, '', '')
  expect(repo.branch).toBe('side')
  expect(repo.ahead).toBeUndefined()
  expect(repo.behind).toBeUndefined()
})

test('unborn branch: the failed numstat reads as no lines', () => {
  expect(parseGit('# branch.oid (initial)\n# branch.head main\n', '', '')).toEqual({ branch: 'main', ...ZERO })
})

test('the home directory reads as ~', () => {
  expect(tildify('/home/a/Projects/x', '/home/a')).toBe('~/Projects/x')
  expect(tildify('/home/a', '/home/a')).toBe('~')
  expect(tildify('/home/ab', '/home/a')).toBe('/home/ab')
  expect(tildify('/srv/x', undefined)).toBe('/srv/x')
})
