# Circle-enclosed Nerd Font glyphs for every Sidebar state (#302, map #301)

Scope: which `nf-md-*` glyphs can carry every state the Sidebar draws, at one terminal cell and one visual weight, under the map's rule that every state gets a circle-enclosed glyph. Every claim cites a source below. **Unverified** marks what no source settles.

**Source keys**

- **GN** = `glyphnames.json`, the canonical Nerd Fonts name-to-codepoint map, fetched 2026-10-14 from `https://raw.githubusercontent.com/ryanoasis/nerd-fonts/master/glyphnames.json` (545,560 bytes, 10,996 entries). Its `METADATA` block gives `"version": "3.5.1", "date": "2026-08-21"`. Queried locally with `python3 -I` reading the JSON; no entry was read from the HTML cheat sheet.
- **FONT** = the installed `/usr/share/fonts/TTF/JetBrainsMonoNerdFont-Regular.ttf`, found with `fc-list | grep -i jetbrains`, owned by the Arch package `ttf-jetbrains-mono-nerd-basic 3.5.1-2`. Its `name` table reads `Version 2.304; ttfautohint (v1.8.4.7-5d5b);Nerd Fonts 3.5.1`, so the font build and GN are the same Nerd Fonts release. Read with fontTools 4.67.0 in a throwaway venv: `getBestCmap()` for coverage (12,226 mapped codepoints), `AreaPen` for ink, `BoundsPen` for the mark's box, `RecordingPen` plus a SHA-1 of the recorded path for outline identity.
- **RASTER** = the same TTF rendered with Pillow 12.3.0 at 13, 17, 21, 26 and 32 px into a greyscale tile, which is what a terminal cell does. Two measurements come from it: a contact sheet of every candidate at 17 px beside a 3x nearest-neighbour blow-up, and a pixel diff between two glyphs, reported as the share of inked pixels that differ (`changed / mean(inked)`), thresholded at 32/255.
- **CODE** = the four plugin files in this worktree: `ctui/plugins/todo/index.tsx`, `ctui/plugins/mcp/index.tsx`, `ctui/plugins/skills/index.tsx`, `ctui/plugins/agents/index.tsx`.
- **MEM** = `MEMORY.md` at the repo root; **CTX** = `CONTEXT.md`.

---

## 0. Verdict

- **Coverage is a non-issue.** All 6,896 `nf-md-*` codepoints in GN are mapped in the installed FONT. Not one candidate is missing, including the whole `_circle` family and all eight `circle_slice` frames. The "basic" package variant does not thin the Material Design range.
- **Every state can get a circle-enclosed glyph**, including the `agents` workflow kind, which has no circle form as a gear. The replacement is `nf-md-play_circle` (U+F040C), a triangle knocked out of a filled disc, which depicts a run rather than a mechanism.
- **The one visual weight already exists, and the current Todo set does not sit on it.** The Material Design circle family splits cleanly in two by ink (FONT, `AreaPen` over a 1000-unit em):
  - the **filled weight**, a solid disc with the symbol knocked out, 40 to 55 percent ink, mark box 0.83 x 0.83 em;
  - the **ring weight**, an outline, 16 to 25 percent ink, same box.
  Todo draws completed on the filled weight and pending on the ring weight, and the spinner sweeps from 22.8 to 46.2 percent across its eight frames, crossing both. Any "one weight" decision has to pick one of these two and say what carries pending and off.
- **The limit is not the glyph, it is the cell.** At 17 px, `checkbox_blank_circle` (a plain disc) and `alert_circle` (a disc with `!` knocked out) differ by 8.2 percent of their inked pixels, and that figure is flat across 13 to 32 px (RASTER). Every filled-weight glyph reads as "a filled dot" at one cell; the knocked-out symbol is one to two pixels wide. Colour keeps carrying the distinction, exactly as CODE already has it. The shape distinction that survives a cell is filled against ring, and the half-filled or sliced forms, nothing finer.
- **One pair is not merely similar, it is pixel-identical.** `checkbox_marked_circle` (U+F0133) and `check_circle` (U+F05E0) have different outlines (FONT, path hashes `55d11fb7516e` and `7e95c645d6ad`) and rasterize to byte-identical tiles at 13, 17, 21, 26 and 32 px (RASTER, 0.0 percent diff at every size). They cannot be used as two different states.
- **Two names are the same glyph outright.** `checkbox_blank_circle_outline` (U+F0130) and `circle_outline` (U+F0766) share path hash `caa2cc3a524f`; `checkbox_blank_circle` (U+F012F) and `circle` (U+F0765) share `596ec3295f4e` (FONT).

