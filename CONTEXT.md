# Context

## Sidebar

The docked pane the mod draws beside the transcript, specified by the renders in `docs/design/`. It is a mod `Pane`, not a native Claude Code panel. It shows the enabled **Sidebar plugins** in registry order.

## Sidebar plugin

A pure module in `ctui/plugins/<id>/` that draws one foldable block of the **Sidebar**: `git` (header), `context`, `limits`, `mcp`, `todo`, `agents` ("Agents & shells"), or `versions` (footer). It is enabled by the `<id>_enable` setting or by `/ctui:plugins:enable|disable`. Its folded state is separate from enablement. It is not a Claude Code plugin: "the plugin" alone means `ctui`, the Claude Code plugin this repo ships.

## Theme

A `ctui/themes/<slug>.json` file in Claude Code's theme format that recolors the **Sidebar**. `inherit`, the default, means no file: the Sidebar uses the user's current Claude Code theme.

## ctui

The Claude Code plugin this repo ships (`name` and `displayName` both `ctui`), installed from the `claude-tui` marketplace. It skins Claude Code's TUI: the **Sidebar**, the lines under the prompt input, and other render sites. It is not limited to the Sidebar.
