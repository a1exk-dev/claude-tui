import type { EngineInterface, Register } from 'claude-code'

import { plugins } from '../plugins'
import type { GitSnapshot } from '../types'
import { readConfig } from './config'
import { parseGit, tildify } from './git'
import { sidebar } from './sidebar'

const SIDEBAR = 'sidebar'
const FOLDED = { plugin: 'ctui', key: 'folded' } as const
const EXPANDED = { plugin: 'ctui', key: 'expanded' } as const
const SCROLL = { plugin: 'ctui', key: 'scroll' } as const
const GIT = { plugin: 'ctui', key: 'git' } as const
const VERSIONS = { plugin: 'ctui', key: 'versions' } as const

// The dock docks from 110 terminal columns; the Sidebar asks 42, or 53 from 160.
const DOCK_COLUMNS = 110
const widthFor = (terminalColumns: number) => (terminalColumns >= 160 ? 53 : 42)

const GIT_TOOLS = new Set(['Edit', 'Write', 'NotebookEdit', 'Bash'])

// Module state: a reload starts a fresh environment.
let tick: { cancel: () => void } | undefined
let gitRunning = false
let gitAgain = false // a refresh came while git ran: run once more after it
let checking = false // a viewport check is queued
let waiting = false // opened unasked and not placed: open again on the person's prompt
let requested: number | undefined // the columns last asked for
let maxScroll = 0 // the sections window's last offset, as last drawn

// A run still going takes this refresh as one more run after it ends.
async function refreshGit($: EngineInterface) {
  if (gitRunning) {
    gitAgain = true
    return
  }
  gitRunning = true
  try {
    const run = (args: string[]) => $.process.run(['git', '--no-optional-locks', ...args]).catch(() => undefined)
    const git: GitSnapshot = { path: tildify(await $.session.cwd(), await $.env.get('HOME')) }
    const status = await run(['status', '--porcelain=v2', '--branch'])
    if (status?.exitCode === 0) {
      // On an unborn branch the numstat fails: it counts as 0.
      const [stash, numstat] = await Promise.all([run(['stash', 'list']), run(['diff', '--numstat', 'HEAD'])])
      const out = (result: typeof stash) => (result?.exitCode === 0 ? result.stdout : '')
      git.repo = parseGit(status.stdout, out(stash), out(numstat))
    }
    const { value } = await $.state.get(GIT)
    if (JSON.stringify(value) !== JSON.stringify(git)) await $.state.set(GIT, git)
  } finally {
    gitRunning = false
  }
  if (gitAgain) {
    gitAgain = false
    await refreshGit($)
  }
}

async function loadVersions($: EngineInterface) {
  const manifest = JSON.parse(await $.fs.read(`${$.plugin.root}/.claude-plugin/plugin.json`))
  const versions = { ctui: String(manifest.version), claude: (await $.session.version()).version }
  const { value } = await $.state.get(VERSIONS)
  if (JSON.stringify(value) !== JSON.stringify(versions)) await $.state.set(VERSIONS, versions)
}

async function openSidebar($: EngineInterface, columns: number) {
  requested = columns
  const opened = await $.ui.open({ id: SIDEBAR, title: 'Sidebar', columns })
  waiting = !opened.isPlaced
}

export const register: Register = (on, options) => {
  const config = readConfig(options)
  const enabled = plugins.filter((plugin) => config[plugin.id].enable)
  const needs = new Set(enabled.flatMap((plugin) => plugin.needs))

  on('session.start', async ($, e, next) => {
    if (needs.has('git')) void refreshGit($)
    if (needs.has('versions')) void loadVersions($)
    let ticks = 0
    tick?.cancel()
    tick = $.clock.every(1000, () => {
      ticks++
      if (ticks % 5 === 0 && needs.has('git')) void refreshGit($)
    })
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    try {
      return await next(e)
    } finally {
      if (needs.has('git') && GIT_TOOLS.has(e.tool)) void refreshGit($)
    }
  })

  // MEMORY.md "The Sidebar shows only when docked": watch an always-drawn site
  // and open the pane once the terminal can dock it. Observe only.
  on('ui.render', { component: 'SessionMode' }, ($, e, next) => {
    const viewport = e.viewport
    if (viewport?.isFullscreen === true && viewport.columns >= DOCK_COLUMNS && !checking) {
      checking = true
      $.clock.after(0, async () => {
        try {
          // Open or waiting: the pane is placed, or the engine places it as the terminal widens.
          if (!(await $.ui.panes()).some((pane) => pane.id === SIDEBAR)) {
            await openSidebar($, widthFor(viewport.columns))
          }
        } finally {
          checking = false
        }
      })
    }
    return next(e)
  })

  // An open from the person's prompt counts as asked: it docks from 110 columns.
  on('prompt.submit', ($, e, next) => {
    if (waiting && e.origin.kind === 'composer') void openSidebar($, requested ?? widthFor(DOCK_COLUMNS))
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: SIDEBAR }, async ($, e) => {
    const ui = $.ui.resolve(e)
    if (e.props.placement === 'inline') {
      $.clock.after(0, () => void $.ui.close({ id: SIDEBAR }))
      return <ui.Box />
    }
    waiting = false
    if (e.viewport) {
      // The viewport here is the transcript's width.
      const columns = widthFor(e.viewport.columns + e.props.bodyColumns + 1)
      if (columns !== requested) {
        requested = columns
        $.clock.after(0, () => void openSidebar($, columns))
      }
    }
    const [folded, expanded, scroll, git, versions] = await Promise.all([
      $.state.get(FOLDED),
      $.state.get(EXPANDED),
      $.state.get(SCROLL),
      $.state.get(GIT),
      $.state.get(VERSIONS),
    ])
    const drawn = sidebar({
      ui,
      bodyRows: e.props.scroll.bodyRows,
      plugins: enabled,
      data: { git: git.value, versions: versions.value },
      config,
      folded: folded.value ?? {},
      expanded: expanded.value ?? {},
      scroll: scroll.value ?? 0,
      onFold: async (id) => {
        const { value = {} } = await $.state.get(FOLDED)
        await $.state.set(FOLDED, { ...value, [id]: !(value[id] ?? config[id].folded ?? false) })
      },
      onExpand: async (id) => {
        const { value = {} } = await $.state.get(EXPANDED)
        await $.state.set(EXPANDED, { ...value, [id]: !value[id] })
      },
    })
    maxScroll = drawn.maxScroll
    return drawn.tree
  })

  // The person can't close the Sidebar; a plugin close passes.
  on('ui.close', { id: SIDEBAR }, ($, e, next) =>
    e.origin.kind === 'person' ? { deny: 'The ctui Sidebar stays open while it is docked' } : next(e),
  )

  // The mod scrolls the sections itself; the engine's window never moves.
  on('ui.scroll', { component: 'Pane', requestId: SIDEBAR }, async ($, e) => {
    const { value = 0 } = await $.state.get(SCROLL)
    const from = Math.min(value, maxScroll)
    const offset = Math.min(Math.max(from + e.by, 0), maxScroll)
    if (offset !== value) await $.state.set(SCROLL, offset)
    return {}
  })
}