---

## 1. What each section draws today

From CODE. MEM, "A Nerd Font icon takes two spaces after it", holds that the engine counts such a glyph as one cell while the terminal draws it two wide, so a Nerd Font icon before text needs two spaces; the Todo rows and the git header follow that, and the plain-Unicode rows below do not need it.

| Section | State | Drawn today | Colour role |
|---|---|---|---|
| todo | completed | `nf-md-checkbox_marked_circle` U+F0133 | `muted` |
| todo | in progress | `nf-md-circle_slice_1..8` U+F0A9E..U+F0AA5, 100 ms a frame, on the `spinner.tsx` Client | `warning` |
| todo | pending | `nf-md-checkbox_blank_circle_outline` U+F0130 | `faint` |
| mcp | ok | `●` U+25CF | `success` |
| mcp | needs auth | `!` U+0021 | `warning` |
| mcp | connecting | `◐` U+25D0 | `warning` |
| mcp | down | `✕` U+2715 | `error` |
| mcp | off | `○` U+25CB | `faint` |
| agents | running | `◐` U+25D0 | `warning` |
| agents | completed | `✓` U+2713 | `success` |
| agents | failed | `✗` U+2717 | `error` |
| agents | workflow | `⚙` U+2699, inside the row's name, not the status slot | `main` |
| skills | at rest | nothing; the row is name plus source | `main` / `muted` |
| skills | working | nothing; no working state is drawn | n/a |

Two things worth carrying into any decision. The agents workflow mark is a **kind** marker that sits in the name, beside the status glyph, so a workflow row would draw two circles in a row once it becomes one. And the skills section draws no glyph at all today; MEM's skills entry describes the row as "like an MCP row without the glyph", so both skills states are new design, not a substitution.

---

## 2. Todo

Ink is the `AreaPen` figure as a percentage of the em square; the box is the `BoundsPen` extent in em units (FONT).

| State | Nerd Font name | Codepoint | In installed font? | Legibility at one cell |
|---|---|---|---|---|
| completed | `nf-md-checkbox_marked_circle` | U+F0133 | Yes | Filled weight, 48.3 percent ink, 0.83 x 0.83. The check is knocked out of the disc and survives as a light notch. Reads as a dark dot with a nick in it. |
| in progress | `nf-md-circle_slice_1` … `_8` | U+F0A9E … U+F0AA5 | Yes, all eight | Ink climbs evenly: 22.8, 26.2, 29.5, 32.8, 36.2, 39.5, 42.8, 46.2. Frame 1 sits on the ring weight and frame 8 near the filled weight, so the sweep is visible as the cell darkening. Frame 1 differs from the pending ring by only 14.6 percent of inked pixels (RASTER), which is why the motion, not the frame, carries it. |
| pending | `nf-md-checkbox_blank_circle_outline` | U+F0130 | Yes | Ring weight, 19.5 percent ink, 0.83 x 0.83. A clean open ring; the thinnest mark in the set that still holds its shape at 13 px. |

No change is needed here. The set is already circle-enclosed, already in the font, and already the reference the other sections should match.

---

## 3. MCP

| State | Nerd Font name | Codepoint | In installed font? | Legibility at one cell |
|---|---|---|---|---|
| ok | `nf-md-checkbox_blank_circle` | U+F012F | Yes | Filled weight, the heaviest in the set, 54.5 percent ink, 0.83 x 0.83. A plain solid disc, no knockout, so nothing to lose. The direct Nerd Font replacement for `●`. Identical outline to `nf-md-circle` U+F0765. |
| needs auth | `nf-md-alert_circle` | U+F0028 | Yes | Filled weight, 51.8 percent ink. `!` knocked out of the disc, which is literally what the row draws today. The knockout is 8.2 percent of the mark against a plain disc (RASTER), so at a cell it is a disc with a hairline. |
| connecting | `nf-md-sync_circle` | U+F1378 | Yes | Filled weight, 44.0 percent ink. Two chasing arrows knocked out of the disc. It differs from `circle_half_full` by 48.9 percent of inked pixels at 17 px (RASTER), so it holds apart from a half-filled form, but the arrows themselves are busy and read as texture rather than as arrows. |
| down | `nf-md-close_circle` | U+F0159 | Yes | Filled weight, 46.7 percent ink. `✕` knocked out of the disc; 26.1 percent apart from `alert_circle` (RASTER), the largest gap inside the filled family, because the knockout reaches the disc's edge in four directions. |
| off | `nf-md-minus_circle` | U+F0376 | Yes | Filled weight, 51.1 percent ink. A horizontal bar knocked out of the disc. Stays on the filled weight, which `circle_outline` would not. |

