# Working-now spec

This spec covers the **Sidebar**'s motion: which rows move, what the motion is, when a row starts and
stops moving, and what a folded section draws instead. It targets Claude Code 2.1.292, the pin.

It came out of the map [Map: one rounded icon set for the Sidebar, and what's working
now](https://github.com/a1exk-dev/claude-tui/issues/301) and its closed tickets. Its companion,
[`docs/spec/sidebar-icons.md`](sidebar-icons.md), names the glyph, codepoint and colour role of every
Sidebar state, the sweep's frames among them. That spec says what a row draws; this one says when it moves.

Like the icon spec, this spec is **ahead of `MEMORY.md`**. The entries it overturns are listed under
"`MEMORY.md` amendments", and the build amends them in the same work. Until then this spec is the record.

## Rules for the build

- **One build with the icon spec**, on its `feature/sidebar-icons` branch and pull request into `develop`.
  The two are inseparable: the icon spec gives a busy MCP row a sweep, and nothing makes that sweep turn
  until the in-flight count below exists. Shipping the glyphs alone would leave a state in its table that
  no session can reach.
- Apply "Sidebar plugins are pure; only `register.tsx` touches `$`", "Agent and shell events go to toasts,
  the live list goes to the sidebar", "Task ends come from notifications", and "Tests cover real usage:
  unit tests per module, scenario tests through hooks, live checks for the rest".
- Done when `node scripts/check.ts` exits 0, the tests below pass in `claude plugin test ctui`, and the
  live checks below ran on the pin.

## In progress is the only reason to move

The Sidebar moves where something is **in progress**, and nowhere else. Not "working", not "busy", not
"waiting": in progress, as `CONTEXT.md` defines it. Three sections hold that state, and each holds it for
one reason:

| Section | In progress means | Where it comes from |
|---|---|---|
| `todo` | the item the task list marks in progress | the task tools, unchanged |
| `agents` | a task whose status is `running` | `agent.spawn`, then the 1 s `$.agent.list()` poll |
| `mcp` | a server with at least one call in flight | `tool.call`, bracketed (see below) |

Every other state in every section draws a still glyph, a connecting MCP server included. A connecting
server is waiting, not working, so it holds still.

### Skills makes no working-now claim

The `skills` section never moves, in any case, and this is deliberate. It is a **cumulative session log**,
not a live roster: a row is added on a skill's first invocation, one per name and source, a repeat changes
nothing, and no row ever leaves. Compare `agents`, a genuine live list whose ended rows the tick drops.

So a Skills row has no present tense for motion to attach to — every row means "this was invoked at some
point in this session". A skill invoked earlier and running now holds exactly one row, so animating it
would make a single mark carry both "was used" and "is working".

That reasoning does not depend on attribution, and it does not change if attribution arrives. It is written
here because the engine fact underneath it invites the opposite conclusion: the engine names no skill for a
running tool call (see "Engine-pinned expectations"), so a later reader can mistake this silence for a gap
left by that limit and add motion back. It is not a gap. A log has no now.

Nothing in the Sidebar says the section is unknowable either. Rows keep their name, source and rest glyph;
the title, count, folded summary and empty text are untouched. The section never claimed to show what is
working, so there is nothing to take back, and a caveat would spend a visible line on a question nobody
asked.

## The motion

| | |
|---|---|
| Frames | `nf-md-circle_slice_1..8` (U+F0A9E..U+F0AA5), a circle filling up |
| Speed | 100 ms per frame |
| Colour | **the row's own colour role** |
| Clock | the row's own surface frame clock — `ctui/plugins/todo/spinner.tsx` as a `Client` — so the Sidebar does not redraw |
| Where | a Todo item in progress, a running agent or shell, an MCP server with a call in flight |

This is Todo's existing sweep, reused unchanged in frames and speed. One motion means in progress
everywhere, so a person reads the Sidebar's movement without learning a second vocabulary.

**Colour is the one thing that differs from Todo today.** The sweep runs in the role the row already uses,
so a busy `ok` server sweeps `success` and a busy `down` server sweeps `error`, while a Todo item and a
running agent keep sweeping `warning`. Shape says in progress; colour keeps saying which state the row is
in. This is the stated exception to the icon spec's "one glyph, one colour" rule.

Reuse `spinner.tsx` as it stands: it takes `frames`, `ms` and `color`, and every caller passes the same
`frames` and `ms`. Do not fork it per section.

### Several at once: no cap

**Every in-progress row sweeps, however many there are.** Seven moving rows — one task, two subagents, four
servers with calls in flight — read as alive rather than as noise when the human saw them live, and no cap
was wanted. The Sidebar is as busy as the session is.

Two things make that hold, and neither is an accident:

- **No two rows share a phase.** Each row's clock starts when its `Client` mounts, so the sweeps are
  naturally staggered. Nothing synchronises them, and nothing should: lockstep reads as a machine rather
  than as work.
- **Nothing redraws the Sidebar.** Every moving glyph turns on its own surface, so the cost of the tenth
  moving row is the tenth surface, not a tenth Sidebar render.

Do not add a cap, a global clock, or a shared phase later without reopening those two reasons.

## `mcp`: when a server is in progress

A row keeps exactly two facts: its **connection state** (ok / needs auth / connecting / down / off), which
the 1 s tick derives from live tools and config, and **busy**, true while at least one call to that server
is in flight. Busy is not a sixth connection state.

- **Bracket the call in the `tool.call` hook**: start before `next(e)`, end in its `finally`, so an error
  and an abort both release it. `serverName(e.tool, e.provider.plugin)` and `segmentOf` already name the
  server from the tool, so a call is attributed exactly and bounded at both ends.
- **The glyph cell is the row's live cell.** While busy, the glyph sweeps; the right-hand
  `<source> · <state text>` is untouched. A busy row still reads `plugin · 23 tools`, and a busy row whose
  last read failed still reads `user · needs auth`. The right-hand slot never changes meaning mid-session.
- **Busy outranks every connection state.** One rule: a call in flight, so the glyph sweeps, whatever the
  state says. A call crossing the wire is fresher evidence than the tick that set the state, and the state
  text on the right keeps the row honest — it says "working, and the last read said down". Sweeping only on
  `ok` would hide motion on exactly the call that is about to fail.
- **Busy is a boolean over a count.** Count calls in flight per server; the row sweeps while that count is
  above zero. The row never says how many are running.
- **It settles at once.** No hold, no floor, no per-server deadline. An MCP call crosses a process
  boundary, so it outlasts a 100 ms frame; a call shorter than one frame draws one frame or none, and that
  is honest — nothing ran long enough to see.
- **The expanded header count is unchanged.** `n/m` counts reachable servers, not working ones.

### The count lives in a module variable

Hold the per-server in-flight count in a module-level variable in `register.tsx`, like the observed-source
cache, **not** in `$.state`.

A settings change reloads the mod mid-session, so a call can start under one module and end under its
replacement, whose `finally` never runs. In the module, that reload drops the count and the row settles at
once: busy can read stale-cold for the rest of a call, and never stale-hot. In `$.state` the count would
survive the reload with nothing left to decrement it, and the row would sweep forever. A working row that
looks idle beats an idle row that looks working.

## `agents`: the running rows

A task sweeps while its status is `running`, and draws a still glyph once it ends. This is the state the
section already holds, so the build changes the mark and not the state machine: `◐` becomes the sweep, and
`✓`/`✗` become the icon spec's still circles.

- The words that end a row are `completed`, `failed` and `killed`. Every other word `$.agent.list()`
  reports (`pending`, `waiting`, `idle`, …) is live, so the row keeps sweeping. "Task ends come from
  notifications" in `MEMORY.md` holds the full rule, including the `waiting` case on 2.1.292 and the
  `/clear` carry-over; nothing here changes it.
- A nested background shell sweeps on the same rule as its parent's rows.
- `warning` stays the colour: a running agent is not a state machine with colours of its own, so its sweep
  reads the same as Todo's.
- Toasts are untouched. A toast is not a Sidebar section, it is an engine-drawn box with no clock, and it
  keeps its own glyphs (`◆`, `$`, `✓`, `✗`).

## `todo`: unchanged but the colour

The item in progress keeps the frames, the speed and the surface clock it has today. The only change is
that the sweep's colour is now stated as the row's own role rather than hard-coded, which for `todo` is
`warning` — the same colour it draws now. One `SPINNER` constant and one `color` prop serve all three
sections.

## Folded: a frozen frame

**No fold line ever animates.** A section's title row is one `Client`, and the engine draws a surface
module's tree with no nested `Client`, so a moving term would have to be lifted out of that row as its own
sibling surface — which costs click-anywhere-to-fold on that cell.

So a folded in-progress term draws one frozen frame, `nf-md-circle_slice_6` (U+F0AA3): the part-filled
shape no static state uses, so part-filled reads as "in progress" wherever it appears. The icon spec's
"Fold lines" section holds the tallies themselves. Two points belong here:

- **MCP's busy term is always `warning`**, however the busy servers' own connection states differ. Folded,
  the term is an aggregate and claims only that something is working; expanded, each row's sweep says in
  which state. The busy term leads the tally and leaves its state term, so the terms still sum to the
  server count.
- **`agents` drops the word `running`** for a tally over every state it holds. An empty tree has no terms,
  so it keeps the text `nothing running`.

## Engine-pinned expectations

Two of this spec's decisions rest on Claude Code's own behaviour: ctui neither asks for it nor can suppress
it, no ctui change can regress it, and no test can reach it. Both are therefore **engine-pinned
expectations** (`CONTEXT.md`), measured on 2.1.292 and recorded in `MEMORY.md` under "Engine-pinned
expectations hold only on the pinned Claude Code version", which `node scripts/check.ts` ties to the pin.
This spec names them; that entry is their home, and a version bump re-checks them there.

| Expectation | What it holds up |
|---|---|
| `no-skill-for-a-call` — no event and no `$` call names the skill in force while a tool call runs | Nothing. It is recorded because it invites re-adding motion to Skills, which is ruled out for its own reason above. |
| `no-nested-client` — a surface module's tree holds no nested `Client` | The frozen fold-line frame, and the whole "no fold line animates" rule. |

`no-skill-for-a-call` in full: `tool.call` carries `tool`, `tool_use_id`, the tool's arguments and
`agentId`; `skill.prompt` carries `skill` and `text`, fires once, and carries neither an `agentId` nor a
`tool_use_id`, so it joins to no loop and to no call. `$.session.messages()` carries no skill field in
either form. A rendered `SKILL.md` enters the conversation as one message and stays across later turns, and
a skill's frontmatter hooks run for the rest of the session, so "the skill is over" is not a state the
engine holds. A `context: fork` skill is the one exception — its loop has an `agentId` every call carries —
and zero of the 71 skills reachable in this project declare it. Measured in
[#303](https://github.com/a1exk-dev/claude-tui/issues/303) and counted in
[#310](https://github.com/a1exk-dev/claude-tui/issues/310);
`docs/agents/research/skill-tool-attribution.md` on the throwaway `research/skill-tool-attribution` branch
holds the long form.

## `MEMORY.md` amendments

Part of the build, in the same work as the icon spec's own amendments.

| Entry | What changes |
|---|---|
| Engine-pinned expectations hold only on the pinned Claude Code version | Gains `no-skill-for-a-call` and `no-nested-client` as members, each with the pin it was measured on. **Done in this spec's own work**, since both facts are established now. |
| The `mcp` Sidebar plugin reads live tools and MCP config names | Gains busy: the per-server in-flight count in a module variable, the sweep in the row's own colour outranking the connection state, settling with no hold, and the leading `warning` term in the folded tally. The states, the sources, the order, the `n/m` header and the no-probe rule are untouched. |
| The `todo` Sidebar plugin turns the task tools on by default | The sweep's colour becomes the row's own role, which for `todo` is the `warning` it draws today. |
| Agent and shell events go to toasts, the live list goes to the sidebar | `◐` becomes the sweep for a running row; the ended glyphs follow the icon spec. The toast texts and their glyphs are unchanged. |

## Tests

- **Unit, per plugin view**: a row in progress renders the `Client` with `frames` of U+F0A9E..U+F0AA5,
  `ms` 100 and the row's colour role — `success` for a busy `ok` server, `error` for a busy `down` one,
  `warning` for a Todo item and a running agent. Every other state renders a still glyph. Each fold line
  renders `circle_slice_6` for its in-progress term, MCP's in `warning` whatever its servers' states.
- **Scenario, through the hooks**: two overlapping calls to one server leave the row busy until the second
  ends; a call that throws releases the count; a `tool.call` to a `down` server makes that row busy without
  changing its state text; the folded MCP tally's terms sum to the server count with a busy server present.
- **Live checks**: `todo/spinner-animates` and `todo/spinner-focused` keep working as they are — they
  assert that the glyph differs between two samples ~300 ms apart, never which frame, so the conversion
  does not touch them. Add one check in that shape for an MCP row with a call in flight, and one that
  samples a **folded** in-progress section twice and asserts the term does **not** change, which is the
  `no-nested-client` expectation on the screen. A frame rate is not asserted anywhere.

## What is left to decide

Nothing. Every rule here is chosen. The glyphs, codepoints, roles, spacing and fold-line tallies are in
[`docs/spec/sidebar-icons.md`](sidebar-icons.md), and the build is the one that spec names.
