# Changelog

## 1.0.2 (2026-10-20)

### Features

- write plugin.json's version from the release branch
- write git commands as fixed text and disclose what ctui runs and sets
- move tests/ and evals/ out of the plugin folder and stage them for each run
- generate ctui's listing icon from a cell bitmap in scripts/icon.ts

### Bug Fixes

- draw the Sidebar's Clients and write settings in shapes the directory reads

### Documentation

- record the footer's version, the 1.0.1 bootstrap and one disclosure list
- name ctui's version, not its install commit, in the versions footer
- turn on direct publishing for npm's trusted publisher

### Code Refactoring

- share the release checks and name the manifest assert assertManifestVersion
- share the repo root and claude path from stage.ts and trim the staging memory

## 1.0.1 (2026-10-20)

### Documentation

- describe ctui as a mod and show the sidebar and /ctui menu on npm

### Continuous Integration

- publish to npm from a job in release.yml, with one trusted publisher

## 1.0.0 (2026-10-19)

### Features

- write each release's changelog entry on its release branch
- take the version from the branch name; the footer shows the install commit

### Bug Fixes

- show a model-hidden skill's real source in the skills Sidebar

### Documentation

- disclose the month scan, every-session hook reads and managed Claude Code
- record the footer's install commit and the unversioned package.json
- record how ctui discloses what the directory scan flags
- record agent-context's release strategy for ctui
- record npm as a published copy, not an install path

### Continuous Integration

- apply the release-automation review fixes
- publish each release to npm through publish.yml
- tag, release and back-merge each merge into main

## 0.6.0 (2026-10-17)

### Features

- state the support floor, Claude Code 2.1.292
- list a job of 2 or more outcomes, not a one-line fix
- sweep a busy server's row while a call is in flight
- draw Agents on the shared circle vocabulary
- lead Skills rows with the rest ring
- draw MCP's connection states on the circle vocabulary
- draw Todo on the shared circle vocabulary

### Bug Fixes

- write the rows through one queue so a release is never overwritten

### Documentation

- write the root README
- retire docs/spec into ADRs and docs/configuration.md
- add the Agent skills section to AGENTS.md
- drop the invented re-drive cap from the scenario 6 hold check
- fix live-check review findings
- retire the engine underline from MEMORY.md
- start a live-check pass from a subshell in CONTRIBUTING.md
- drive the live-checks pass the way three measured passes forced
- spec the subshell pass as Part 2 of the live-checks spec
- add the foreground-sleep refusal to the engine-pinned class
- mark the engine-pinned expectations measured on 2.1.300
- redraw the Sidebar renders on the circle vocabulary
- spec the Sidebar's in-progress motion
- spec one rounded icon set for the Sidebar
- record the no-Python rule and Haiku's task tools in MEMORY.md
- record the engine's hover underline and tmux's blank-cell blind spot

### Miscellaneous Chores

- release 0.6.0
- install the /pr skill and fold its sections into the pull-request template
- bump Claude Code to 2.1.300

### Code Refactoring

- share the sweep's row shape and name it honestly

### Tests

- correct the new checks' drive against a run on the pin
- hold the no-fold-line-motion rule to three live checks
- read a section row's glyph at its own content column

### Build System

- spell-check with a pinned cspell devDependency

## 0.5.0 (2026-10-14)

### Features

- seed the stub MCP server so the process-tree check reads both halves
- add a task-list section to Claude's prompt under Task tools
- keep TaskCreate, TaskUpdate and TodoWrite in Claude's prompt under Task tools
- hide Claude Code's own task list while the Sidebar is docked
- cap Todo at 8 rows and show `no tasks yet` for an empty list

### Bug Fixes

- grade the big eval case against the write it cannot avoid
- the gutter ceiling is column 104, and the docked view has no gutter row
- make the frame and gutter checks assert what ctui controls
- hold the task list back from one-piece work
- drop the live checks' assumption that the operator runs Omarchy
- generate the cold-cache cost live check's transcripts with a script
- build the filter's cursor from the placeholder string
- draw the Sidebar glass as a grey under 256-color tmux
- draw /ctui field labels in the Sidebar's colors
- skip workflow agent spawns in Agents & shells
- skip teammate spawns in Agents & shells
- refill the Sidebar's usage and versions on its next draw after /clear
- move the ring through Cost after a refused Monthly cost
- keep a background agent's row while the agent list says waiting
- put the ring on the Themes filter when Themes opens
- put the /ctui ring back on the row Esc returns to
- draw the Todo icons with Nerd Font Material circles
- animate the Todo task in progress with a spinner

### Documentation