Alternatives, all present in FONT and all circle-enclosed:

| State | Alternative | Codepoint | Why it is second choice |
|---|---|---|---|
| ok | `nf-md-check_circle` | U+F05E0 | Pixel-identical to Todo's completed mark at every size tested (RASTER). Picking it means MCP "ok" and Todo "completed" draw the same cell. |
| needs auth | `nf-md-account_circle` | U+F0009 | 39.9 percent ink, a person in the disc, reading "sign in". Lighter than the rest of the filled family and the figure is unreadable at a cell. |
| connecting | `nf-md-circle_half_full` | U+F1396 | 37.0 percent ink, a cleanly half-filled disc, the closest match to today's `◐` and the most legible of the in-flight candidates. Its cost is section-to-section collision, see §6. |
| off | `nf-md-circle_outline` | U+F0766 | Same outline as Todo's pending ring, so "off" and "pending" become the same cell (FONT path hash). |
| off | `nf-md-circle_off_outline` | U+F10D3 | A ring with a slash, 9.4 percent ink, box 0.88 x 0.88. The lightest candidate measured, half the ink of the thin ring; at 13 px the slash and the ring merge. |

There is **no circle-enclosed lock or key glyph** in the Material Design range. A GN scan of every `md-*` name containing `circle` or `ellipse` crossed with `lock`, `key`, `shield`, `cog` and `wrench` returns nothing. "Needs auth" has to be carried by `alert_circle`, `account_circle` or `help_circle`, none of which depicts a credential.

---

## 4. Agents

Running, completed and failed are statuses; workflow is a kind marker that today sits in the name beside the status glyph.

| State | Nerd Font name | Codepoint | In installed font? | Legibility at one cell |
|---|---|---|---|---|
| running | `nf-md-circle_half_full` | U+F1396 | Yes | 37.0 percent ink, 0.83 x 0.83. A disc filled on one side, the clearest "part way" shape in the family and the direct replacement for `◐`. It is the one non-animated mark here whose meaning survives a cell on shape alone. The set in §8 hands this mark to MCP connecting instead and puts running on `nf-md-sync_circle` U+F1378, because an Agents row already carries a ticking elapsed time while an MCP row says "wait" on shape alone; §8 records the swap. |
| completed | `nf-md-checkbox_marked_circle` | U+F0133 | Yes | As Todo's completed mark, deliberately the same glyph for the same meaning. 48.3 percent ink. |
| failed | `nf-md-close_circle` | U+F0159 | Yes | As MCP's down mark, same meaning. 46.7 percent ink. |
| workflow (kind) | `nf-md-play_circle` | U+F040C | Yes | 49.9 percent ink, 0.83 x 0.83. A triangle knocked out of a filled disc. It depicts a run that starts, which is what a Workflow run is; a gear depicts a mechanism, and MDI has no circle-enclosed gear. The triangle is the largest single knockout in the filled family after `close_circle`, so it is among the better-surviving marks. |

Workflow alternatives, all present in FONT:

| Alternative | Codepoint | What it depicts | Note |
|---|---|---|---|
| `nf-md-sync_circle` | U+F1378 | Two chasing arrows in a disc: a process that cycles | Only if MCP connecting does not also take it. |
| `nf-md-refresh_circle` | U+F1377 | One circular arrow in a disc | 43.2 percent ink; 20.8 percent apart from `sync_circle` (RASTER), which is inside the band where two marks read alike. |
| `nf-md-dots_circle` | U+F1978 | Dots arranged on a ring | 17.8 percent ink spread over a 0.92 em box, the faintest thing measured. At 17 px it nearly disappears. Rejected. |
| `nf-md-state_machine` | U+F11EF | Nodes and transitions | **Not circle-enclosed**, and at 8.6 percent ink over a 0.92 x 0.83 box it is the sparsest mark tested. Rejected on both counts. |

