# Context

## Sidebar

The docked pane the mod draws beside the transcript, specified by the renders in `docs/design/`. It is a mod `Pane`, not a native Claude Code panel: the Sidebar is the pane's body, and the frame around it (rule, `✕`, background) is Claude Code's. It shows the enabled **Sidebar plugins** in registry order. It exists only docked: where Claude Code would seat it inline above the prompt, the Sidebar is hidden.

## Sidebar plugin

A pure module in `ctui/plugins/<id>/` that draws one foldable block of the **Sidebar**: `git` (header), `context`, `limits`, `todo`, `mcp`, `agents` ("Agents & shells"), or `versions` (footer). The `git` header and `versions` footer are always on and never move. A section between them is enabled by the `<id>_enable` setting or by `/ctui:plugins:enable|disable`, and drawn in the order the `order` setting gives. Its folded state is separate from enablement. It is not a Claude Code plugin: "the plugin" alone means `ctui`, the Claude Code plugin this repo ships.

## Theme

A `ctui/themes/<slug>.json` file in Claude Code's theme format, selected in the `/ctui` menu's Themes screen, that recolors the **Sidebar** and paints its background. ctui bundles one per built-in Omarchy theme, generated from that theme's palette. Claude Code also lists each file in `/theme`, where it recolors all of Claude Code and the Sidebar's dock. `inherit`, the default, means no file: the Sidebar uses the user's current Claude Code theme and paints no background.

## ctui

The Claude Code plugin this repo ships (`name` and `displayName` both `ctui`), installed from the `claude-tui` marketplace. It skins Claude Code's TUI: the **Sidebar**, the lines under the prompt input, and other render sites. It is not limited to the Sidebar.
