# Following Omarchy's current theme from the mod (Claude Code 2.1.291)

Scope: issue #77, a research child of map #72 ("Sidebar contrast from Omarchy palettes"). Can the ctui mod find out which Omarchy theme is current, hear when it changes, and switch the person's Claude Code theme to a `custom:*` theme? Every claim below cites a primary source or the spike run. **Unverified** marks anything neither of them settles.

**Source keys**

- **DTS Ln**: `.claude-plugin/types/claude-code/index.d.ts`, which Claude Code **2.1.291** wrote into the spike mod when it loaded it (header: "Written by Claude Code 2.1.291"). The repo's `vendor/claude-code-types/` still holds the 2.1.288 copy. Every API cited here reads the same in both, apart from line numbers.
- **HOOKS Ln**: `https://code.claude.com/docs/en/hooks.md`, fetched 2026-10-06.
- **BIN**: `strings` of the 2.1.291 binary (`~/.local/share/mise/installs/claude/2.1.291/claude`), compared with the pinned 2.1.288 binary in `node_modules/@anthropic-ai/claude-code-linux-x64/claude`.
- **OM:x**: the Omarchy 4.0.4 script `/usr/share/omarchy/bin/x`.
- **S**: the live spike (§5). The `r77` mod is in `prototypes/research-77/`, which is gitignored and lives only in the research worktree.

## 1. Answers

| Question | Answer |
|---|---|
| 1. Read a file outside the project | **Yes.** `$.fs.read` takes an absolute path, and only an `fs.*` hook limits where it can go. Get the home folder from `$.env.get('HOME')`, because `~` is not expanded. `$.process.run(['cat', …])` works too, but it isn't needed. `claude plugin validate --strict` passes on 2.1.291 and on 2.1.288. |
| 2. Hear about a change | **Yes, with no polling needed:** return `watchPaths` from a `classic.SessionStart` hook, and `classic.FileChanged` fires within about 0.6 s of Omarchy's write, including Omarchy's whole-folder swap. A `$.clock.every` stat poll also works as a fallback. The mod gets no theme-change event, and no API returns the theme's colors. `$.config.list()` and `$.settings.read()` give only the theme's *name* (`custom:omarchy`). |
| 3. Switch Claude Code to a `custom:*` theme | **No, through the API: still refused on 2.1.291.** `$.config.set({ key: 'theme', value: 'custom:omarchy' })` returns `{ deny: "takes one of: auto, dark, light, light-daltonized, dark-daltonized, light-ansi, dark-ansi" }`. Writing `~/.claude/settings.json` with `$.fs.write` does store the value, but the running session keeps its current colors; only new sessions use it. |

For Omarchy users this matters less than it looks. `omarchy-theme-set` already copies its generated `claude.json` to `~/.claude/themes/omarchy.json`, and Claude Code hot-reloads that file. A person whose theme is `custom:omarchy` therefore sees the Sidebar's theme-key colors follow Omarchy live, and the mod has nothing to do. The mod only needs to read Omarchy's files when it wants values that theme keys don't expose, for example to compute a dock color from the palette.

## 2. What Omarchy writes, and in what order

`omarchy-theme-set <name>` (OM:omarchy-theme-set):

1. Builds the new theme in `~/.local/state/omarchy/current/next-theme/`, runs `omarchy-theme-set-templates` (which generates `claude.json` among other files), then swaps the folder in with `rm -rf "$CURRENT_THEME_PATH"` and `mv "$NEXT_THEME_PATH" "$CURRENT_THEME_PATH"`. The `theme/` folder is a new inode after every switch.
2. Writes the slug (`solitude`) to `~/.local/state/omarchy/current/theme.name` with `echo … >`. This is the clearest "name changed" signal.
3. Runs the post-theme hooks in parallel, among them `omarchy-theme-set-claude` (OM:omarchy-theme-set-claude). It copies `theme/claude.json` to `${CLAUDE_CONFIG_DIR:-$HOME/.claude}/themes/omarchy.json` through a temp file and `mv`. Its comment reads: "Claude Code watches ~/.claude/themes and hot-reloads the file on change, so running sessions retint without a restart." It writes `"theme": "custom:omarchy"` into `settings.json` only with `--activate`.

`claude.json` has Claude Code's `{ name: "Omarchy", base: "dark", overrides }` shape and 37 keys. It has no `composerSidebarBackground` (checked on the `solitude` theme). The other files in the folder (`colors.toml` and so on) hold the full Omarchy palette.

## 3. Reading the files (question 1)

