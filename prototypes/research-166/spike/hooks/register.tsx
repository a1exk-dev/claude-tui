import type { Register } from 'claude-code'

// PROTOTYPE, throw away. Issue 166: does an open /ctui-style menu pane survive
// the reload every $.config.set causes? Claude Code 2.1.292.
const LOG = '__LOG__'
const GEN = Math.random().toString(36).slice(2, 6) // one per module load
async function note($: any, s: string) {
  let old = ''
  try { old = await $.fs.read(LOG) } catch { /* first line */ }
  try { await $.fs.write(LOG, `${old}${new Date().toISOString().slice(11, 23)} [${GEN}] ${s}\n`) } catch { /* ignore */ }
}

const MENU = { plugin: 'r166', key: 'menu' } as const
type Level = 'top' | 'plugins' | 'themes' | 'limits'
type Menu = { level: Level; filter: string; hl: Partial<Record<Level, string>> }
const START: Menu = { level: 'top', filter: '', hl: {} }
const PARENT: Record<Level, Level | undefined> = { top: undefined, plugins: 'top', themes: 'top', limits: 'plugins' }
const PLUGINS = ['context', 'limits', 'mcp', 'todo']
const SLUGS = ['catppuccin', 'catppuccin-latte', 'ethereal', 'everforest', 'flexoki-light', 'gruvbox', 'hackerman', 'kanagawa', 'matte-black', 'miasma', 'nord', 'osaka-jade', 'ristretto', 'rose-pine', 'tokyo-night', 'vantablack']
const REOPEN = false // true: let the close happen and reopen; false: refuse with { deny }
let level: Level = 'top' // sync mirror of menu.level for ui.close
const title = (s: string) => s.split('-').map((w) => w[0]!.toUpperCase() + w.slice(1)).join(' ')

async function menu($: any): Promise<Menu> {
  return (await $.state.get(MENU)).value ?? START
}
async function setMenu($: any, m: Menu) {
  level = m.level
  await $.state.set(MENU, m)
  await note($, `menu -> ${JSON.stringify(m)}`)
}
async function set($: any, key: string, value: unknown) {
  const t = Date.now()
  const r = await $.config.set({ key: `r166.${key}`, value })
  await note($, `config.set ${key}=${JSON.stringify(value)} -> ${JSON.stringify(r)} in ${Date.now() - t}ms`)
}

