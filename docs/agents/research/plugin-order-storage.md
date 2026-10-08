# Where ctui can save a Sidebar plugin order (Claude Code 2.1.292)

Question (#161, map #158): on the pinned Claude Code 2.1.292, where can ctui save a Sidebar plugin order the person sets in a picker, so that it counts as ctui's settings and survives restarts?

Every claim cites a primary source or a spike run. **Unverified** marks what neither settles.

**Source keys**

- **DTS Ln**: `vendor/claude-code-types/claude-code/index.d.ts`, headed "Written by Claude Code 2.1.292". The engine writes the same file into a loaded mod at `.claude-plugin/types/claude-code/index.d.ts`.
- **SKR**: the bundled `plugin-authoring/reference.md` (2.1.292), line 70 on `userConfig` and `/config`.
- **MR**: `https://code.claude.com/docs/en/plugins/manifest-reference.md`, section "User configuration", fetched 2026-10-08.
- **SR**: `https://code.claude.com/docs/en/settings-reference.md`, section `pluginConfigs`, fetched 2026-10-08.
- **S**: the live spike `prototypes/research-161/` (gitignored). A `--plugin-dir` plugin `r161` declared three fields: `order` (`string`, no `options`, default `git,context,limits,mcp,todo,agents,versions`), `order_list` (`string`, `multiple: true`), and `mcp_position` (`number`, `min: 1`, `max: 7`). A `/r161:probe` command called `$.config.set`, `$.config.list` and `$.store`, and logged the `options` it received. It ran in tmux on 2.1.292 with `--model haiku`. `log.txt` and `capture-*.txt` hold the results.

## 1. Answer

Use one free `string` `userConfig` field (no `options`) that holds the ids comma-separated, top to bottom. For example `sidebar_order`, defaulting to the registry order. Nothing else meets all three needs: `$.config.set` writes it, it reads back in `options`, and the person can see and edit it in `/config`.

- `$.config.set({ key: 'ctui.<field>', value: 'mcp,git,context,…' })` resolves `{ value }` and writes `settings.json` `pluginConfigs["<plugin>"].options.<field>`. Claude Code prints `● <plugin>: options changed — reloaded`, and the module reloads with the new string in `options` (S). This is the same path `/ctui:plugins:enable|disable` already uses.
- The value survives a restart: a fresh `claude` read it back (S).
- The engine does not check the content. Unknown ids, missing ids and the empty string are all stored as given (S). ctui has to normalize the string itself (§4).

## 2. The free `string` field, as tested

| Action | Result | Source |
|---|---|---|
| Declare `type: "string"` without `options` | `claude plugin validate` passes; `$.config.list()` shows the row as `kind: "text"`, with no `options` | S; DTS L1947 (`text` takes a string) |
| `$.config.set` with a string | `{ value: "mcp,git,context,limits,todo,agents,versions" }`; `options.order` then equals it; one `options changed — reloaded` row | S |
| `$.config.set` with an array | `{ deny: "takes a text" }`; nothing is stored | S |
| `$.config.set` with `"skills,mcp,nope,git"` | `{ value: … }`, stored verbatim: unknown ids pass and missing ids stay missing | S |
| `$.config.set` with `""` | `{ value: "" }`; `options.order` is `""` and **not** the default | S |
| Restart `claude` | `options.order` is still the saved string | S |
| `/config` → search "Sidebar order" | Row `Sidebar order · r161  mcp,git,context ›`. Enter opens a one-field dialog (title, description, field, `Save`). Typed characters edit the field, and Enter saves straight to `settings.json` | S (`capture-config-*.txt`) |
| `/config r161.order=git,mcp` | `⎿ Set Sidebar order to git,mcp`; reloads with that value | S |
| Hand-edit `settings.json` to a number (`"order": 5`) | `● r161: hooks module did not load: options do not fit plugin.json userConfig: Sidebar order must be a string …` | S; DTS L7590-7601 ("validated against the declared `type` before the module loads") |

The `/config` editor is a plain text field. The person can type any order, so a typo becomes ctui's problem, never the engine's.

## 3. Alternatives

### `multiple: true` string list: not usable

- MR: `multiple` "allows an array of strings", and "each option … appears as a row in `/config`, except `sensitive` options and `multiple` lists". `options` (a picker) does not apply to `multiple`.
- S: `$.config.list()` has no `r161.order_list` row, so `$.config.set` throws `no /config row with key r161.order_list`. DTS L3087 says it "Rejects a key no row has".
- `ConfigValue` and `PluginOptions` do allow `readonly string[]` (DTS L7601), but only the install-time "Configure" dialog or a hand edit can write it. A picker can't save it, and `/config` doesn't show it.

### A `number` per Sidebar plugin (`<id>_position`)

- Works as a `/config` `number` row and fits the `<id>_<option>` naming rule. `$.config.set` with `2` → `{ value: 2 }` (S).
- Drawbacks:
  - Out-of-range values: `$.config.set` with `0` against `min: 1` → `{ deny: "MCP position doesn't accept \"0\". It takes a number between 1 and 7." }` (S). A hand-edited value outside `min`/`max` stops the hooks module from loading (MEMORY.md, Limits entry, #148).
  - Ties and gaps: nothing stops two plugins from holding the same number. ctui would still need a tie-break rule.
  - One move rewrites several rows. Moving one plugin shifts every plugin between its old and new slots, so one pick becomes up to N `$.config.set` calls. **Unverified** whether each one reloads the module and prints its own `options changed` row. Every call goes through `config.set` (DTS L3081-3088), so that is likely.
  - Adding the `skills` plugin means a new row and a new `max` on every row. Raising `max` doesn't break saved values, but each new plugin edits every `<id>_position` row.
  - Seven (soon eight) more `/config` rows, and the person has to keep them consistent by hand.

### `$.store`

- DTS L3317-3345: "This plugin's own key-value store, kept between sessions and hot reloads; values are JSON data … A JSON file of the plugin's own under the user's Claude Code configuration directory." On disk it is `~/.claude/plugins/store/<plugin>_<marketplace>-<hash>.json` (S: `r161_inline-….json`, and ctui's own `ctui_claude-tui-….json`).
- It stores an array directly (`["mcp","git","skills"]` read back, S) and survives restarts. ctui already uses it for the Limits cost cache.
- Drawbacks:
  - It is not settings. It doesn't show in `/config`, isn't in `settings.json` (no managed settings, no dotfile sync), and the person can't see or edit it outside ctui's picker. The map's settled line asks for the order to be "saved to ctui's settings".
  - A write doesn't reload the module, so the Sidebar would also need `$.state` to redraw. With `userConfig`, the reload redraws it, as enable/disable already does.
  - Unknown and missing ids still need normalizing.

### Comparison

| | Free `string` | `multiple` list | Number per plugin | `$.store` |
|---|---|---|---|---|
| Written by `$.config.set` | yes | **no** (no row) | yes, one call per plugin | n/a (`$.store.set`) |
| Read back in `options` | yes (string) | yes (array) | yes | no, `$.store.get` |
| Shown and editable in `/config` | yes, text field | **no** | yes, N number rows | **no** |
| One pick = one write | yes | n/a | no | yes |
| Survives restart | yes | yes | yes | yes |
| Bad hand edit | wrong type: module doesn't load; bad content: ctui's to handle | — | out of range: module doesn't load | — |

## 4. Unknown or missing ids

The engine accepts any text in a free `string` field (S), so ctui must read the value defensively. A rule that covers every reachable input (the picker, `/config`, `/config key=value`, a hand edit):

1. Split on `,`, trim each part, and drop empty parts.
2. Keep each known Sidebar plugin id once, in the order given. Drop unknown ids and later duplicates.
3. Append every registry id the value doesn't name, in registry order.

This makes `""` and an all-unknown value fall back to registry order. A plugin added in a later ctui release (such as `skills` in 0.4.0) shows up at its registry slot instead of disappearing. Enablement stays separate (`<id>_enable`), so the order lists every id, disabled ones included. A pure function in `ctui/hooks/config.ts` (`readConfig`) is the natural home: it already regroups the flat options.

Whether to rewrite a value that needed normalizing back to `settings.json` is a design choice. Rewriting would cost a reload and an `options changed` row, so leaving it is simpler (YAGNI).

## 5. Fits with existing rules

- MEMORY.md "Plugin settings are flat `userConfig` keys": the order isn't per-plugin, so it gets a plain key, as `theme` does. The engine requires letters, digits and `_` (MR).
- MEMORY.md "`/ctui:*` commands stay quiet on success": a picker pick that changes the order calls `$.config.set` last and returns quietly. Claude Code's own `options changed — reloaded` row confirms it. Under `claude -p`, `$.config.set` throws, as for the other settings.
- `--plugin-dir` (`ctui@inline`) and the marketplace install (`ctui@claude-tui`) keep separate `pluginConfigs` entries (SKR L70) and separate store files (S), so a dev copy doesn't share the order with the installed one.