---

## 5. Skills

Both states are new; CODE draws no glyph in this section today.

| State | Nerd Font name | Codepoint | In installed font? | Legibility at one cell |
|---|---|---|---|---|
| at rest | `nf-md-lightning_bolt_circle` | U+F0820 | Yes | Filled weight, 46.9 percent ink, 0.83 x 0.83. A bolt knocked out of the disc, which reads as a capability that fires. It gives Skills a mark of its own rather than another status dot. 25.5 percent apart from `star_circle` (RASTER). |
| working | `nf-md-circle_slice_1..8` | U+F0A9E..U+F0AA5 | Yes, all eight | The Todo spinner, reused. Motion carries it, and the `spinner.tsx` Client that draws it already exists, so no new glyph and no new mechanism. |

Alternatives for at rest, all present in FONT: `nf-md-star_circle` U+F04CF (42.5 percent ink, a star in the disc); `nf-md-pause_circle` U+F03E5 (48.9 percent, two bars in the disc, the most literal "at rest" but easily read as "paused by someone"); `nf-md-circle_double` U+F0E95 (30.6 percent, a ring inside a ring, which sits between the two weights and so breaks the one-weight rule).

**Unverified:** what "working" means for a skill in ctui's own model. CTX describes Sidebar plugins and MEM describes the skills row as name plus source, and neither names a running state or an event that would raise one. Whether a skill has an observable working window at all is a question for the plugin's data source, not for the glyph set.

---

## 6. Collisions

Measured at 17 px unless noted (RASTER); the figure is the share of inked pixels that differ, so a small number means the two marks paint nearly the same cell.

| Pair | Diff | Severity |
|---|---|---|
| `checkbox_marked_circle` U+F0133 and `check_circle` U+F05E0 | **0.0 percent at 13, 17, 21, 26 and 32 px** | Fatal. Different outlines, identical pixels at every size tested. Never assign these to two different states. |
| `checkbox_blank_circle_outline` U+F0130 and `circle_outline` U+F0766 | **0.0 percent**, same path hash | Fatal. The same glyph under two names. Todo pending and any "off" that takes `circle_outline` would be one cell. This is why §3 puts MCP off on `minus_circle`. |
| `checkbox_blank_circle` U+F012F and `circle` U+F0765 | same path hash | Same glyph, two names. Harmless as long as only one is used. |
| `checkbox_blank_circle` and `alert_circle` | 8.2 percent | Severe. MCP ok against MCP needs auth, in the same section, adjacent rows. Only colour tells them apart, which is what happens today with `●` against `!`, so this is no worse than the current state, but the map's rule does not improve it either. |
| `checkbox_blank_circle` and `minus_circle` | 9.4 percent | Severe. MCP ok against MCP off, in the same section. Colour carries it (`success` against `faint`). |
| `checkbox_blank_circle` and `play_circle` | 12.5 percent | Moderate. MCP ok against the agents workflow kind mark, different sections. |
| `alert_circle` and `minus_circle` | 14.6 percent | Severe. MCP needs auth against MCP off, same section. |
| `alert_circle` and `play_circle` | 14.9 percent | Moderate, different sections. |
| `play_circle` and `lightning_bolt_circle` | 16.1 percent | Moderate. The agents workflow kind against the skills at-rest mark, different sections. |
| `checkbox_marked_circle` and `checkbox_blank_circle` | 16.8 percent | Moderate. Todo completed against MCP ok, different sections, both reading as a dark dot. |
| `circle_slice_1` and `checkbox_blank_circle_outline` | 14.6 percent | Inside Todo, the spinner's first frame against pending. It is only safe because the spinner moves. A static first frame would be indistinguishable. |
| `circle_half_full` and `circle_slice_4` | 79.8 percent | Not a collision. The half-filled disc and the half-swept pie are clearly different marks, which is what makes `circle_half_full` safe for agents running alongside the Todo spinner. |

