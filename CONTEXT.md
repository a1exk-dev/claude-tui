# Context

## Sidebar

The docked pane the mod draws beside the transcript, specified by the renders in `docs/design/`. It is a mod `Pane`, not a native Claude Code panel: the Sidebar is the pane's body, and the frame around it (rule, `✕`, background) is Claude Code's. It shows the enabled **Sidebar plugins** in registry order. It exists only docked: where Claude Code would seat it inline above the prompt, the Sidebar is hidden.

## Sidebar plugin

A pure module in `ctui/plugins/<id>/` that draws one foldable block of the **Sidebar**: `git` (header), `context`, `limits`, `todo`, `skills`, `mcp`, `agents` ("Agents & shells"), or `versions` (footer). The `git` header and `versions` footer are always on and never move. A section between them is enabled by the `<id>_enable` setting or in the `/ctui` menu's Plugins screen, and drawn in the order the `order` setting gives. Its folded state is separate from enablement. It is not a Claude Code plugin: "the plugin" alone means `ctui`, the Claude Code plugin this repo ships.

## In progress

The one state the **Sidebar** draws motion for: a `todo` item the task list marks in progress, an `agents` task whose status is `running`, and an `mcp` server with at least one call in flight. Everything else draws a still glyph, a connecting server included — a connecting server is waiting, not working. It retires "working" and "busy" as names for the same thing: busy is only the name of the `mcp` row's half of it. The `skills` section holds no such state at all, being a cumulative session log rather than a live list. The motion itself is specified in `docs/spec/working-now.md`, the marks in `docs/spec/sidebar-icons.md`.

## Theme

A `ctui/themes/<slug>.json` file in Claude Code's theme format, selected in the `/ctui` menu's Themes screen, that recolors the **Sidebar** and paints its background. ctui bundles one per built-in Omarchy theme, generated from that theme's palette. Claude Code also lists each file in `/theme`, where it recolors all of Claude Code and the Sidebar's dock. `inherit`, the default, means no file: the Sidebar uses the user's current Claude Code theme and paints no background.

## ctui

The Claude Code plugin this repo ships (`name` and `displayName` both `ctui`), installed from the `claude-tui` marketplace. It skins Claude Code's TUI: the **Sidebar**, the lines under the prompt input, and other render sites. It is not limited to the Sidebar.

## Live check

A check an **agent** drives against a real, signed-in Claude Code through the pty harness in `.claude/skills/live-checks/`, asserting what no mock reaches: the engine's docking and chrome, toast drawing, the paint a **Theme** puts on a cell. It is not a check a person runs by hand — the operator picks the model, starts the run and reads the report. Each one has a named id whose prefix is its section in that report (`themes/glass-flat`), and the ids, the scenarios they run in and the report's shape belong to the skill; `docs/testing/live-checks.md` is the operator's page for running one. Behaviour a test can reach is not a live check: `MEMORY.md`, "Tests cover real usage", holds the rule that places a check.

## Engine-pinned expectation

A behaviour of the pinned Claude Code version that belongs to the engine rather than to **ctui**: ctui neither asks for it nor can suppress it, so no ctui change can regress it and no test can reach it. It is true of one engine version, so each one is recorded in `MEMORY.md` under "Engine-pinned expectations hold only on the pinned Claude Code version" with the pin it was measured on, and `node scripts/check.ts` fails when the pin moves and that entry does not. Whether a **live check** can see it is a separate matter: most members were found by a live run, and one a live check can never reach is still recorded here, since the pin is what makes it expire. Everything else a live check finds is ctui's own expectation, which a test asserts wherever one can reach it.
