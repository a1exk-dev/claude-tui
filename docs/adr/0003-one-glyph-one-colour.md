# One glyph, one colour; motion is the only colour exception

Every Sidebar state draws a circle from one Nerd Font family (`ctui/plugins/marks.tsx`), and a static mark takes the same colour role in every section that draws it: `checkbox_marked_circle` is `success` in both `todo` and `agents`, `close_circle` is `error` in both. A terminal cell holds only three shape weights (filled, ring, part-filled), so the weight carries a per-section meaning and colour separates the one pair per section that shares a weight; a mark that changed colour between sections would make the reader learn each section's palette.

The sweep is the stated exception: it takes its row's own colour role, so a busy `down` MCP server sweeps `error` while `todo` and `agents` sweep `warning`. Shape says in progress; colour keeps saying which state the row is in. A folded section's in-progress term is a single aggregate claim, so `mcp`'s draws `warning` whatever its servers' states.

The git header is exempt from the circles: it keeps its Devicons (branch, changeset, lines changed), because the circle family has nothing that says "branch".