The structural finding behind the table: inside the filled weight, every pair measured sits between 8 and 26 percent, and the figures do not improve with font size. One terminal cell holds a disc and about two pixels of knockout. **The filled family is one shape with twelve labels.** Treat the knockout as a nod to someone who knows the icon, never as the thing that distinguishes two states to someone reading the Sidebar.

Two shape distinctions do survive, at every size tested:

- filled against ring, 48.3 percent ink against 19.5 percent;
- a part-filled disc against either, `circle_half_full` at 37.0 percent and the slice frames across 22.8 to 46.2 percent.

That is three legible shapes. Any state set larger than three needs colour, position or motion for the rest, which is what CODE already does.

---

## 7. No good candidate

- **`agents` workflow, as a gear.** Confirmed: GN has `md-cog` U+F0493, `md-cog_outline` U+F08BB, `md-cog_box` U+F0494 and `md-cogs` U+F08D6, and no circle-enclosed gear of any kind. The replacement named in §4 is `nf-md-play_circle` U+F040C, a triangle knocked out of a filled disc, depicting a run.
- **`mcp` needs auth, as a credential.** No circle-enclosed lock, key or shield exists in the Material Design range (GN scan, §3). `nf-md-alert_circle` carries "something needs you" rather than "needs auth", and the row's own text says `needs auth`, so the glyph does not have to.
- **`skills` working, as a state.** The glyph exists; what is missing is the state. See the Unverified note in §5.
- **`mcp` connecting, at one visual weight.** The honest mark for "part way" is `circle_half_full` at 37.0 percent ink, which sits below the filled weight. Keeping connecting on the filled weight means `sync_circle` at 44.0 percent, whose arrows do not survive a cell. One of the two has to give.

---

## 8. Recommendation

One coherent set, on the filled weight, with the ring weight reserved for "nothing is happening here" and the part-filled forms reserved for "in flight":

| Section | State | Glyph | Codepoint | Weight |
|---|---|---|---|---|
| todo | completed | `nf-md-checkbox_marked_circle` | U+F0133 | filled, 48.3 |
| todo | in progress | `nf-md-circle_slice_1..8` | U+F0A9E..U+F0AA5 | sweep, 22.8 to 46.2 |
| todo | pending | `nf-md-checkbox_blank_circle_outline` | U+F0130 | ring, 19.5 |
| mcp | ok | `nf-md-checkbox_blank_circle` | U+F012F | filled, 54.5 |
| mcp | needs auth | `nf-md-alert_circle` | U+F0028 | filled, 51.8 |
| mcp | connecting | `nf-md-circle_half_full` | U+F1396 | part-filled, 37.0 |
| mcp | down | `nf-md-close_circle` | U+F0159 | filled, 46.7 |
| mcp | off | `nf-md-minus_circle` | U+F0376 | filled, 51.1 |
| agents | running | `nf-md-sync_circle` | U+F1378 | filled, 44.0 |
| agents | completed | `nf-md-checkbox_marked_circle` | U+F0133 | filled, 48.3 |
| agents | failed | `nf-md-close_circle` | U+F0159 | filled, 46.7 |
| agents | workflow (kind) | `nf-md-play_circle` | U+F040C | filled, 49.9 |
| skills | at rest | `nf-md-lightning_bolt_circle` | U+F0820 | filled, 46.9 |
| skills | working | `nf-md-circle_slice_1..8` | U+F0A9E..U+F0AA5 | sweep, 22.8 to 46.2 |

Three notes on the choices.

The same meaning takes the same glyph across sections: completed is U+F0133 in both Todo and Agents, and a failure is U+F0159 in both MCP and Agents. That is cheaper to learn than two marks for one idea, and it costs nothing, because the sections are never adjacent rows.

The one in-flight mark that is unambiguous at a cell, `circle_half_full`, goes to MCP connecting rather than to Agents running, because an MCP row is static and has to say "wait" on shape alone, while an Agents row carries an elapsed time that is already ticking. If the human would rather keep today's `◐` reading for agents, swap the two: Agents running takes U+F1396 and MCP connecting takes `sync_circle` U+F1378. Both are in the font; nothing else in the set moves.

Each of these glyphs needs the two trailing spaces MEM records, which the MCP, Skills and Agents rows do not have today, because they draw plain Unicode at one cell. Converting those sections is a spacing change as well as a glyph change.