- **API.** "An absolute path is used as given; where one may go is an `fs.*` hook's to say. A read or write over 4 MiB rejects" (DTS L3151-3153). `$.fs.read`, `$.fs.stat` and `$.fs.list` are under `fs:` (DTS L3155ff.). Nothing in the engine limits mod reads to the project.
- **Home folder.** `$.fs` doesn't expand `~` (DTS L3151: "used as given"). The spike read `HOME` with `$.env.get('HOME')`, which `validate` lists as `env reads: HOME`. Omarchy itself hard-codes `$HOME/.local/state/omarchy` (OM:omarchy-theme-set), so `XDG_STATE_HOME` doesn't apply.
- **Child process.** `$.process.run(argv, init)` runs a host command without a shell, CLI only (DTS L3430ff.). In the spike, `$.process.run(['cat', '<home>/.local/state/omarchy/current/theme.name'])` returned `{"exitCode":0,"stdout":"solitude\n"}` (S). `$.fs.read` is enough, and MEMORY.md already keeps ctui free of child processes.
- **Validation.** The spike mod uses `$.fs.read/stat/write`, `$.process.run`, `$.env.get('HOME')`, `$.config.list/set`, `$.settings.read`, `$.clock.every` and the `classic.SessionStart`, `classic.FileChanged` and `classic.ConfigChange` hooks. `claude plugin validate r77 --strict` printed `✔ Validation passed` on 2.1.291 and on the pinned 2.1.288. It listed the calls and noted "gating hook without .catch" for each classic hook, as information rather than a warning (S).
- **Live read.** At `session.start` the spike read `theme.name` = `solitude` and `theme/claude.json` `overrides.claude` = `#798186` (S).

## 4. Hearing about a change (question 2)

### 4.1 `watchPaths` plus `classic.FileChanged` (event-driven)

- **API.** A mod's `classic.SessionStart` hook may return `watchPaths` (`ClassicResultFields.SessionStart`, DTS L1314; the field is "`hookSpecificOutput.watchPaths` (SessionStart)", DTS L1260-1262). The docs define it as an "Array of absolute paths to watch for FileChanged events during this session" (HOOKS L1174). `FileChanged` input is `{ file_path, event: 'change' | 'add' | 'unlink' }` (DTS L4721ff.). The watcher is a filesystem watcher and fires "no matter what changed the file: … or a process outside Claude Code entirely" (HOOKS L2898).
- **Spike, all on 2.1.291 (S).** The mod returned `watchPaths` for `theme.name`, `theme/claude.json` and `~/.claude/themes/omarchy.json`:
  - `echo solitude > theme.name` gave `classic.FileChanged {"file_path":".../theme.name","event":"change"}` within 1 s of the write, about 0.2 s after the 1 s stat poll caught the new mtime.
  - Omarchy's folder swap, replayed by building a copy with `claude` set to `#ff0000`, then `mv theme theme.tmp && mv next theme`, gave `FileChanged … theme/claude.json "change"` 0.6 s later. The watch follows the path, not the old inode. Swapping back fired again.
  - A temp-file-plus-`mv` write of `~/.claude/themes/omarchy.json`, as `omarchy-theme-set-claude` does it, gave `FileChanged … themes/omarchy.json "change"` 0.6 s later. Claude Code also hot-reloaded the theme: with `promptBorder` set to `#ff0000`, the prompt rules turned 256-color 196 in the running session without any mod action.
  - After a hot reload of the mod (the `● r77: reloaded` row), `classic.SessionStart` did **not** fire again, yet the next `theme.name` write still raised `FileChanged`. The engine keeps the watch list across mod reloads.
- **Caveats.**
  - Only `SessionStart` lets a mod return `watchPaths`. `CwdChanged` and `FileChanged` aren't in the mod's `ClassicResultFields` (DTS L1314ff.).
  - A *settings* `CwdChanged` or `FileChanged` hook that returns `watchPaths` "Replaces the current dynamic watch list" (HOOKS L2844, L2967). Another tool's hook could therefore drop ctui's paths for the rest of the session. **Unverified** live.
  - Whether `watchPaths` survives `/clear` and `/resume` is **unverified**. `classic.SessionStart` fires with `source` `clear` or `resume`, so returning the paths again on every source covers it.
  - The three paths must exist when they are registered. Whether a missing path (no Omarchy) is harmless is **unverified**; check with `$.fs.exists` first.

### 4.2 `$.clock.every` stat poll (fallback)

- `$.clock.every(ms, fn)` runs until cancelled (DTS L3358ff., L3396). The spike polled `$.fs.stat(theme.name).mtimeMs` and `theme/claude.json` every 1 s and saw every change listed in 4.1 within one tick (S). ctui already runs a 1 s tick (MEMORY.md, `mcp`/`todo`), so one extra `stat` per tick costs little and survives anything that clears `watchPaths`.

### 4.3 What the mod can see of Claude Code's own theme