export const register: Register = (on, options: any) => {
  on('session.start', async ($: any, e: any, next: any) => {
    await note($, `session.start options=${JSON.stringify(options)} panes=${JSON.stringify(await $.ui.panes())} menu=${JSON.stringify((await $.state.get(MENU)).value)}`)
    level = (await menu($)).level
    try {
      await note($, `register -> ${JSON.stringify(await $.command.register({ name: 'r166', description: 'r166: ctui menu probe', immediate: true }))}`)
    } catch (err) {
      await note($, `register threw ${String(err)}`)
    }
    return next(e)
  })

  on('command.run', { command: 'r166' }, async ($: any, e: any) => {
    if (e.args.trim() === 'closeme') { await $.ui.close({ id: 'menu' }).catch((x: any) => note($, `close threw ${x}`)); await note($, `closeme panes=${JSON.stringify(await $.ui.panes())}`); return {} }
    await note($, `run r166 pres=${JSON.stringify(e.presentation)}`)
    await setMenu($, START)
    const esc = e.args.trim() !== 'noesc'
    const r = await $.ui.open({ id: 'menu', title: 'ctui', focus: true, ...(esc && { closeOnEscape: true }), columns: 42 })
    await note($, `open -> ${JSON.stringify(r)}`)
    return {}
  })

  on('ui.render', { component: 'Pane', requestId: 'menu' }, async ($: any, e: any) => {
    const { Box, Text, Select, Input } = $.ui.resolve(e)
    const m = await menu($)
    const head = (s: string) => <Text dimColor>{s} [{GEN}]</Text>
    const sel = (key: string, opts: { value: string; label?: string }[], hl?: string) => (
      <Select key={key} options={opts} {...(hl && opts.some((o) => o.value === hl) && { value: hl })} autoFocus onSelect={() => undefined} />
    )
    let body
    if (m.level === 'top') {
      body = <>{head('ctui')}{sel('top', [{ value: 'plugins', label: 'Plugins ›' }, { value: 'themes', label: 'Themes ›' }, { value: 'noop', label: 'no-op (no reload)' }], m.hl.top)}</>
    } else if (m.level === 'plugins') {
      const opts = PLUGINS.map((id) => ({ value: id, label: `${options[`${id}_enable`] ? '●' : '○'} ${id}` })).concat([{ value: 'open:limits', label: '  limits settings ›' }])
      body = <>{head('ctui › Plugins  (enter toggles)')}{sel('plugins', opts, m.hl.plugins)}</>
    } else if (m.level === 'limits') {
      body = (
        <>
          {head('ctui › Plugins › limits')}
          {sel('cost', ['auto', 'on', 'off'].map((v) => ({ value: v, label: `cost ${v}${options.limits_cost === v ? '  ✓' : ''}` })), m.hl.limits ?? options.limits_cost)}
          <Input key="monthly" label="monthly $ " value={String(options.limits_cost_monthly)} onSubmit={() => undefined} />
        </>
      )
    } else {
      const shown = ['inherit', ...SLUGS].filter((s) => !m.filter || title(s).toLowerCase().includes(m.filter.toLowerCase()))
      body = (
        <>
          {head('ctui › Themes')}
          <Input key="filter" label="filter " placeholder="type to filter" value={m.filter} autoFocus onInput={() => undefined} onSubmit={() => undefined} />
          {shown.length
            ? <Select key="themes" options={shown.map((s) => ({ value: s, label: `${s === 'inherit' ? 'inherit' : title(s)}${options.theme === s ? '  ✓' : ''}` }))} {...((m.hl.themes ?? options.theme) && shown.includes(m.hl.themes ?? options.theme) && { value: m.hl.themes ?? options.theme })} onSelect={() => undefined} />
            : <Text dimColor>no match</Text>}
        </>
      )
    }
    return <Box flexDirection="column" paddingX={2} paddingY={1}>{body}</Box>
  })

  on('ui.select', { requestId: 'menu' }, async ($: any, e: any, next: any) => {
    await note($, `select ${e.element}=${e.value}`)
    const r = await next(e) // run the Select's handler before a redraw drops it
    const m = await menu($)
    if (e.element === 'top' && e.value === 'noop') {
      await setMenu($, { ...m, hl: { ...m.hl, top: e.value } })
    } else if (e.element === 'top') {
      await setMenu($, { ...m, level: e.value, filter: '', hl: { ...m.hl, top: e.value } })
    } else if (e.element === 'plugins') {
      await setMenu($, { ...m, ...(e.value === 'open:limits' && { level: 'limits' as Level }), hl: { ...m.hl, plugins: e.value } })
      if (e.value !== 'open:limits') await set($, `${e.value}_enable`, !options[`${e.value}_enable`])
    } else if (e.element === 'cost') {
      await setMenu($, { ...m, hl: { ...m.hl, limits: e.value } })
      await set($, 'limits_cost', e.value)
    } else if (e.element === 'themes') {
      await setMenu($, { ...m, hl: { ...m.hl, themes: e.value } })
      await set($, 'theme', e.value)
    }
    return r
  })

  on('ui.focus', { requestId: 'menu' }, async ($: any, e: any, next: any) => {
    await note($, `focus ${JSON.stringify({ element: e.element, origin: e.origin })}`)
    return next(e)
  })

  on('ui.input', { requestId: 'menu' }, async ($: any, e: any, next: any) => {
    await note($, `input ${e.element} ${e.kind} ${JSON.stringify(e.value)}`)
    const r = await next(e)
    const m = await menu($)
    if (e.element === 'filter' && e.kind === 'change') await setMenu($, { ...m, filter: e.value })
    if (e.element === 'monthly' && e.kind === 'submit') {
      const n = Number(e.value)
      if (Number.isFinite(n) && e.value.trim() !== '') await set($, 'limits_cost_monthly', n)
      else await note($, `monthly: not a number`)
    }
    return r
  })

  // Sync refusal: decide from a module-level copy of the level, write state later.
  on('ui.close', ($: any, e: any, next: any) => {
    const up = PARENT[level]
    if (e.id === 'menu' && e.origin.kind !== 'unload' && up) {
      const from = level
      level = up
      $.clock.after(0, async () => {
        await note($, `ui.close ${JSON.stringify(e)} refused sync from ${from}`)
        const m = await menu($)
        await setMenu($, { ...m, level: up, filter: '' })
        if (e.origin.kind === 'person' && REOPEN) await note($, `reopen -> ${JSON.stringify(await $.ui.open({ id: 'menu', title: 'ctui', focus: true, closeOnEscape: true, columns: 42 }))}`)
        if (!REOPEN) {
          const key = up === 'top' ? 'top' : up === 'plugins' ? 'plugins' : 'themes'
          await note($, `refocus ${key} -> ${JSON.stringify(await $.ui.focus({ requestId: 'menu', key }).catch((x: any) => String(x)))}`)
          await note($, `panes ${JSON.stringify(await $.ui.panes())}`)
          if (!(await $.ui.panes()).some((p: any) => p.isFocused)) await note($, `reopen-focus -> ${JSON.stringify(await $.ui.open({ id: 'menu', title: 'ctui', focus: true, closeOnEscape: true, columns: 42 }))}`)
        }
        $.clock.after(300, async () => note($, `after refused close panes=${JSON.stringify(await $.ui.panes())}`))
      })
      return REOPEN ? {} : { deny: 'back one level' }
    }
    $.clock.after(0, () => note($, `ui.close ${JSON.stringify(e)} passed (level ${level})`))
    return next(e)
  })
}
