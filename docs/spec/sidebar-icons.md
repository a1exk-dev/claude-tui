# Sidebar icon spec

This spec covers one rounded icon vocabulary for every **Sidebar** section: `todo`, `mcp`, `skills` and
`agents` ("Agents & shells"). It names the glyph each state draws, its codepoint, its colour role, the
spacing around it, and what each section's fold line draws. It targets Claude Code 2.1.292, the pin.

It came out of the map [Map: one rounded icon set for the Sidebar, and what's working
now](https://github.com/a1exk-dev/claude-tui/issues/301) and its closed tickets. Its companion,
[`docs/spec/working-now.md`](working-now.md), covers motion: when a row counts as working, the frames'
timing and how a row settles. This spec names the sweep's codepoints; it does not say when they run.

Unlike [`docs/spec/v0.1.md`](v0.1.md), this spec is **ahead of `MEMORY.md`**, not behind it. The entries
it overturns are listed under "`MEMORY.md` amendments", and the build amends them in the same work. Until
then this spec is the record. Where it and an unamended entry disagree, this spec wins; where it and an
amended entry disagree after the build, stop and ask the human.

## Rules for the build

- One `feature/sidebar-icons` branch and one pull request into `develop` (`AGENTS.md`), or one branch per
  section if the diff gets wide. Either way the vocabulary lands whole: a half-converted Sidebar draws two
  families at once, which is the thing this spec exists to end.
- Apply "Sidebar plugins are pure; only `register.tsx` touches `$`", "A Nerd Font icon takes two spaces
  after it", "Redraw the renders from `docs/design/sidebar.html` when ctui changes its own design" and
  "Tests cover real usage: unit tests per module, scenario tests through hooks, live checks for the rest".
- Done when `node scripts/check.ts` exits 0, the tests below pass in `claude plugin test ctui`, the live
  checks below ran on the pin, and the renders are re-exported.

## The vocabulary

Every Sidebar state draws a circle from the Material Design range in the person's JetBrainsMono Nerd Font,
at one size. All 6,896 `nf-md-*` codepoints are present in the installed font, so no state falls back.

| Section | State | Glyph | Codepoint | Weight | Role |
|---|---|---|---|---|---|
| `todo` | completed | `nf-md-checkbox_marked_circle` | U+F0133 | filled | `success` |
| `todo` | in progress | `nf-md-circle_slice_1..8` | U+F0A9E..U+F0AA5 | sweep | the row's own, `warning` |
| `todo` | pending | `nf-md-checkbox_blank_circle_outline` | U+F0130 | ring | `faint` |
| `mcp` | ok | `nf-md-check_circle_outline` | U+F05E1 | ring | `success` |
| `mcp` | needs auth | `nf-md-alert_circle` | U+F0028 | filled | `warning` |
| `mcp` | connecting | `nf-md-radiobox_marked` | U+F043E | ring with a core | `warning` |
| `mcp` | down | `nf-md-close_circle` | U+F0159 | filled | `error` |
| `mcp` | off | `nf-md-minus_circle_outline` | U+F0377 | ring | `faint` |
| `mcp` | busy | `nf-md-circle_slice_1..8` | U+F0A9E..U+F0AA5 | sweep | the row's own state role |
| `agents` | running | `nf-md-circle_slice_1..8` | U+F0A9E..U+F0AA5 | sweep | the row's own, `warning` |
| `agents` | completed | `nf-md-checkbox_marked_circle` | U+F0133 | filled | `success` |
| `agents` | ended any other way | `nf-md-close_circle` | U+F0159 | filled | `error` |
| `skills` | at rest | `nf-md-asterisk_circle_outline` | U+F1A27 | ring | `muted` |
| fold line, working term | frozen sweep frame | `nf-md-circle_slice_6` | U+F0AA3 | part-filled | see "Fold lines" |

`agents` ends a row on `completed`, `failed` or `killed` ("Task ends come from notifications"); `failed`
and `killed` both draw `close_circle` in `error`. `mcp` **busy** is an overlay on the glyph cell, not a
sixth state: it replaces whatever the connection state would draw while a call to that server is in
flight, and the right-hand `<source> · <state text>` never changes. `skills` has one state and no second
glyph: the section is a cumulative session log with no present tense, so it draws no motion.

### What the weight means, per section

A terminal cell holds three shape distinctions — filled, ring, part-filled — and inside the filled family
any two glyphs differ by 8–26% of their inked pixels. So the weight carries a meaning stated per section,
and colour separates the one pair per section that shares a weight:

- `mcp`: a filled disc wants you (needs auth, down); a ring is steady (ok, off); a ring with a core is connecting.
- `todo`: a filled disc is settled; a ring is still waiting.
- `agents`: a filled disc is settled; the sweep is running.
- `skills`: a ring is at rest.

### One glyph, one colour

A static glyph takes the same colour role in every section it appears in. `checkbox_marked_circle` is
`success` in both `todo` and `agents`; `close_circle` is `error` in both. Every other static mark is drawn
by one section only.

**Motion is the rule's stated exception.** The sweep takes its row's own colour role, so a busy `down` MCP
server sweeps `error` while `todo` and `agents` sweep `warning`. Expanded, the sweep's colour says which
row is working and in what state.

## Spacing

Every row glyph is followed by **two spaces**: the engine counts the glyph as one cell, the terminal draws
it two cells wide, so the first space takes the overflow and the second shows as the gap. `todo` already
draws this way; `mcp`, `skills` and `agents` draw plain Unicode at one cell today and so carry none of it.

The git header is the exception, and stays as it is: its Devicons draw **one** cell wide, so a single space
puts its text in column 2, which is where the `layout/git-glyph-columns` live check reads it. Two spaces is
what a double-width circle needs, not a rule about every glyph.

Converting them is a spacing change as well as a glyph change: **each converted row's label loses one
column**. Those rows already pair a truncating label with a right-hand value in a `flexShrink: 0` Box, so
the value keeps its room and the label truncates one character earlier. Check each converted section at
the 42-column dock, the narrow case, where the squeeze shows first.

One thing for the build to confirm on the pin before copying markup: `todo`'s rows put a single JSX space
between the glyph and the text today, and the spike's fold line writes two explicit spaces. If the live
gap differs between them, the two-space rule is what holds, and `todo`'s rows come into line with it.

## Row shapes that change

Beyond the glyph itself, two sections change shape.

### `agents`: no kind glyph at all

A row draws one circle, and it means state. The **kind** is a muted word at the right beside the elapsed
time, `<kind> · <elapsed>`, in the non-shrinking Box that holds the elapsed time today, so it never
truncates. This is the Sidebar's own standing rule: the name bright at the left and truncating, its
metadata muted at the right and fixed.

```
󰪣  release-cut              workflow · 1m04s
󰪣  the spec              code-review · 22s
󰪣  npm test                    shell · 8s
󰄳  glyph-sweep              workflow · 3m11s
󰅙  npm run build · killed      shell · 41s
```

- `⚙` (workflow), `$` (shell) and the trailing word `workflow` all go: the right-hand word says it once.
- A subagent row follows the same shape. Its `type` moves right, so the task name takes the bright slot a
  command and a run already have: `code-review · the spec` becomes `the spec` at the left with
  `code-review · 22s` at the right.
- An ended row's reason stays at the left, muted, after the name, inside the truncating half. A wordy
  reason gives way before the right-hand slot does.

### `skills`: the row takes a glyph

A `skills` row is no longer "an MCP row without the glyph". It draws `asterisk_circle_outline` in `muted`,
then the name in `main` truncating, then the source in `muted` in a `flexShrink: 0` Box. The order (A–Z by
name, then source) and the empty state are unchanged.

## Fold lines

A fold line draws the same circles as the rows, as a **tally**: one term per state, the state's own glyph
at its weight and role, then its count. Two spaces after the glyph and two between terms, identical in
every section.

```
mcp      󰪣  2  󰗡  2  󰀨  1  󰍷  2
agents   󰪣  2  󰄳  3  󰅙  1
todo     󰄳  3  󰪣  1  󰄰  4
skills   󱪧  7
```

- **A fold line never animates.** The engine draws a surface module's tree with no nested `Client`, and a
  section's title row *is* one `Client` whose props carry the summary as plain data. A working term draws
  the frozen frame `circle_slice_6` instead — the part-filled shape no static state uses, so part-filled
  reads as "working" wherever it appears.
- `mcp`: the busy term leads and leaves its state term, so the terms still sum to the server count. It is
  **always `warning`**, however the busy servers' own connection states differ: folded, colour drops to
  one claim, and the rows say which when you unfold. The expanded header count stays `3/6`.
- `agents`: every state it holds, not just running, and the word `running` goes. Completed and failed get
  their own terms for as long as those rows are still held. An empty tree has no terms, so it keeps the
  text `nothing running`.
- `todo`: a tally, which drops the current task's `activeForm`. A folded Todo says how much is done, not
  what is happening.
- `skills`: its one rest ring before the number. Empty stays `0` with `no skills used yet` in `faint`.

## Exemptions

- **The git header keeps its Devicons** — `U+E725` branch, `U+E702` changeset, `U+E728` lines changed, each
  in `muted`. Chosen deliberately, and the circle family has nothing that says "branch". This spec records
  the exemption rather than reopening it.
- **Not the Sidebar, so not this spec**: the tool rows under the transcript (`→` Read, `←` Edit and Write,
  `$` Bash), the `✻` status word, and the toasts (`◆`/`$`/`✓`/`✗`). A toast is an engine-drawn box outside
  the Sidebar, so the `agents` conversion leaves its toast glyphs alone, including the `⚙` and `$` the rows
  drop.

## `MEMORY.md` amendments

Part of the build, in the same work.

| Entry | What changes |
|---|---|
| A Nerd Font icon takes two spaces after it | **Stands**, and now reaches every Sidebar row glyph rather than `todo` alone. The git header's single-width Devicons keep their one space, which the entry records as the exception. |
| The `todo` Sidebar plugin turns the task tools on by default | The three glyphs stand. Completed moves from `muted` to `success` (one glyph, one colour), and "The folded summary stays text" is overturned by the tally. |
| The `mcp` Sidebar plugin reads live tools and MCP config names | The row glyphs `●`, `!`, `◐`, `✕`, `○` become the circles above; the folded summary becomes a tally with the busy term leading. The states, the sources, the order and the no-probe rule are untouched. |
| The `skills` Sidebar plugin lists every `skill.prompt` | "Draw like an MCP row without the glyph" is overturned: the row leads with `asterisk_circle_outline` in `muted`, and the summary is that ring before the count. |
| Agent and shell events go to toasts, the live list goes to the sidebar | The row glyphs `◐`, `✓`, `✗` become the circles above, and `◐ N running` becomes the tally. The toast texts and their glyphs are unchanged. |
| A Workflow run is one task row; teammates stay hidden | `⚙ <workflowName> workflow` becomes the status circle with `workflow · <elapsed>` at the right. |
| Redraw the renders from `docs/design/sidebar.html` when ctui changes its own design | **Applies**: see below. |

## The renders

Yes, they need re-exporting: this is ctui's own design changing, not an engine limit, so it redraws rather
than joining a known-differences table. Edit `docs/design/sidebar.html` in the same work and re-export the
three Sidebar PNGs with the command in its header comment. Draw in the installed JetBrainsMono Nerd Font.
The four `/ctui` menu renders are unaffected.

## Tests

- **Unit, per plugin view**: every state draws its codepoint in its role, in each section, expanded and
  folded. This is where the vocabulary is pinned — a glyph in a view is reachable by a test, so it is not a
  live check. Cover the `mcp` busy overlay replacing each connection state's glyph, the `agents` right-hand
  `<kind> · <elapsed>` for a workflow, a shell and a subagent, and each section's tally including `mcp`'s
  leading busy term and the `agents` empty tree keeping `nothing running`.
- **Scenario**: an `agents` row with a long name and a long reason truncates at the left while the
  right-hand `kind · elapsed` keeps its room, at the 42-column dock.
- **Live checks**: one new check per converted section, in the shape `layout/git-glyph-columns` already
  has — `cells` over a row, asserting the glyph's codepoint at content column 0 and its text at column 3.
  The column is the one fact here no test reaches, because it comes from the terminal drawing the glyph two
  cells wide. `todo/spinner-animates` and `todo/spinner-focused` keep working as they are: they assert the
  glyph changes between samples, never which frame.

## What is left to decide

Nothing. Every glyph, role, spacing rule and fold line is chosen. Motion is specified in
[`docs/spec/working-now.md`](working-now.md).