- **Name only.** `$.config.list()` returns a `theme` row `{"value":"custom:omarchy","options":["auto","dark","light","light-daltonized","dark-daltonized","light-ansi","dark-ansi"],"kind":"choice"}`. `$.settings.read()` and `$.settings.read({ source: 'user' })` both return `theme: "custom:omarchy"` (S).
- **No values.** The 2.1.291 types have no call that returns theme colors. A color prop is "a theme key, which follows the person's theme, or … a raw color" (DTS L1628-1634), and `ThemeKey` lists the 23 named keys (DTS L12249-12255). `$.ui.resolve` gives the element table only. To use a value, the mod has to read the theme JSON itself: `~/.claude/themes/omarchy.json`, or Omarchy's `theme/claude.json`, which holds the same content.
- **No event on a theme-file hot reload.** Rewriting `~/.claude/themes/omarchy.json` raised only the mod's own `FileChanged`. It raised no `classic.ConfigChange`, whose `source` is one of `user_settings | project_settings | local_settings | policy_settings | skills` (DTS L1862ff.), and no `config.set`. The `theme` row's value stays `custom:omarchy` across palette changes (S).
- **A settings change is visible.** When `theme` changed in `~/.claude/settings.json`, `classic.ConfigChange {"source":"user_settings","file_path":"…/settings.json"}` fired within 1 s, and the `config.list()` row followed (S).

## 5. Switching Claude Code's theme (question 3)

- **`$.config.set` still refuses `custom:*` on 2.1.291.** `/r77 set custom:omarchy` returned `{"deny":"takes one of: auto, dark, light, light-daltonized, dark-daltonized, light-ansi, dark-ansi"}`, the same as #12 on 2.1.288 (S). The `config.set` hook saw `{"key":"theme","value":"custom:omarchy","previous":"custom:omarchy","provider":{"plugin":"engine","tier":"core"},"origin":{"kind":"plugin","name":"r77"}}` before the refusal. The calling plugin's own `config.set` hook fired, although DTS says "that plugin's own hooks do not see it".
- **Why, from the binary.** The `/config` `theme` row is `{id:"theme",…,type:"managedEnum",options:<the seven built-ins>,optionsHint:"For custom themes, use /theme.",…}`, and the choice check returns `` `takes one of: ${r.join(", ")}` `` for any value outside `options`. The code is identical in 2.1.288 and 2.1.291 apart from minified names (BIN).
- **Built-ins are accepted but don't repaint.** `/r77 set light` returned `{"value":"light"}` and wrote `"theme": "light"` to `settings.json`. The running session kept the Omarchy colors (unchanged 256-color codes in the capture), while a new session started after it came up light (S). This is **unverified** beyond that one run; #12 saw the person's `/theme` pick repaint live.
- **Writing `settings.json` directly.** `$.fs.write` of `~/.claude/settings.json` with `theme: "dark"` or `"light"` (the same as `omarchy-theme-set-claude --activate`) fired `ConfigChange` and changed the `config.list()` row, but the running session did not repaint. A new session used the written value (S). So a mod *can* store `custom:<x>` this way for later sessions, bypassing the `/config` refusal, but it would be rewriting the person's own settings file.

## 6. Spike (S)

- **Setup.** Claude Code 2.1.291 (`claude --version`), tmux 160×45 with `tmux-256color`, `claude --plugin-dir ./r77` in `prototypes/research-77/`, on 2026-10-06. The installed `ctui@claude-tui` was enabled alongside. The person's theme was `custom:omarchy`, and Omarchy's theme was `solitude`.
- **The `r77` mod.** It records a snapshot every 1 s (`theme.name` text and mtime, `claude.json` `overrides.claude`, the `config.list()` `theme` row, merged and user `settings.read().theme`) and logs changes. `classic.SessionStart` returns `watchPaths`. It logs `classic.FileChanged`, `classic.ConfigChange` and `config.set`. `/r77 set <v>` calls `$.config.set`, `/r77 write <v>` rewrites `settings.json`, and `/r77 proc` runs `cat`.
- **Steps.** Rewrote `theme.name` with the same slug; replayed the folder swap with an edited `claude.json` and swapped back; rewrote `~/.claude/themes/omarchy.json` by temp file and `mv`; ran `/r77 set custom:omarchy`, `/r77 proc`, `/r77 write dark`, `/r77 write light`, `/r77 set light`; started a second session to see the stored theme. Afterwards `~/.claude/settings.json` was restored from a backup and checked byte-equal with `cmp`, `~/.claude/themes/omarchy.json` was checked equal to `theme/claude.json`, and Omarchy's `theme/` was put back unchanged.
- **Not run.** The real `omarchy-theme-set`, because it also rotates the desktop background and restarts apps. The replay follows its `rm`/`mv`/`echo` order (§2) instead.
