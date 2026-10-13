# Live-check harness

Drives the pinned Claude Code (`node_modules/.bin/claude --plugin-dir ./ctui`) in a **bare pty** and reads the
screen back cell by cell: text, background runs, per-cell `fg`/`bg`, bold and underline. No tmux — tmux
under-reports painted blank cells and never delivers ctrl+x x.

Four modules, all under `.claude/skills/live-checks/harness/`:

| File | What it holds |
|---|---|
| `harness.ts` | the `seed`, `once`, `serve` and `send` commands |
| `screen.ts` | `dump`, `dumpbg`, `cells`, `runs`, `grep` over the parsed screen |
| `steps.ts` | the step vocabulary below |
| `config.ts` | seeds a signed-in `CLAUDE_CONFIG_DIR` under `$TMPDIR` |
| `fixtures/mcp-server.ts` | a stdio MCP server with a named tool count and a startup delay |

One-time, per checkout: `npm install-scripts approve node-pty`, then `npm install`. npm gates node-pty's build
script. `node scripts/check.ts` never starts the harness, so CI needs neither step.

## Seed a config dir

    node .claude/skills/live-checks/harness/harness.ts seed <scenario> \
      [--settings '<json>'] [--claude-json '<json>'] [--trust <dir>]

Prints the new dir. It holds the operator's own sign-in copied at mode 0600, a `settings.json`
(`tui: fullscreen`, `theme: dark`, `CLAUDE_CODE_TMUX_TRUECOLOR=1`, with `--settings` merged over it) and a
`.claude.json` with onboarding complete and this checkout trusted. **Nothing signed-in is ever written into the
repo**; the dir lives under `$TMPDIR` and grows to about 24 MB. Delete it on pass (`rm -rf`), keep it on failure
and name its path in the report.

## Run a scenario

One-shot, when every step is known up front:

    node .claude/skills/live-checks/harness/harness.ts once <configDir> <cols> <rows> <steps-file> \
      [--cwd <dir>] [--env K=V] [--plugin-key <key>] [-- <claude args>]

Interactive, when a step depends on what the last one showed — the usual shape, and one boot per scenario:

    S=<scratch dir>
    rm -f $S/fifo $S/out
    node .claude/skills/live-checks/harness/harness.ts serve <configDir> 150 45 $S/fifo $S/out &
    printf 'wait 20\ngrep Context:\n' | node .claude/skills/live-checks/harness/harness.ts send $S/fifo $S/out 4

`send` writes the steps on its stdin to the fifo, waits that many seconds, and prints what the session appended
to `<out>`. End every session with a `quit` step; `pkill -f 'harness.ts serve'` is the fallback.

`--cwd` is the directory the session runs in (the checkout by default; pass a scratch repo and `--trust` it when
seeding). `--env K=V` adds one variable to the child. `--plugin-key` is the `pluginConfigs` key `setopt` writes,
`ctui@inline` under `--plugin-dir`. Everything after `--` goes to `claude`, such as
`-- --settings '{"tui":"default"}'`. The child's env is scrubbed of the parent's `CLAUDE*` and `TMUX*`.

## Steps

One step per line, `#` comments and blank lines skipped. Each prints its own echo, its lines, then `--- ok`.

| Step | What it does |
|---|---|
| `wait <s>` | read the child's output for that long |
| `type <text>` | type text (no Enter) |
| `enter` | press Enter, submitting a prompt |
| `key <escaped>` | send bytes, written with `\x1b[B`, `\x18\t`, `\e`, `\n`, `\r`, `\t` escapes |
| `click <col> <row>` | SGR mouse press and release at 0-based col,row |
| `move <col> <row>` | move the pointer there, for a hover |
| `wheel <col> <row> up\|down` | one wheel notch there |
| `resize <cols> <rows>` | resize the pty and the screen together; the child gets SIGWINCH |
| `setopt <key>=<json>` | write a ctui option into the seeded `settings.json`, which reloads the mod as `/config` does |
| `setting <key>=<json>` | write a top-level setting the same way |
| `sh <command>` | run a shell command on the side and print its output |
| `dump` | every row as numbered text |
| `dumpbg` | every row as its background runs, `<color>:<first>-<last>`, where a color is `#rrggbb`, `idx<n>` or `default` |
| `cells <row> <a> <b>` | per-cell `fg`, `bg`, `b` (bold) and `u` (underline) over a column range |
| `runs <row>` | one row as its `fg`/`bg`/`b`/`u` runs with each run's text — how a theme role is read |
| `grep <text>` | the numbered rows holding that text |
| `watch <timeout-s> <text>` | wait for text to appear and print the **measured ms**, or `NOT FOUND` |
| `anim <count> <interval-s> <text>` | sample the rows holding that text over time, for a spinner |
| `print <text>` | label the output |
| `quit` | stop the child and end the session |

A step that throws prints `!! <message>` and the session stays up: a mistyped step must not cost another boot.

## Geometry

Measured on the pin at 45 rows, with no dragged or keyed `dockColumns`:

| Terminal | Frame rule | Sidebar body | Body width | A section rule spans |
|---|---|---|---|---|
| 150 cols | col 107 | cols 108–149 | 42 | cols 110–147 |
| 170 cols | col 116 | cols 117–169 | 53 | cols 117–167 |

Content sits 2 columns inside the body, so a count or a folded summary ends 2 columns before the frame. The
Sidebar asks for 42 columns from 144 and 53 from 160; below 110 it does not dock. `dockColumns` in `.claude.json`
overrides both. Read the body off the cell grid with `dumpbg` or `cells`, never from ctui's request.

## Theme facts

- Built-in `dark`: `text` `#ffffff`, `inactive` `#999999`, `subtle` `#505050`, `success` `#4eba65`,
  `warning` `#ffc107`, `error` `#ff6b80`, `suggestion` `#b1b9f9`, dock background `#262626`.
- ctui Everforest paints the body one flat `#363d41`, Catppuccin Latte `#e5e7ed`. Under `inherit` the body takes
  the `/theme`'s dock color, so no frame shows. Under `inherit` on `custom:omarchy` it is the Omarchy theme's
  background mixed 6% toward its foreground (`#373e42` for Everforest).
- Flexoki Light draws fold arrows in `#706e69` and a hovered arrow in `#205ea6`.
- The engine adds SGR underline (`u=1`) to every hovered cell. ctui neither asks for it nor can suppress it.

## Cost and care

- A prompt costs 20–35 s and real tokens. Prefer checks that need no model turn, and batch the ones that do.
- One seeded dir and one engine boot per scenario: resizes, `/theme`, `setopt` and folds all happen inside the
  session.
- Never touch the operator's tmux sessions, never run `omarchy theme set`, never edit the repo from a step.