- one home each for the model, the duration and the node-pty approval
- record the big eval case's grader gap in the case file
- correct four statements the live-checks build disproved
- cut the live checks to an operator page
- record the no-Python rule and the spell check's two runners
- own the engine-pinned expectations and tie them to the pin
- spec the live-checks build slice
- draw the /ctui menu's four screens as design renders
- expect /theme colors on the /ctui menu's engine parts
- run live checks only in the release pass
- record that capture-pane -e carries SGR across lines
- merge release bugfixes into any release branch

### Miscellaneous Chores

- write the live-check skill's scenarios, checks and report
- port the live-check harness to TypeScript
- install the skills this repo uses at project level
- release 0.5.0

### Code Refactoring

- one coalescer, one splitter, and no unused harness options

### Tests

- name the converted rows by what they assert
- let typos read the streamed mid-word chunk
- convert the reachable live-check gaps to scenario tests
- measure the task-list nudge with a plugin eval suite

### Build System

- install node-pty's binding from npm ci
- confine the Node types to the live-check harness

## 0.4.0 (2026-10-09)

### Features

- /ctui plugin settings screens
- /ctui Plugins screen with on/off and reorder
- Skills section
- MCP rows show their source
- /ctui menu with the Themes screen
- order setting, and a fixed header and footer
- footer names the Theme and wraps to two rows
- MCP rows sort A–Z, and plugin servers and /cd read correctly
- bars turn warning from 50%

### Bug Fixes

- part the Plugins rows' eye from the title by one visible space
- draw the /ctui Settings menu in the Sidebar's look
- list the Skills section and /ctui menu in the plugin description

### Documentation

- renders and README for ctui 0.4.0
- live check reads the 50% bar level
- note how Claude Code reads saved userConfig values after a type change
- merge release/0.3.0 pull requests once checks pass

### Miscellaneous Chores

- release 0.4.0

## 0.3.0 (2026-10-08)

### Features

- Limits cost row adds up every session this month
- Limits cost row against a monthly limit
- space Sidebar sections 1/3 row under titles and 1.5 rows apart
- move the session cost from Context to a Limits cost row
- fold a Sidebar section from anywhere on its title row
- draw Sidebar fold controls in the Theme's muted role
- keep transcript rows 2 columns off the docked Sidebar
- paint the glass under inherit from the active /theme file
- paint the Sidebar body with the Theme's glass
- pick a bundled Theme in /ctui:theme
- generate the 22 bundled Themes from Omarchy 4.0.4 palettes
- draw the Sidebar through its 7 color roles

### Bug Fixes

- keep one space between a bar and its percent
- put the Limits cost row above the 5h window
- Devicons glyphs on the git header rows
- double rule under the git header
- rule between sections, 1 blank row on each side
- hover title rows in accent, add a colon, enlarge the fold arrow
- space sections in whole rows, 1 under titles and 2 apart

### Documentation

- live check for the Sidebar rules' width and colour
- send a bugfix for an open release into its release branch
- close an issue and drop ready-for-agent once its PR merges
- redraw the Sidebar renders from an HTML source
- add tmux and Ghostty setup to the ctui README
- run the full live checklist only for release and main pull requests
- record how the bundled Omarchy Themes ship

### Miscellaneous Chores

- release 0.3.0
- let typos read PNGs as a word
- release 0.2.0
- bump Claude Code to 2.1.292

## 0.1.0 (2026-10-07)

### Features

- label the line under the prompt and the turn footer
- rewrite assistant text, prompts and Read/Edit/Write/Bash rows
- answer /ctui:theme and /ctui:plugins:enable|disable with picker panes
- show the agents Sidebar plugin and raise agent and shell toasts
- show the todo Sidebar plugin and turn on task tools
- show the mcp Sidebar plugin
- show the context and limits Sidebar plugins
- dock the Sidebar with the git header and versions footer
- scaffold the ctui plugin layout

### Bug Fixes

- end an agent's row on its failed notification
- keep Sidebar values whole, refill the footer, prefix every turn footer

### Documentation

- add the configuration docs and finish the plugin README
- write the ctui v0.1 build spec
- record the test strategy decision
- record the toast queue decision
- record the turn footer decision
- record the line under the prompt decision
- record the tool rows decision
- record the todo task tools decision
- record the prompt box and background decision
- record the UserMessage rewrite decision
- record the no-update-icon decision
- record the Workflow run and teammate decisions
- record the background task end and /clear carry-over decisions
- record the MCP Sidebar plugin status decisions
- record the /ctui:* command behavior decisions
- record the no-shipped-Theme decision
- record the no-dock Sidebar decisions
- record the docked Sidebar layout decisions
- update memory with the research ticket answers

### Miscellaneous Chores

- release 0.1.0
- set up agent tooling, CI, and research notes

### Build System

- run ctui checks and tests against pinned Claude Code 2.1.288

### Continuous Integration

- auto-merge the owner's pull requests into develop
