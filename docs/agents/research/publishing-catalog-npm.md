# Publishing claude-tui: Anthropic's directory and npm

> Researched 2026-10-03 against Claude Code **2.1.288**. Builds on `claude-code-plugin-mods-structure.md` (§2, §3.7, §6, §6a, §6b) and `MEMORY.md`.
>
> Source keys:
>
> - `CC:<page>` is `https://code.claude.com/docs/en/<page>.md`, fetched 2026-10-03. `L` is the line in that `.md` file.
> - `CDC:<page>` is `https://claude.com/docs/<page>.md`, fetched 2026-10-03, with the same `L` convention.
> - `POL` is the Anthropic Software Directory Policy (https://support.claude.com/en/articles/13145358-anthropic-software-directory-policy), cited by section number. `TERMS` is the Software Directory Terms (https://support.claude.com/en/articles/13145338-anthropic-software-directory-terms), cited by paragraph. `TM` is https://www.anthropic.com/legal/trademark-guidelines (effective 2024-08-01), cited by paragraph.
> - `GH:po` is `github.com/anthropics/claude-plugins-official` at `d182ca4` (2026-10-02). `GH:pc` is `github.com/anthropics/claude-plugins-community` at `87c843d` (2026-10-01). Both were read with `gh api`.
> - `NPM:<page>` is `https://docs.npmjs.com/<page>`, fetched 2026-10-03 and cited by section name.
> - `E4` is an experiment run in this session's scratchpad: a `ctui` plugin with directory-listing fields, a no-dependency `ctui/package.json`, and a marketplace that has both a `./ctui` entry and an `npm` entry. It ran `claude plugin validate --strict` and `npm pack --dry-run`.
> - **Unverified** marks a claim that no primary source settles.

## Summary

- **The directory** is the catalog on claude.ai (https://claude.ai/directory). You submit through the developer portal at claude.ai/directory/manage, not by PR: GH:pc auto-closes PRs, and the official marketplace takes no portal submissions (CC:plugins/publish L130-132; GH:pc README L26).
  - Inputs: a GitHub repo, a plugin path (`ctui`), and a tracked branch or tag. Submitting needs a paid claude.ai plan (CDC:plugins/submit L23-24, L44-49).
  - Every version is validated and security-scanned. A person reviews a new listing (CDC:directory/publish L84-86).
  - Mods are accepted and listed for Claude Code only (CDC:plugins/platform-support L42).
- **The name `ctui` passes every documented rule.** The displayName `claude-tui` is likely to be **held for a reviewer** under "Name matches a known brand" (CDC:plugins/pre-submission-checklist L109). That is a hold, not a block, but it conflicts with TM ¶3 and ¶5.
- **The blocking gaps today:**
  - No README of 40 or more words inside `ctui/`.
  - No LICENSE inside `ctui/` and no `license` field. The root `LICENSE` is not in the plugin folder (checklist L121-122).
- **Claude Code can install plugins from npm.** Use a marketplace entry with `"source": {"source":"npm","package":…,"version":…,"registry":…}`.
  - The fetch runs no install scripts and installs no dependencies. The only exception is a lockfile beside `package.json` (CC:plugins/marketplace-reference L142, L229-245).
  - An `npm` *marketplace* source is not implemented (L357).
- **The npm layout:** commit `ctui/package.json` with no dependencies, no scripts, no lockfile, and a `files` whitelist. Keep the dev `package.json` and lockfile at the root.
  - Without a lockfile, no dependency install runs (CC:plugins/loading L221), and validation stays clean (E4).
- **The npm name:** `ctui` is taken on npm. `claude-tui` is free but collides with npm's trademark and similar-name guidance. **Use `@a1exk-dev/ctui`** (free as of 2026-10-03).
- **The release flow:** bump the versions in `release/x.y.z` and merge to `main`, which the directory tracks. Tag `vX.Y.Z` (plus `ctui--vX.Y.Z` from `claude plugin tag`). Then a tag workflow runs checks, publishes to npm with trusted publishing and provenance, and creates the GitHub release.

## Anthropic directory

### Where and how to submit

| Fact | Source |
|---|---|
| The directory is the claude.ai catalog. One listing reaches claude.ai, Cowork and Claude Code. | CC:plugins/publish L130 |
| `claude-plugins-official` takes no portal submissions. A listing there goes through an Anthropic partner contact. | CC:plugins/publish L132 |
| The community marketplace (`claude-community`) is a read-only nightly mirror of approved directory submissions. PRs are auto-closed. | GH:pc README L7-9, L26 |
| GH:po's README still points third parties to `clau.de/plugin-directory-submission`. | GH:po README L28 |
| Requirements: Pro, Max, Team or Enterprise (Free can't submit). On Team or Enterprise, an Owner submits. The first organization to submit a repo folder owns the listing. | CDC:directory/publish L31-35 |
| Steps: **Submit new**, then **Plugin bundle**, then **Source** (repo, plugin path, branch or tag), **Validate**, **Listing details**, **Data handling**, **Compliance** (4 acknowledgements), **Review and submit** | CDC:plugins/submit L35-86 |
| The connected GitHub account needs push access. A private repo can be validated and submitted (with source upload and the Claude GitHub App), but it **must be public to publish**. | CDC:plugins/submit L23, L98-119 |
| Limits: 10 submissions per organization per 24 hours, and one submission per repo and folder. The repo and folder can't change after submission. | CDC:plugins/submit L92-96, L180 |
| Terms you agree to: indemnity, a vulnerability-report mechanism, no implied endorsement, and compliance with TM | TERMS ¶2, ¶4, ¶5 |

### Manifest and listing requirements

| Requirement | Result if missing | Source |
|---|---|---|
| `.claude-plugin/plugin.json` in the submitted folder | Blocks | checklist L88 |
| README of at least 40 words in the plugin folder (code blocks don't count) | Blocks | checklist L121 |
| `LICENSE` in the plugin folder **or** `license` in `plugin.json` | Blocks | checklist L122 |
| `description`, `author`, `version` | Warning | checklist L113 |
| `name`: lowercase letters, digits and `-`, at most 64 characters, not taken, not reserved (`claude`, `anthropic`, `official`, `plugin`, `mcp`, `test` as the whole name), nothing that presents the plugin as official | Blocks or held | checklist L106-108 |
| Name, `displayName` and `author.name` not mistakable for a well-known brand that isn't yours | **Held for a reviewer** ("Name matches a known brand") | checklist L109 |
| `displayName` and `author.name` in one script, with no look-alike or invisible characters | Blocks | checklist L111 |
| No `.DS_Store` and similar files. Names valid on Windows and macOS (no `:`). Folder names on the path use only `[A-Za-z0-9._-]`. | Blocks or stops validation | checklist L92-94 |
| Each non-image file under 256 KiB, at most 512 files, only text, image or font files | Held | checklist L130-132 |
| `package.json` **with** a lockfile at the plugin root | **Always held** ("Dependencies install from a lockfile") | checklist L157 |
| Readable source, not compiled or minified | Held otherwise | checklist L182 |
| `hooks/hooks.json` may contain a `modules` array for a mod | Blocks if invalid | checklist L168 |

**Optional listing fields.** `icon` (a path to an image inside the plugin), `documentationUrl`, `supportUrl`, `privacyPolicyUrl` and `termsOfServiceUrl` (each `https://`) are read by the directory only.

- Put them only in `plugin.json`. In a marketplace entry, `validate` flags them as unknown fields.
- They are accepted without a warning from v2.1.281 (CC:plugins/manifest-reference L137-141, L194-200).
- E4: `validate --strict` passed with all five set.

**Name rules for `ctui`.**

- `claude plugin validate` gives an error for a `claude-` prefix and a warning for "claude" as a whole word (CC:plugins/manifest-reference L169-178).
- `ctui` matches no reserved word, and no plugin named `ctui` exists in GH:po or GH:pc (grep of both `marketplace.json` files). **It passes.**

**`displayName: "claude-tui"`.**

- `validate` doesn't check display names (E3 in the earlier doc).
- The directory holds names that "can't be mistaken for … a well-known brand that isn't yours" for a reviewer (checklist L109).
- TM ¶3 says Anthropic's marks may be used "only as specifically permitted". TM ¶5 forbids implying sponsorship or affiliation. TERMS ¶5 requires compliance with TM.
- Practice is mixed: GH:pc lists 191 plugin names that contain "claude", for example `claude-hud`.
- **Expect a Policy hold. Rejection is unverified.**
- A descriptive form such as "ctui: sidebar for Claude Code" avoids the brand-as-name pattern. Whether reviewers accept "for Claude Code" is **unverified**.

**Privacy and terms URLs.**

- POL §3A requires a privacy policy link only for software that "collects user data or connects to a remote service".
- POL §3B-C require contact and support channels plus documentation. POL §3E asks for at least three example use cases.
- POL §3D asks for a test account. That likely doesn't apply to a local mod (**unverified**).
- If ctui makes no network calls, `privacyPolicyUrl` is optional. It is still cheap to add (a "collects nothing" page), and the **Data handling** step asks these questions anyway (CDC:plugins/submit L66-67).

### Mods-specific policy

- **Mods are listed.** "The directory lists a mod … for Claude Code" (CDC:plugins/platform-support L42). Hooks load in Cowork and Claude Code and are ignored in chat (L35).
  - `bin/` makes chat and Cowork refuse the whole plugin (L39). ctui has no `bin/`; keep it that way.
- **The security scan** looks for undisclosed behavior: sending data elsewhere, hidden code, or permission changes. A first submission that fails is rejected (checklist L175-182).
  - The README should describe everything the plugin "runs, sends, or fetches".
- **The `$` capability surface is visible to reviewers.** `claude plugin validate` prints the `hooks:` and `calls:` lines for a mod. It flags `$.process.*`, `$.http.fetch`, `$.fs.*` and `$.env.get` as sensitive, and notes that `tool.call` "sees every tool call" (CC:plugins/mods/admin L102-130).
  - No published directory rule bans any `$` call. **Unverified** whether the scan treats ungated `tool.call` as a finding.
- **The scan prompt in the official marketplace's CI is strict on two points** (GH:po `.github/policy/prompt.md` L91-103, used by `scan-plugins.yml` on PRs to external entries):
  - It fails "broad scope hooks": `PreToolUse` or `PostToolUse` that run with no project-relevance gate.
  - It fails "undisclosed telemetry": any outbound call not disclosed in the description or README, with an opt-out.
  - Whether the directory's scanner uses the same prompt is **unverified**. Treat it as the likely bar.
  - ctui's `register.tsx` watches Bash `tool.call` in every session (MEMORY.md, agents toasts). Say so plainly in `description` and the README.
- **Policy rules that apply to ctui** (POL):
  - §1D: collect only the context data it needs.
  - §1F: don't extract chat history.
  - §2G: no obfuscated instructions.
- **Mods that come from the directory count as the user's.** Under `allowManagedModsOnly`, a mod synced from claude.ai doesn't load (CC:plugins/mods/admin L43).

### What reviewers check, and how updates flow

- **Each new commit on the tracked branch or tag is re-validated and re-scanned.** A passing version goes live according to the publish setting.
  - The default is that a reviewer publishes each version. Auto-publish options exist.
  - A failed scan makes later versions wait for a reviewer (CDC:plugins/submit L121-170).
- **A tracked tag stays on its commit until you move it**, so tracking `main` is simpler (L49, L161).
- **A push webhook is optional and needs repo admin.** Scheduled checks always run (L81-84, L163).
- **The directory reads and scans only the plugin folder** when a path is given (L168).
- **Raise `version` with every release** (L172).
- **Directory installs load in Claude Code as `ctui@synced`.**
  - When the user also has `ctui@claude-tui` (or an npm copy) enabled, the non-synced copy wins by manifest name, and the synced copy shows as not loaded (CC:plugins/loading L54, L91, L368).
  - A user therefore never runs two copies of the mod.
- **Tags.**
  - `claude plugin tag` creates `ctui--v<version>`. It checks that `plugin.json` and the marketplace entry agree, and refuses a dirty tree, an existing tag, or a missing version (CC:plugins/cli-reference L506-546).
  - Tags are needed only when other plugins declare version ranges on yours (CC:plugins/publish L173-177; CC:plugins/host-marketplace L203).
- **Evals.**
  - `claude plugin eval` is optional ("If you have an eval suite", CC:plugins/publish L65-66). It scores prompts with and without the plugin and costs model usage (CC:plugin-evals L22, L36).
  - ctui has no skills, so evals have little to measure. **`claude plugin test`** (`*.test.ts(x)`, no network) is the relevant gate for a mod (CC:plugins/cli-reference L548-556).
  - The checklist only says to "test the plugin's output and how it loads" (checklist L184-196).

## npm

### Claude Code support

| Fact | Source |
|---|---|
| Plugin source `npm` has the fields `package` (name, `name@ver`, or an https tarball), `version` (version, range or dist-tag; default `latest`) and `registry` (https) | CC:plugins/marketplace-reference L142, L231-235 |
| The fetch uses the user's npm client. **Install scripts never run. Dependencies are not installed during the fetch.** A supported lockfile triggers a separate install with scripts disabled. | L237; CC:plugins/loading L254 |
| Refused values: git, `file:` and `npm:` aliases, tarball links on github.com, and `http` registries | L239-245 |
| An `npm` **marketplace** source fails with `NPM marketplace sources not yet implemented`. Only the plugin-entry source works. | L357 |
| Before install, Claude Code reads `plugin.json` only for relative-path entries. For npm, users see only the entry's fields. | L117 |
| The cache is `cache/<mkt>/<plugin>/<version>/`. A copied plugin is the package contents. | CC:plugins/loading L169, L187 |
| The dependency install runs only when the plugin root has `package.json` **and** a lockfile (`bun.lock`, `npm-shrinkwrap.json`, `package-lock.json`). For npm-published plugins, use `npm-shrinkwrap.json`, because npm drops `package-lock.json`. | CC:plugins/loading L221-240 |
| Version for an npm source with no `version` field: `unknown`. Keep `version` in `plugin.json`. | CC:plugins/loading L284-294 |
| Two entries with the same `name` in one marketplace is an error. One marketplace serves one version per plugin. | CC:plugins/marketplace-reference L451; CC:plugins/host-marketplace L220 |
| A `url` marketplace (a direct link to a `.json` file) can't resolve relative paths, so it needs object sources such as `npm` | CC:plugins/marketplace-reference L170 |
| Neither GH:po (315 entries) nor GH:pc (2,283 entries) uses an `npm` source. Both use `url` or `git-subdir` pinned to a `sha`. | `jq` over both `marketplace.json` files |

**Does Claude Code honor `files`?** Indirectly. `files` decides what goes into the tarball at `npm publish` (NPM:package.json "files"). Claude Code unpacks that tarball, so only those files land in the cache.

- `package.json`, `README*` and `LICENSE*` are always included (NPM:package.json "files").
- **Unverified:** that the tarball's `package/` root becomes the plugin root. No `path` field exists, so `.claude-plugin/plugin.json` must sit at the package root.

**Does a `package.json` in the package trigger an install?** Not without a lockfile (CC:plugins/loading L221). Never publish `npm-shrinkwrap.json`.

### Layout

- **The package is `ctui/` itself.** Publish with `npm publish` from `ctui/`.
- **Commit `ctui/package.json`** with:
  - `name`, `version` (equal to `plugin.json`), `description`, `license: "MIT"` and `keywords`
  - `repository: {type, url, directory: "ctui"}` (NPM:package.json "repository"; provenance needs a matching public repo)
  - `files: [".claude-plugin/plugin.json", "commands", "hooks", "plugins", "themes", "types", "icon.png", "README.md", "LICENSE", "CHANGELOG.md"]`. This excludes `tests/`, `tsconfig.json` and `.claude-plugin/types/`.
  - `publishConfig: {access: "public", provenance: true}`
  - **No** `dependencies`, `devDependencies`, `scripts`, `bin` or `main`.
- **E4 check.** `npm pack --dry-run` packed exactly the whitelisted files, including the dot-folder `.claude-plugin/plugin.json` when named explicitly. `validate --strict` on the plugin passed with this `package.json` present.
- **Root files stay as planned.** The root `package.json` (`"private": true`, devDependencies such as typescript) and `package-lock.json` stay at the root. Do not make `ctui` an npm workspace: that keeps the root lockfile the only lockfile and avoids accidental coupling.
- **Alternative.** Generate `ctui/package.json` in CI only, so git users never see it. Committing it is more transparent to the scanner and costs nothing, because no lockfile means no install.

### Name

| Name | Status 2026-10-03 (`npm view`) | Note |
|---|---|---|
| `ctui` | **Taken** (v1.0.3, unrelated, 2022) | Not usable |
| `claude-tui` | Free | `claudetui` exists (v0.1.0, 2026-08, a Claude Code dashboard). npm says unscoped names must not be "spelled in a similar way to another package" and must not use "someone else's trademarked name" (NPM:package-name-guidelines). npm handles trademark claims under GitHub's Trademark Policy (NPM:policies/disputes "Trademarks"). **Avoid.** |
| `@a1exk-dev/ctui` | Free | Needs an npm user or organization named `a1exk-dev`. Whether it exists is **unverified**: npmjs.com returned 403 to curl, and `npm whoami` returned E401. Reserving names without publishing is squatting (NPM:policies/disputes "Squatting"). |

### Publishing from GitHub Actions

- **Trusted publishing (OIDC).**
  - Needs npm CLI ≥ 11.5.1, Node ≥ 22.14.0, and a GitHub-hosted runner. You configure the repo and workflow filename on the package's npm settings page (NPM:trusted-publishers "Configuring trusted publishing").
  - Setup is done "in your package settings", so **the first publish is probably manual with 2FA or a token (unverified)**.
- **Provenance.**
  - Generated automatically under trusted publishing, but only from a **public** repo (NPM:trusted-publishers "Publishing from a public repository").
  - With a token instead, use `npm publish --provenance --access public` with `permissions: id-token: write` (NPM:generating-provenance-statements).
  - The `repository` field must match the publishing repo, case-sensitive.

## Structure changes (diff against §6)

```text
claude-tui/
├── .claude-plugin/marketplace.json   add "description" (validate --strict warns without it, E4); keep plugins[0] = {"name":"ctui","source":"./ctui"}
├── .github/workflows/
│   ├── ci.yml                        on PR/push: scripts/check.ts (tsc, validate --strict ctui and ., plugin test, registry + version consistency)
│   └── release.yml                   on tag v*: scripts/check.ts, assert tag == plugin.json == ctui/package.json, npm publish (OIDC), gh release create
├── ctui/
│   ├── .claude-plugin/plugin.json    + license, homepage, repository, author, icon, documentationUrl, supportUrl, privacyPolicyUrl
│   ├── package.json                  NEW: npm manifest only; no deps, no scripts, files whitelist (above); NO lockfile, ever
│   ├── README.md                     ≥40 words; tested Claude Code version; what it reads/runs/sends (git via $.process, tool.call watch, any $.http)
│   ├── LICENSE                       NEW copy of root LICENSE (plugin folder needs it; root LICENSE is not copied to users)
│   ├── CHANGELOG.md                  NEW
│   ├── icon.png                      NEW (PNG/JPEG/WebP/SVG; referenced only from plugin.json/README)
│   └── … (unchanged)
├── docs/PRIVACY.md (or a Pages URL)  "collects nothing, no network" statement → privacyPolicyUrl
├── SECURITY.md                       vulnerability-report channel (TERMS ¶4); enable GitHub private vulnerability reporting
├── package.json, package-lock.json   unchanged: dev-only, "private": true
└── (optional) marketplace-npm.json   second catalog "claude-tui-npm" with {"name":"ctui","source":{"source":"npm","package":"@a1exk-dev/ctui","version":"x.y.z"}}
```

**The npm entry needs its own catalog.**

- It can't sit beside `./ctui` under the same name (duplicate-name error), and a second name (`ctui-npm`) would be a second plugin id.
- Host it as a separate marketplace instead: a `url` source pointing at the raw JSON, or a second repo or branch.
- **Unverified** in a live install. Its only value is for people who can reach npm but not GitHub, or who want provenance. The git route remains primary.

## Release pipeline (Git Flow)

1. **Prepare the release on a branch.** On `release/x.y.z` from `develop`:
   - Bump `ctui/.claude-plugin/plugin.json` `version` and `ctui/package.json` `version`.
   - Update `CHANGELOG.md` and run `scripts/check.ts`.
2. **Merge to `main`.** It must be the GitHub **default branch**: users who add `a1exk-dev/claude-tui` and the directory (empty tracked-ref field) both follow the default branch (CDC:plugins/submit L49).
   - If `develop` were the default branch, unreleased work would reach users.
3. **Tag `main`.**
   - Git Flow tag: `vx.y.z`.
   - Optionally also `claude plugin tag ctui --push`, which creates `ctui--vx.y.z` and checks version agreement (CC:plugins/cli-reference L506-524).
4. **Let `release.yml` run on `v*`.** It runs the checks, verifies that the tag matches both versions, runs `npm publish` from `ctui/` (OIDC, provenance), and creates the GitHub release with notes from CHANGELOG.
5. **Directory.** It picks up the `main` commit through the webhook or a scheduled check. It scans the commit and publishes it under the listing's publish setting (CDC:plugins/submit L159-172). No portal visit is needed unless a version is held.
6. **Own-marketplace users** get the new `version` through `claude plugin update ctui@claude-tui` or auto-update, which is off by default (CC:plugins/publish L117-122).

## Pre-submission checklist

- [ ] `ctui/README.md`, at least 40 words outside code blocks. It covers:
  - purpose, install (`/plugin install ctui@claude-tui`), commands and settings
  - the **tested Claude Code version** (≥ 2.1.287, where mods are on by default; CC:plugins/mods/admin L11), plus the fullscreen 110-column requirement
  - troubleshooting (POL §3C)
  - three example use cases (POL §3E)
  - a "what it accesses" section listing every `$` call from `validate` output
- [ ] `ctui/LICENSE`, or `"license": "MIT"` in `plugin.json`. Do both.
- [ ] `plugin.json` has `description` (mention the tool-call observation), `author`, `version`, `homepage`, `repository`, `icon`, `supportUrl` (public GitHub Issues) and `documentationUrl`.
- [ ] Privacy statement URL (POL §3A, if any data or network is involved) and `SECURITY.md` (TERMS ¶4).
- [ ] Decide the displayName (see Open questions).
- [ ] `claude plugin validate ctui --strict` and `claude plugin validate . --strict` (marketplace `description` added) pass. `claude plugin test ctui` passes.
- [ ] No `.DS_Store`, symlinks, LFS, `export-ignore` or colons in names. Every file under 256 KiB. No lockfile in `ctui/`.
- [ ] Install test: `claude plugin marketplace add ./` and then `claude plugin install ctui@claude-tui` in a clean `CLAUDE_CODE_PLUGIN_CACHE_DIR` (CC:plugins/publish L54-58).
- [ ] CI (`ci.yml`, `release.yml`), `CHANGELOG.md`, and the first tag `v0.1.0`.
- [ ] Repo public (it already is). Paid claude.ai account with GitHub connected. Webhook needs repo admin.
- [ ] npm: account or org `a1exk-dev`, 2FA, first manual publish, then the trusted publisher configured for `release.yml`.

## Open questions

1. **displayName.** Keep "claude-tui" and accept a likely brand hold, or switch the listing label to something like "ctui: sidebar for Claude Code"? The repo and marketplace name `claude-tui` stay either way. Directory acceptance of either form is **unverified**.
2. **Does the directory scanner fail ungated `tool.call` hooks**, as GH:po's CI prompt does for `PreToolUse`/`PostToolUse`? This is **unverified**. Mitigations:
   - disclose in `description` and README
   - gate the shell watch behind `agents_enable`/`agents_toasts`, which are already options
3. **Does ctui make any network call** (for example, the versions footer checking for the latest release)? If so, it must be disclosed with an opt-out, and `privacyPolicyUrl` becomes required.
4. **Is the npm route worth a second catalog?** The directory and the git marketplace cover Claude Code users, and nobody in GH:po or GH:pc ships from npm. npm mainly adds provenance and a mirror.
5. **Should the issue tracker be public?** The issues are public because the repo is. Only the GitHub Project board is private (docs/agents/issue-tracker.md). That is fine for `supportUrl` (POL §3B). Just don't link the private project.
6. **Does the subfolder plugin path cause holds?** The "Scripts the validator couldn't follow" rule targets hook, MCP and LSP *commands* in subfolder plugins (checklist L149-158). Whether it also covers mod `modules` is **unverified**. Running the portal's **Validate** on the public repo is free and answers it.
7. **Who submits?** The listing belongs to the claude.ai organization that submits first. Use a personal Pro or Max account unless an organization should own it (CDC:directory/publish L35).
