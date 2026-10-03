# Claude Mods — Comprehensive Research Document

> **Date:** 2025-10-03
> **Purpose:** Exhaustive investigation of everything that can be used to modify, customize, and improve the Claude interface experience.
> **Scope:** Official Anthropic surfaces, browser-level mods for claude.ai, open-source projects, prompt engineering as modding, Claude Code extensibility, MCP.

---

## 1. Anthropic's Official Customization Surfaces

### 1.1 Messages API — System Prompts

Anthropic's core product is the **Messages API** (`POST https://api.anthropic.com/v1/messages`), which gives developers direct programmatic control over everything that shapes Claude's behavior.

The `system` parameter in message requests accepts a string or list of content blocks, allowing complete customization of Claude's system prompt on every API call:

```
/system: "You are a coding assistant specialized in Rust..."
```

This is the fundamental modification surface — by changing the system prompt, you can fundamentally alter Claude's tone, behavior, capabilities, and domain focus. The Messages API documentation is at [platform.claude.com/docs/en](https://platform.claude.com/docs/en).

**Key source:** [Messages API overview](https://platform.claude.com/docs/en/home) · [Tool use overview](https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview)

### 1.2 Developer Presets (Developer Console Feature)

Anthropic offers **Developer Presets** in the Messages API, which are named configurations that bundle system prompts with specific tool selections. These can be referenced by name rather than repeating the full configuration:

- `developer_1_0_basic` — Basic developer preset
- `developer_1_0_advanced` — Advanced developer preset  
- `developer_1_0_code_interpreter` — Code interpreter variant

This is an Anthropic-authored convenience feature, not a user-customizable presets system per se, but it shows the direction of structured prompt configuration.

**Key source:** [Messages API quickstart](https://platform.claude.com/docs/en/get-started)

### 1.3 Claude Managed Agents — Pre-built Agent Configurations

Anthropic offers **Claude Managed Agents** as an alternative to raw API access, providing pre-configured agent harnesses:
- Long-running tasks and asynchronous work
- Built-in toolset (web search, code execution, etc.)
- Configurable within Anthropic's infrastructure

This is Anthropic's own "modification surface" — they define what the managed agents can do.

**Key source:** [Claude Managed Agents overview](https://platform.claude.com/docs/en/managed-agents/overview)

---

## 2. Claude Code — Extensibility System

Claude Code (`claude`) is Anthropic's **official terminal-based agentic coding tool**. It has one of the most sophisticated extensibility systems in the AI-coding space, and it's the primary focus of "modding" activity today.

### 2.1 CLAUDE.md / AGENTS.md — Persistent Instructions

Claude Code reads `CLAUDE.md` (or `AGENTS.md`) files from multiple locations at session start:

| Scope | Location | Example |
|-------|----------|---------|
| Managed policy | `/etc/claude-code/CLAUDE.md` (Linux) | Organization-wide standards |
| User instructions | `~/.claude/CLAUDE.md` | Personal preferences for all projects |
| Project instructions | `./CLAUDE.md` | Team-shared project conventions |
| Local instructions | `./CLAUDE.local.md` | Per-user per-project (gitignored) |

Files load in order from broadest to narrowest scope. Subdirectory CLAUDE.md files load on demand when Claude reads files in those directories. Path-scoped rules in `.claude/rules/` further constrain when instructions apply.

**Key source:** [CLAUDE.md docs](https://code.claude.com/docs/en/memory)

### 2.2 Skills — On-Demand Workflow Instructions

Claude Code **Skills** follow the [Agent Skills Open Standard](https://agentskills.io). A skill is a directory with a `SKILL.md` file containing YAML frontmatter and markdown instructions:

```yaml
---
name: deploy-prod
description: Deploy the application to production
disable-model-invocation: true
allowed-tools: Bash, Read, Write
---

## Instructions
1. Run tests
2. Build
3. Deploy
```

**Skill locations:**
- `~/.claude/skills/<name>/SKILL.md` — Personal (all projects)
- `.claude/skills/<name>/SKILL.md` — Project-level (team-shared)
- Enterprise managed settings deployment
- claude.ai account sync for Cowork/cloud sessions

**Features:** Dynamic context injection (`!`command``), argument substitution (`$ARGUMENTS`, `$0`, etc.), model/effort overrides, subagent execution (`context: fork`), pre-approved tool grants.

**Agent Skills Spec:** [agentskills.io/specification](https://agentskills.io/specification) (from [anthropics/skills/spec/agent-skills-spec.md](https://github.com/anthropics/skills/blob/main/spec/agent-skills-spec.md))

**Key source:** [Skills docs](https://code.claude.com/docs/en/skills) · [Agent Skills repo: anthropics/skills](https://github.com/anthropics/skills) (179k stars)

### 2.3 Plugins — Packaged Extensions

Plugins are directories that bundle skills, agents, hooks, MCP servers, and optionally a **mod** (JavaScript hooks module). They install as units:

```
my-plugin/
├── .claude-plugin/plugin.json     # manifest
├── skills/review/SKILL.md         # skill component
├── agents/reviewer.md             # subagent definition
├── hooks/hooks.json               # lifecycle hook definitions
├── hooks/register.js              # JavaScript event handler (mod)
└── .mcp.json                      # bundled MCP server config
```

**Plugin installation:** `/plugin` menu, `claude plugin install <name>@<marketplace>`, or `--plugin-dir` for local development. Three scopes: user, project, local.

**Marketplaces:** Anthropic's official (`claude-plugins-official`), community (`claude-community`), and third-party marketplaces. Marketplaces are catalogs — not hosted stores — defined by `.claude-plugin/marketplace.json`.

**Key source:** [Plugins overview](https://code.claude.com/docs/en/plugins/overview) · [Create a plugin](https://code.claude.com/docs/en/plugins/create)

### 2.4 Mods — JavaScript Event Handlers (The Deep Modding Surface)

**Mods** are the most powerful extensibility mechanism in Claude Code. A mod is a plugin with a `register.js` file that registers JavaScript/TypeScript event handlers. Claude Code calls these handlers when events happen, and they can:

- **Draw interface elements:** panes beside the transcript, bands above the prompt, buttons, text fields
- **Rewrite tool calls or prompts** before they execute
- **Add custom commands** (`/my-command`) that run JavaScript functions
- **Access Claude Code's internal API:** model calls, file reads, process spawning
- **Share state between hooks:** a mod's handlers share variables in their module

Example mod (from Claude Code docs):

```javascript
// hooks/register.js
export function register(on) {
  let calls = 0
  
  // Count tool calls
  on('tool.call', async ($, e, next) => {
    calls += 1
    $.ui.invalidate('ui.render')
    return next(e)
  })

  // Modify the spinner UI
  on('ui.render', { component: 'Spinner' }, async ($, e, next) => {
    return next({ ...e, props: { ...e.props, suffix: ' · calls: ' + calls } })
  })
}
```

**Event types:** `tool.call`, `prompt.submit`, `turn.start`, `ui.render`, `model.response`, and more (see [hooks reference](https://code.claude.com/docs/en/plugins/mods/reference)).

**Built-in mods:** `/diff` pane, `agents-md` loader, telemetry, security guard — some are open source at [anthropics/claude-code/mods/](https://github.com/anthropics/claude-code/tree/main/mods).

**Sample mods:** Available in [anthropics/claude-code-playground/claude-code/mods/](https://github.com/anthropics/claude-code-playground/tree/main/claude-code/mods) — `token-weather`, `blast-radius`, `replay-theater`.

**Key source:** [Mods overview](https://code.claude.com/docs/en/plugins/mods/overview) · [Hooks reference](https://code.claude.com/docs/en/hooks)

### 2.5 Hooks — Lifecycle Event Triggers (Non-JS Alternative)

For users who prefer shell commands over JavaScript, Claude Code provides **hooks** that execute at lifecycle events:

| Event | When it fires | Can block? |
|-------|---------------|------------|
| `SessionStart` | Session begins/resumes | No |
| `PreToolUse` | Before tool execution | **Yes** (permission decision) |
| `PostToolUse` | After successful tool call | No |
| `UserPromptSubmit` | When prompt submitted | No |
| `Stop` | When Claude finishes | No |
| `InstructionsLoaded` | CLAUDE.md loaded | No |
| `ConfigChange` | Settings file changed | No |

**Hook types:** command (shell script), HTTP (POST request), MCP tool call, prompt (single-turn LLM evaluation), agent (subagent).

Hooks can **block tool execution** by returning a `permissionDecision: "deny"` — useful for preventing `rm -rf`, force pushes, or other dangerous operations.

**Key source:** [Hooks reference](https://code.claude.com/docs/en/hooks)

### 2.6 MCP (Model Context Protocol) Servers

Claude Code connects to hundreds of external tools via **MCP**. MCP servers provide tools, resources, and prompts to Claude Code:

```bash
claude mcp add --transport http github https://mcp.github.com/mcp
claude mcp add --transport stdio sqlite -- npx -y @dataformco/sqlite-mcp-server
```

Transport types: HTTP (recommended), SSE (deprecated), stdio (local process), WebSocket.

Plugins can bundle MCP servers that connect automatically when the plugin is enabled.

**MCP Spec repo:** [modelcontextprotocol/typescript-sdk](https://github.com/modelcontextprotocol/typescript-sdk) (13.5k stars) · [Specification](https://modelcontextprotocol.io/specification/2026-07-28)
**MCP is MIT licensed**, created by David Soria Parra and Justin Spahr-Summers.

**Key source:** [MCP docs for Claude Code](https://code.claude.com/docs/en/mcp)

### 2.7 Other Claude Code Features Worth Noting

- **Sub-agents:** Spawn parallel Claude agents (`/agents`), each with own tools, models, and memory
- **Status lines:** Customizable status bars via `statusLine` setting or status line scripts (e.g., [ccstatusline](https://github.com/sirmalloc/ccstatusline) with 13k stars)
- **Settings:** Extensive JSON settings at user/project/local level (`~/.claude/settings.json`)
- **Web/IDE/Desktop surfaces:** Claude Code runs in terminal, VS Code extension, JetBrains plugin, desktop app, and web browser
- **Routines:** Scheduled recurring tasks running in the cloud
- **Agent SDK:** Build custom agents using [Anthropic's Agent SDKs](https://code.claude.com/docs/en/agent-sdk/overview) (Python: [claude-agent-sdk-python](https://github.com/anthropics/claude-agent-sdk-python) · TypeScript: [claude-agent-sdk-typescript](https://github.com/anthropics/claude-agent-sdk-typescript))

---

## 3. Browser-Level Modifications for claude.ai

### 3.1 The claude.ai Web UI Architecture

The claude.ai web application is behind **Cloudflare protection** (`challenges.cloudflare.com`), making direct scraping impossible without authentication. However, several clues reveal its architecture:

- The HTML contains `<div class="main-wrapper">` and `<div class="main-content">` — standard React/Next.js patterns
- No obvious server-side framework markers were visible in the initial page load
- The application is a **single-page application (SPA)** that loads JavaScript client-side
- It's likely built on **React** (Anthropic's technology stack uses React) with custom styling

### 3.2 Chrome Extensions That Modify claude.ai

Several Chrome/Web extensions successfully modify the claude.ai interface via CSS injection and DOM manipulation:

#### [Claude Studio](https://github.com/ILYAGVC/Claude-Studio) — ⭐ 5
RTL & multilingual support, 50+ fonts, pro typography, light/dark/black themes, accent colors, corrected math & code rendering. Uses a Chrome extension with custom CSS to override claude.ai styles.

#### [Crystal-Glass-CSS-for-Claude-Stylus](https://github.com/RocketReaper/Crystal-Glass-CSS-for-Claude-Stylus-) — ⭐ 2
Frosted glass theme for Claude.ai using a Chrome/Stylus extension. Custom wallpaper, blurred panels, dark overlay, glass bubbles, styled code blocks.

#### [claude-usage-tracker](https://github.com/rishimule/claude-usage-tracker-chrome-extension) — ⭐ 1
Persistent usage-tracker footer injected into claude.ai — shows plan and remaining messages/spend, theme-matched.

#### [chameleon](https://github.com/churin1116/html-chameleon) — ⭐ 2
Shared theme contract (21 CSS variables + Tailwind utility classes) so HTML can be repainted by a Chrome extension. Shows the pattern for theming Claude's artifacts.

### 3.3 How Browser Mods Work on claude.ai

The general technique is:
1. **CSS Injection:** Inject custom CSS via a Chrome extension (`content_scripts` + `@grant GM_addStyle`) or Stylus
2. **DOM Mutation:** Observe DOM changes via `MutationObserver` and apply modifications to Claude's response containers
3. **Overlay UI:** Add buttons, panels, or footers on top of claude.ai using shadow DOM injection

**Practical takeaway:** Browser-level CSS injection is the most reliable way to modify the claude.ai web interface without official APIs. This requires no reverse engineering — just target known DOM class names and override styles.

### 3.4 Claude-for-Chrome Extension

[claude-for-chrome](https://github.com/cocodem/claude-for-chrome) (⭐ 271k stars — likely a different repo, the search returned incorrect count) is an extension that opens Claude in a Chrome sidebar using your own API key, avoiding the claude.ai waitlist.

### 3.5 Puppeteer/Playwright for UI Modification

While no specific project targets claude.ai via Playwright/Puppeteer for modification, these tools could theoretically:
- Automate DOM manipulation after page load
- Inject scripts that run in the page context
- Capture and modify network requests/responses

This is an unexplored surface for "modding" claude.ai programmatically.

### 3.6 Deep Dive: Complete UI Restyling of claude.ai

#### 3.6.1 claude.ai Web App Technical Architecture

**Framework and rendering model.** The claude.ai web application is a **React-based single-page application (SPA)** hosted on AWS Cloud Services with Cloudflare CDN/protection. Evidence for React includes:
- `[data-testid="..."]` attribute patterns used throughout the DOM (standard testing pattern from `@testing-library/react`)
- Multiple isolated scoped containers with `data-mode` attributes (`.cds-root`, `.epitaxy-root`) — a hallmark of React component tree rendering
- ProseMirror integration for the composer (documented in extension source code as `.ProseMirror`)

**CSS architecture: CSS custom properties (design tokens), not CSS-in-JS per-element.** Claude.ai does **not** use emotion/styled-components to generate unique hash-based class names on every element. Instead, it uses **CSS custom properties (variables)** as a design token system. The variables live on `:root` and are re-declared on nested `[data-mode]` containers. This is the single most important finding for extension developers, because:

- **Overriding CSS variables via `!important` on selectors that reach all scopes completely restyles the UI.** Extensions can target multiple token-scoped roots simultaneously: `:root, html, [data-mode], .cds-root, .epitaxy-root, .dark, .light` (from Claudy's content script).
- **The tokens are semantic**, not per-element. There are two families:
  - **Legacy/primary layer** (`--bg-*`, `--text-*`, `--border-*`, `--accent-*`, `--brand-*`, `--pictogram-*`): HSL triplet values consumed via `hsl(var(--token) / alpha)` syntax. The numbering is *contrast-based*, not light/dark-based: `--bg-000` is the **lightest** surface, `--bg-500` is the darkest — in both light and dark modes. Similarly, `--text-000` has the most contrast, `--text-500` the least.
  - **CDS (Claude Design System) layer** (`--cds-*`): Newer surfaces use real hex colors rather than HSL triplets. This covers the composer's model/effort pickers, attach/mic/voice buttons, and dropdown menus. A CDS container can carry its own nested `data-mode`, meaning a dark-themed composer bar inside an otherwise light page (which causes white-on-white icon rendering if the extension only themes one layer).
  [^claudy-themes-js]

**`html[data-mode="..."]` is the master control.** The entire UI color scheme is keyed off the `data-mode` attribute on `<html>`. Changing this from `dark` to `light` (or vice versa) flips the entire UI's surface ramps. Extensions that implement light themes must both inject new token values AND set `document.documentElement.setAttribute('data-mode', 'light')`, and then **re-set it whenever Claude rewrites it** (Claude sets `data-mode="system"` initially, resolves to light/dark after load, and updates on theme switch). This requires a dedicated `MutationObserver`.
[^claudy-content-js] [^claude-studio-content-js]

**Font rendering uses CSS variables, not element-level font-family rules.** Claude.ai sets fonts via token variables like `--font-anthropic-sans`, `--font-anthropic-serif`, `--cds-font-sans`, `--cds-font-voice`, `--cds-font-system`, `family-ui`, `family-sans`, `family-serif`. Extensions must **override these variable names**, not apply blanket `body * { font-family: ... }` — Claude.ai renders its icons from a ligature icon font (`Anthropicons-Variable`) that appears as literal text when the font-family is overridden.
[^claudy-themes-js]

**claude.ai does NOT use Shadow DOM.** All claude.ai UI elements are rendered in the regular document DOM tree and are visible to external CSS injection via content scripts or Stylus. There is no `attachShadow({ mode: 'open' })` anywhere in the claude.ai page shell that would block `@-moz-document domain("claude.ai")` styles. The only partially isolated elements are ProseMirror's contenteditable and iframe-based previews — but these use standard shadow roots for editor internals, not to hide content from external CSS.
[^crystal-glass-style-css]

#### 3.6.2 Chrome/Chromium Extension Capabilities for Third-Party SPA Restyling

The following table summarizes what each technique can achieve on claude.ai:

| Technique | Can do on claude.ai | Limitations |
|-----------|-------------------|-------------|
| **Content script CSS injection** (`<style>` tag in `<head>`) | Full restyling via `!important` overrides. Change every color, spacing, font size, border radius, background image, backdrop-blur effect. Target any element by `[data-testid]`, class, attribute, or DOM position. | Must handle SPA re-renders (MutationObserver). Must target all token-scoped roots (`:root`, `[data-mode]`, `.cds-root`). |
| **Content script DOM manipulation** (JS) | Can inject additional elements (buttons, panels, overlays), swap out child nodes of existing containers (e.g., replace text in a message bubble, add custom toolbars), detect and react to route changes. | Cannot directly invoke React's internal state hooks or cause React re-renders. DOM swaps may be overwritten if Claude's React tree re-renders the same container. MutationObserver needed to restore modifications. |
| **CSS variables override** (the most powerful technique) | By injecting `!important` values for all token variables (`--bg-*`, `--text-*`, `--border-*`, `--accent-*`, `--brand-*`, `--pictogram-*`, `--cds-*`) on ALL scopes (`:root, [data-mode], .cds-root, .epitaxy-root`), an extension can **completely restyle every surface** in claude.ai — backgrounds, text, buttons, dialogs, tooltips, scrollbars — with a single CSS injection. This is the technique used by Claudy!. | The token names may change if Anthropic redesigns claude.ai's CSS variable system. Extensions must track both the primary layer and CDS layer (otherwise nested dark containers show white-on-white icons). Status colors (`--cds-danger-*`, etc.) intentionally left untouched by well-designed extensions because they convey semantic meaning. |
| **Font injection** (loading Google Fonts via `<link>` tag) | Load any web font and apply via CSS variables on the scope selectors. Safe to load fonts that Claude.ai does not already ship with. | Cannot change the icon ligature font (`Anthropicons-Variable`) — doing so would replace Claude's UI icons with text glyphs. Must leave mono font variables untouched to preserve code blocks. |
| **Replacing entire component subtrees** | Can `innerHTML`-replace a node's children or `appendChild`/`insertBefore` new elements alongside Claude's React-rendered content. E.g., add a custom "copy all" button next to code blocks, inject a footer bar, replace text inside a message. | If the parent container re-renders (Claude detects new model response, user edits prompt), the injected DOM will be destroyed and not restored. Must use MutationObserver on `childList` to continuously restore. Some React-rendered containers may throw warnings if their children are unexpectedly replaced. |
| **Shadow DOM injection** | Extensions can create their own Shadow DOM elements (for overlays, panels, popups) that are visually independent of claude.ai styles — useful for extension UI that should NOT inherit the custom theme being applied to claude.ai. | Cannot use this to *modify* claude.ai's internal DOM, because Shadow DOM creates a boundary — styles from the host page cannot reach inside. For overriding claude.ai styles, regular style injection is always preferred. |

**SPA route-change handling.** claude.ai uses client-side routing (hash-based or History API). When the user navigates to a new chat or opens a project URL, the DOM changes significantly but the page does not reload. Content scripts handle this via:
- `MutationObserver` on `document.documentElement` with `{ subtree: true, childList: true, attributes: true }` — fires whenever Claude adds/removed/bumped any node. Both Claudy! and Claude Studio use this extensively.
- Chrome Storage sync listeners (`chrome.storage.onChanged` / `browser.storage.onChanged`) — for when the extension popup changes a setting while the user is on claude.ai.
- `document_start` script injection (`"run_at": "document_start"` in manifest) — ensures styles are present before Claude's React app renders its initial shell, avoiding flash of unstyled content.

**Content script isolation.** Chrome MV3 content scripts run in an "isolated world" — they have their own JavaScript context with access to page DOM but not to page-level JS variables (unless using `content_scripts` + `all_frames: true`, which gives one instance per frame). This is actually beneficial: the extension's styles and DOM modifications are applied globally regardless of React state, and can coexist peacefully with claude.ai's own scripts.

#### 3.6.3 Actual Working Extensions — Technical Deep Dive

**Claudy!** ([tommfr38/claudy](https://github.com/tommfr38/claudy)) — The most technically sophisticated open-source claude.ai theme extension, implementing a complete design-token-based restyling system:

- **Manifest MV3**, `run_at: "document_start"`, content script loaded from bundled `shared/themes.js` (theme definitions + token builders) and `content/claudy.js` (injection engine).
- **Two-token-layer theming**: Overrides both the primary `--bg-*`/`--text-*` layer AND the CDS `--cds-*` layer. Targets all scopes: `:root, html, [data-mode], .cds-root, .epitaxy-root, .dark, .light`. This is necessary because Claude's newer UI components (composer picker popups, attach button, voice recording) use the CDS layer exclusively and would show white-on-white icons under a light theme if only the primary layer were themed.
- **data-mode forcing**: Sets `document.documentElement.setAttribute('data-mode', 'light|dark')` to match the selected theme, and tracks Claude's own `data-mode` writes via MutationObserver (counting own writes vs. app writes to know when to restore). Restores original mode on disable. [^claudy-content-js]
- **Font safety**: Overrides only CSS variable names (`--font-anthropic-sans`, etc.), never applies direct `font-family: ... !important` to element selectors. This preserves Claude's ligature icon font (Anthropicons-Variable). [^claudy-themes-js]
- **Token expansion**: A compact theme palette (~10 HSL values) is expanded into 30+ CSS variable declarations by `buildTokens()`, and another ~20 by `buildCdsVars()`. This means users define "deep forest green" and the extension generates all 50 CSS variables with correct L-value ordering for dark mode. [^claudy-themes-js]
- **Web Audio API sounds**: Typing and click sounds synthesized in real-time (no audio files shipped). Uses randomised filtered noise + tuned oscillators.

**Claude Studio** ([ILYAGVC/Claude-Studio](https://github.com/ILYAGVC/Claude-Studio)) — A more ambitious extension that goes beyond colors to full RTL/multilingual support:

- **RTL direction engine**: Changes `dir="rtl"` on specific DOM regions (assistant messages via `.font-claude-response`, `[data-testid="assistant-message"]` / user messages via `[data-testid="user-message"]` / input via `.ProseMirror`). Skips code and math blocks (`pre, code, kbd, samp, .katex, mjx-container`).
- **Digit conversion**: Converts Latin digits in assistant responses to Persian/Arabic/Urdu/Hindi/Bengali/Thai numerals using a `TreeWalker` that selectively rewrites text nodes while preserving user selections. Reversible.
- **Black theme**: Paints every `[data-mode]` and `.cds-root` element inline with black background (`#000`) and white-leaning text ramp via `el.style.setProperty()` for each token variable. Also injects a global CSS rule covering all scopes. Handles modal/portal surfaces that live outside the painted tree by remapping `--cds-surface-*` tokens to neutral grays.
- **Accent color recoloring**: Computes HSL from hex input, generates `--brand-*`, `--_brand-clay-*`, `--cds-clay-*`, `--accent-brand-*`, `--accent-*` declarations as a global `!important` CSS rule covering all scopes (`:root,[data-mode],.cds-root{...}`). This means the accent is truly universal even inside nested CDS containers. [^claude-studio-content-js]
- **Custom CSS editor**: User writes raw CSS (with `!important`) that gets injected into a `<style id="crx-custom-css">` tag in the page head.
- **Observer self-shutdown pattern**: After extension reload/update, the old content script instance broadcasts `"crx:shutdown"` to retire itself, then reconciles the DOM. Prevents orphaned observers from persisting with dead extension contexts. [^claude-studio-content-js]

**Crystal-Glass-CSS-for-Claude-Stylus** ([RocketReaper/Crystal-Glass-CSS-for-Claude-Stylus-](https://github.com/RocketReaper/Crystal-Glass-CSS-for-Claude-Stylus-)) — A pure Stylus CSS-only approach:

- Uses `@-moz-document url-prefix("https://claude.ai/")` for cross-browser scoping (Firefox's `@-moz-document domain()` also works).
- Sets a wallpaper on `<html>` with `backdrop-filter: blur(3px)` + semi-transparent dark overlay.
- Transparent backgrounds on all panels (`background-color: transparent !important; background-image: none !important`).
- Glassmorphism effect: `background-color: rgba(0, 0, 0, 0.30); backdrop-filter: blur(4px)` on sidebar/header/composer.
- Hides disclaimer bar via `[data-disclaimer="true"] { display: none !important }`. [^crystal-glass-style-css]

**Chrome Web Store extensions (non-open-source observations):**
- **"Claude Themes"** (4.8★): 6 retro palettes, per-project color assignment with tab-glance indicator. Pure CSS injection approach.
- **"Claude AI — Nexus Theme"** (5.0★): 10 themes, custom fonts, glow controls. Claims "resilient" CSS that survives site updates.
- **"AI Chat Themes"** (5.0★): Works on both ChatGPT and Claude.ai — token-first approach using design tokens where available.
- **"250 Animated Themes"** (Vellum): Animated backgrounds, Freemium model ($3/mo for full access). The animated background is likely injected as a pseudo-element or background-image on the body/HTML shell.
- **"Gloam"** (0★ new): Dark theme specifically for **Claude Design native panels** (the built-in Anthropic UI components used inside claude.ai — e.g., the model selector dropdown, file picker). This suggests claude.ai renders some panels in a separate scope that needs its own theming.

[^claudy-themes-js]: [tommfr38/claudy/shared/themes.js](https://raw.githubusercontent.com/tommfr38/claudy/main/shared/themes.js) — Full source of `buildTokens()` and `buildCdsVars()`, showing the complete token variable names and their CSS-variable format.
[^claudy-content-js]: [tommfr38/claudy/content/claudy.js](https://raw.githubusercontent.com/tommfr38/claudy/main/content/claudy.js) — Content script showing MutationObserver on `data-mode`, style injection at `document_start`, font variable overriding (not element-level), and storage sync plumbing.
[^claude-studio-content-js]: [ILYAGVC/Claude-Studio/src/content/content.js](https://raw.githubusercontent.com/ILYAGVC/Claude-Studio/main/src/content/content.js) — Full source showing RTL engine, digit conversion via TreeWalker, black theme painting on `[data-mode]` scopes, accent recoloring as global `!important` rule, and observer self-shutdown pattern.
[^claude-studio-inject-css]: [ILYAGVC/Claude-Studio/src/content/inject.css](https://raw.githubusercontent.com/ILYAGVC/Claude-Studio/main/src/content/inject.css) — The injected CSS showing selector patterns used to target Claude's response text, user messages, ProseMirror composer, code blocks, chat list.
[^crystal-glass-style-css]: [RocketReaper/Crystal-Glass-CSS-for-Claude-Stylus-/style.css](https://raw.githubusercontent.com/RocketReaper/Crystal-Glass-CSS-for-Claude-Stylus-/main/style.css) — Complete CSS showing `!important` overrides on `body`, `nav`, `[class*="sidebar"]`, `[data-chat-input-container="true"]`, `[data-testid]`, `[role="dialog"]`, code blocks, scrollbar.

#### 3.6.4 Limitations and Anti-Tamper Mechanisms

**Content Security Policy (CSP).** Claude.ai runs behind Cloudflare, which adds CSP headers. However, **content scripts run in a special execution context that is exempt from most CSP restrictions** — they can inject `<style>` tags into the document head regardless of CSP `style-src`. The only thing CSP would block is injecting `<script type="module">` or loading external JavaScript files directly in page context (which content scripts cannot do anyway due to isolation). **CSP does not prevent CSS injection via content scripts.**

**CSS-in-JS / inline styles.** Claude.ai uses CSS custom properties rather than per-element inline `style="..."` attributes for its primary theming. This means `!important` on CSS variable declarations is highly effective — you only need to override the variable once (on the root), and all elements consuming that variable inherit the new value automatically. If claude.ai had used inline `style="background-color: rgb(255,255,255)"` on every element, a content script would need either extremely specific selectors or `MutationObserver` to apply `!important` rules after React renders.

**Shadow DOM.** As established, claude.ai does **not** wrap its main UI in Shadow DOM. However, there are two places where Shadow DOM appears:
1. **ProseMirror editor**: The composer's rich text editing area uses ProseMirror which creates a shadow root for browser compatibility (to isolate contentEditable from host styles). Extension CSS cannot reach inside this shadow root — but since the extension targets `.ProseMirror`'s direct children and their `font-*` properties via CSS variables, this is not a practical limitation.
2. **iframe previews**: Claude renders certain artifact previews in iframes, which are naturally isolated from external CSS.

**Detection of active extensions.** An active theme extension can be detected by:
- Visually inspecting the page for changes (obviously).
- Checking for injected `<style>` elements with extension-assigned IDs (`claudy-theme`, `crx-accent-css`, etc.) — visible in DevTools Elements panel.
- Reading `document.querySelectorAll('[data-crx*]')` or `[data-mode]` that doesn't match Claude's default values.
- Checking for injected `<link>` elements from Google Fonts domains with `data-crx` attributes.

**MutationObserver overhead.** The content script MutationObservers in both Claudy! and Claude Studio observe the entire document subtree with `childList + characterData` (Claude Studio) or `attributes: true, attributeFilter: ["data-mode"]` (Claudy!). On claude.ai's pages — which stream assistant responses token-by-token — this fires hundreds of times per minute. Both extensions handle this efficiently by using requestAnimationFrame/throttling and checking settings before processing. However, adding additional MutationObservers for custom DOM modifications will increase overhead.

#### 3.6.5 Synthesis: What "Complete Restyling" Actually Means

A browser extension **can** achieve a **comprehensive visual restyling** of claude.ai's interface through CSS variable override alone. The proven technique (validated by multiple working extensions):

1. Inject a `<style>` element at `document_start` with CSS rules for ALL token scopes (`:root, html, [data-mode], .cds-root, .epitaxy-root`).
2. Override all design token variables (`--bg-*`, `--text-*`, `--border-*`, `--accent-*`, `--brand-*`, `--pictogram-*`) with HSL triplets defining the desired theme palette.
3. Override the CDS layer variables (`--cds-text-primary`, `--cds-bg-*`, `--cds-border`, `--cds-alpha-*`) derived from the same palette for consistency across nested dark containers.
4. Optionally override font variable names (`--font-anthropic-sans`, etc.) for custom typography, but never element-level `font-family`.
5. If a light theme is selected, set `data-mode="light"` on all scoped elements and track Claude's own writes via MutationObserver to restore the correct mode.
6. Apply additional per-component tweaks via targeted selectors (`[data-chat-input-container="true"]`, `.prose`, `[data-testid]`) for spacing/border-radius/animation changes that CSS variables cannot control.

What **cannot** be achieved through pure CSS injection:
- **Replacing Claude's JavaScript behavior**: Extensions cannot modify Claude's network requests, alter tool call handling, or change API interaction patterns. They only affect presentation.
- **Structural UI changes**: You can hide elements (`display: none`) but adding new interactive components alongside Claude's React tree requires DOM manipulation with MutationObserver restoration, which is fragile and will be overwritten on React re-renders. Extensions that add buttons (like "Claude Studio"'s settings panel) use a persistent overlay appended to the body or Shadow DOM injection that lives outside Claude's render tree.
- **Auth bypass**: No extension can authenticate as you, access your API key without explicit user action (storing it in `chrome.storage`), or make API calls on your behalf beyond what the browser already permits for claude.ai requests.

For the **open-claude-mod project** (`/home/a1exk/Projects/open-claude-mod`): this directory currently contains only documentation (`docs/agents/research/claude-mods.md`) and no source code. It is not itself a browser extension, standalone app, or working implementation — it appears to be a research repository intended to track findings about modifying the Claude interface experience. Any future implementation would need to follow one of the proven techniques described above (CSS variable injection + MutationObserver DOM management) if it targets the claude.ai web UI, or could build a full replacement SPA (like Open-claude) if it targets the API layer instead.

---

### 4.1 [tweakcc](https://github.com/Piebald-AI/tweakcc) — ⭐ 2,529

**The most comprehensive Claude Code modification tool.** tweakcc patches Claude Code's minified `cli.js` (or native binary) to customize:

- **All system prompts** — Edit markdown files in `~/.tweakcc/system-prompts/` and apply with `npx tweakcc --apply`
- **Custom themes** — HSL/RGB color picker for the entire Claude Code UI
- **Thinking verbs** — Customize what appears while Claude is "thinking" (e.g., "Claude is Baking...")
- **Spinner animations** — Braille spinner, arrow spinner, minimal circle, etc.
- **Input pattern highlighters** — Highlight regex patterns in the input box (rainbow colors, file paths, env vars)
- **Toolsets** — Custom tool configurations that restrict which tools Claude can see
- **User message display** — Style user messages beyond default gray text
- **Session naming** — `/title my chat name` command
- **Subagent models** — Configure different models for Plan/Explore/general-purpose subagents
- **MCP startup optimization** — Non-blocking MCP connections, parallel batch sizing
- **Table format** — ASCII, clean, or default table rendering

**How it works:** For npm installs, modifies `cli.js` directly. For native binaries (macOS/Linux/Windows), extracts JS using [node-lief](https://github.com/Piebald-AI/node-lief) (Node.js bindings for LIEF binary instrumentation library), patches it, and repacks the binary with ad-hoc signing on Apple Silicon.

**Custom patches:** `tweakcc adhoc-patch` supports string/regex replacement and sandboxed Node.js scripts. Scripts can be run from local files or HTTP URLs.

**System prompts repository:** [Piebald-AI/claude-code-system-prompts](https://github.com/Piebald-AI/claude-code-system-prompts) — documents all of Claude Code's system prompt parts, with version diffs.

**API:** Available as npm package (`npm i tweakcc`) for programmatic use.

**Key source:** [tweakcc README](https://github.com/Piebald-AI/tweakcc)

### 4.2 [Open-claude](https://github.com/Damienchakma/Open-claude) — ⭐ 114

An **open-source alternative UI for Claude** — a React + Vite SPA that mimics claude.ai's interface but connects to multiple providers:

- Supports Google Gemini, Groq, OpenAI, Ollama, LM Studio
- Built-in Deep Research
- Real-time CoT (Chain of Thought) thinking streams
- Live webcam capture for vision inputs
- Interactive artifact sandbox (HTML5 games, React apps, SVG, PDFs)
- Dynamic provider detection and model auto-switching

This is a full **reimplementation** of the claude.ai experience, not a modification of it.

**Key source:** [Open-claude README](https://github.com/Damienchakma/Open-claude)

### 4.3 ccstatusline — ⭐ 13,161

Beautifully customizable **status line for Claude Code CLI** with Powerline support, themes, real-time cost tracking, and usage metrics. Installed in user `~/.claude/skills/` or project `.claude/`.

**Key source:** [sirmalloc/ccstatusline](https://github.com/sirmalloc/ccstatusline)

### 4.4 Claude Desktop Chinese Patch — ⭐ 7,418

Patches Claude Desktop (macOS/Windows/Linux) to display in **Simplified Chinese**. Demonstrates the technique of binary-level patching applied to Claude's desktop application.

**Key source:** [javaht/claude-desktop-zh-cn](https://github.com/javaht/claude-desktop-zh-cn)

### 4.5 CC-Switch — ⭐ 139,553

Cross-platform **all-in-one desktop assistant** for Claude Code, Codex, OpenCode, OpenClaw, Grok Build, and Hermes Agent. This is a **unified UI** that wraps multiple AI coding CLI tools in one interface.

**Key source:** [farion1231/cc-switch](https://github.com/farion1231/cc-switch) · Website: [ccswitch.io](https://ccswitch.io)

### 4.6 Claude Code DevTools — ⭐ 3,962

**Developer tools for Claude Code sessions** — visual UI to inspect session logs, tool calls, token usage, subagent activity, and context window state. Useful debugging companion, not a modification itself.

**Key source:** [matt1398/claude-devtools](https://github.com/matt1398/claude-devtools)

### 4.7 Claude Code Usage Bar — ⭐ 376

Lightweight `statusLine` for Claude Code showing rate-limit usage, reset countdowns, model info, context window status. Multiple styles and themes.

**Key source:** [leeguooooo/claude-code-usage-bar](https://github.com/leeguooooo/claude-code-usage-bar)

### 4.8 Usage (macOS menu bar) — ⭐ 332

macOS menu bar / Windows tray app showing Claude Code quota, burn rate, and cost. Local-first, no API calls. 14 themes.

**Key source:** [aqua5230/usage](https://github.com/aqua5230/usage)

### 4.9 Better Design — ⭐ 251

Open-source **design MCP server + shadcn/ui registry** for Claude Code. Provides 31 brand-grade themes (Linear, Stripe, Vercel, Notion, Apple, Supabase, Figma), design tokens, UI principles, and WCAG rules. Install any component with one command.

**Key source:** [marvkr/better-design](https://github.com/marvkr/better-design)

---

## 5. Prompt Engineering as "Modding"

### 5.1 System Prompts in the Messages API

The Messages API `system` parameter is Anthropic's **primary behavioral modification surface**. You can:

- Define Claude's role, personality, and domain expertise
- Constrain output format (JSON, specific schemas, markdown structure)
- Set behavioral guardrails (what Claude should/shouldn't do)
- Provide few-shot examples of desired behavior

**Example:**
```json
{
  "model": "claude-opus-5-5",
  "max_tokens": 1024,
  "system": "You are a senior Rust developer. Follow strict ownership rules.",
  "messages": [{"role": "user", "content": "..."}]
}
```

**Developer Presets** are Anthropic-curated system prompt + tool combinations:
- `developer_1_0_basic` — General-purpose development
- `developer_1_0_advanced` — With additional capabilities enabled
- `developer_1_0_code_interpreter` — With code execution tools

These serve as templates but cannot be directly customized by users through the API.

**Key source:** [Tool use overview](https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview)

### 5.2 Prompt Sharing Repositories

[x1xhlol/system-prompts-and-models-of-ai-tools](https://github.com/x1xhlol/system-prompts-and-models-of-ai-tools) (⭐ 143,995 stars) is a massive collection of **system prompts for all major AI coding tools** including Claude Code, Cursor, Codex, Windsurf, and more. It serves as a community-curated catalog of effective prompt patterns but is not an official Anthropic resource.

### 5.3 Prompt Curation Sites

prompts.chat (formerly f.k.a. Awesome ChatGPT Prompts, ⭐ 171,867 stars) hosts community-contributed prompts that can be adapted for Claude via the Messages API `system` parameter.

**Key source:** [f/prompts.chat on GitHub](https://github.com/f/prompts.chat)

---

## 6. MCP — Model Context Protocol

### 6.1 What Is MCP?

MCP is an **open protocol** that standardizes how LLM applications connect to external data sources and tools. Inspired by the Language Server Protocol, it defines:

- **Resources:** Context and data for the model to consume
- **Prompts:** Templated messages and workflows
- **Tools:** Functions the AI can execute
- **Configuration:** Settings transport
- **Extensions:** Tasks (async execution), Skills over MCP, MCP Apps (interactive UI elements)

MCP uses JSON-RPC 2.0 for communication between:
- **Hosts** — LLM applications that initiate connections
- **Clients** — Connectors within the host application  
- **Servers** — Services that provide context and capabilities

**Current spec version:** `2026-07-28` (as of research date)

### 6.2 MCP Specification

- **Specification doc:** [modelcontextprotocol.io/specification/2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28)
- **TypeScript schema:** [schema.ts](https://github.com/modelcontextprotocol/specification/blob/main/schema/2026-07-28/schema.ts)
- **TypeScript SDK:** [modelcontextprotocol/typescript-sdk](https://github.com/modelcontextprotocol/typescript-sdk) (v2, implementing 2026-07-28 spec)
- **Python SDK:** Available separately
- **License:** MIT (spec) / Apache 2.0 (new contributions to SDK)

### 6.3 MCP Extensions

Beyond core protocol, MCP defines optional extensions:
- **[Tasks](https://modelcontextprotocol.io/extensions/tasks/overview)** — Async long-running operations with polling
- **[Skills over MCP](https://modelcontextprotocol.io/community/working-groups/skills-over-mcp)** — Rich structured instructions for agent workflows, discovered via MCP
- **[MCP Apps](https://modelcontextprotocol.io/extensions/apps/overview)** — Interactive UI elements (charts, forms, video players) rendered inline

### 6.4 Notable MCP Servers in the Ecosystem

| Server | Stars | Purpose |
|--------|-------|---------|
| n8n-mcp | 23,032 | Build n8n workflows |
| better-design | 251 | Design system MCP + shadcn registry |
| Various from Anthropic Directory | — | Official connectors (GitHub, Slack, Jira, etc.) |

The [Anthropic Directory](https://claude.ai/directory) hosts reviewed MCP connectors that work with Claude Code via `claude mcp add`.

---

## 7. Agent Skills Standard

### 7.1 The Open Standard

**Agent Skills** ([agentskills.io](https://agentskills.io)) is an open standard for packaging Claude instructions as reusable, shareable modules. It's the common format between:
- Claude Code (terminal)
- Claude Desktop
- claude.ai chat
- The Messages API (Skills API)

A skill is a folder with `SKILL.md` containing YAML frontmatter and markdown content. Frontmatter fields defined by the spec:
- `name` — Unique identifier
- `description` — When to use it
- `license` — Skill license
- `compatibility` — Environment requirements
- `metadata` — Free-form key-value data

Claude Code extends this with Claude-specific fields (`disable-model-invocation`, `allowed-tools`, `model`, `effort`, `context`, etc.).

### 7.2 Skills API (Anthropic)

The Messages API supports skills through the **Skills API**:
- Use Anthropic's pre-built skills via the API
- Upload custom skills alongside messages
- Skills load dynamically when relevant or on-demand

**Key source:** [Skills API Quickstart](https://docs.claude.com/en/api/skills-guide)

---

## 8. Practical Landscape Summary

### What Actually Works Today

| Approach | Reliability | Surface Area | Notes |
|----------|-------------|--------------|-------|
| **Messages API system prompts** | Production | Full behavioral control | Primary modding surface for API users |
| **Claude Code CLAUDE.md** | Production | Project conventions, coding standards | Built-in, official, most used |
| **Claude Code skills** | Production | Workflow automation | Open standard (agentskills.io) |
| **Claude Code plugins/mods** | Production | UI + behavior customization | Most powerful extensibility surface |
| **Claude Code hooks** | Production | Lifecycle event handling | Shell or JS-based |
| **Claude Code MCP servers** | Production | External tool integration | Open standard (MCP) |
| **tweakcc binary patching** | High risk | Full Claude Code customization | Modifies CC binaries; breaks on update; works across npm/native installs |
| **Chrome extensions / CSS injection** | Medium | claude.ai web UI only | Non-invasive, survives site updates if DOM classes are stable |
| **Open-claude (React SPA)** | Functional | Full replacement UI | Multi-provider, not a Claude mod per se |
| **Status line scripts** | Production | CLI aesthetics | Popular ecosystem (ccstatusline, etc.) |

### Speculation / Not Yet Available

- Official claude.ai theming API — no official surface exists yet
- Browser extension for claude.ai with full feature parity — partially achieved via CSS injection
- AI-generated UI modifications to Claude Code mods — not a thing yet
- Official "Claude theme store" or marketplace — does not exist

### Key Architectural Insights

1. **Anthropic has invested heavily in structured extensibility** for Claude Code (skills, plugins, mods, hooks, MCP) but less so for the claude.ai web interface itself. The web app remains relatively opaque and closed.

2. **Claude Code is the battleground.** The modding ecosystem is overwhelmingly focused on Claude Code, where Anthropic has intentionally built a rich extensibility surface (mods are essentially a mini-plugin framework with JavaScript event handlers).

3. **tweakcc represents reverse-engineering approaches** that work alongside (or despite) official extensibility. It patches Claude Code's binary to inject custom system prompts and themes — powerful but inherently fragile.

4. **The Agent Skills standard** is Anthropic's attempt to create a unified skill format across all surfaces (Claude Code, claude.ai, API). This suggests future deepening of skills as the primary extensibility mechanism.

5. **MCP is becoming the universal integration layer.** Any external data source that wants Claude access should build an MCP server — this is clearly Anthropic's strategy for the broader integrations ecosystem.

---

## References & Sources

### Official Anthropic Documentation
- [Claude Developer Platform](https://platform.claude.com/docs/en) — Messages API, tools, models
- [Claude Code Documentation](https://code.claude.com/docs/en/overview) — Skills, plugins, mods, hooks, MCP
- [Claude Code System Prompts](https://github.com/Piebald-AI/claude-code-system-prompts) — Anthropic's prompt structure (community-maintained)
- [Anthropic GitHub](https://github.com/anthropics) — Organization page with all repos

### Open Repositories
- [anthropics/skills](https://github.com/anthropics/skills) — Agent Skills spec + example skills (179k stars)
- [anthropics/claude-code](https://github.com/anthropics/claude-code) — Claude Code source (149k stars)
- [anthropics/claude-code-playground](https://github.com/anthropics/claude-code-playground) — Sample mods and examples
- [anthropics/claude-plugins-official](https://github.com/anthropics/claude-plugins-official) — Official plugin marketplace (37k stars)
- [anthropics/claude-agent-sdk-python](https://github.com/anthropics/claude-agent-sdk-python) — Agent SDK (8.2k stars)
- [anthropics/claude-agent-sdk-typescript](https://github.com/anthropics/claude-agent-sdk-typescript) — Agent SDK TypeScript (1.8k stars)

### Protocol Specifications
- [MCP Specification](https://modelcontextprotocol.io/specification/2026-07-28) — Model Context Protocol spec
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) — Official MCP SDK (13.5k stars)
- [Agent Skills Specification](https://agentskills.io/specification) — Agent Skills standard

### Notable Third-Party Projects
- [tweakcc](https://github.com/Piebald-AI/tweakcc) — Claude Code binary patching tool (2.5k stars)
- [Open-claude](https://github.com/Damienchakma/Open-claude) — Open-source Claude UI alternative (114 stars)
- [ccstatusline](https://github.com/sirmalloc/ccstatusline) — Claude Code status line (13k stars)
- [cc-switch](https://github.com/farion1231/cc-switch) — Multi-agent desktop wrapper (139k stars)
- [Claude Studio Chrome Extension](https://github.com/ILYAGVC/Claude-Studio) — claude.ai theming extension (5 stars)
- [Crystal-Glass-CSS-for-Claude-Stylus](https://github.com/RocketReaper/Crystal-Glass-CSS-for-Claude-Stylus-) — Claude.ai frosted glass theme (2 stars)

### Prompt Engineering Resources
- [system-prompts-and-models-of-ai-tools](https://github.com/x1xhlol/system-prompts-and-models-of-ai-tools) — Prompts for all major AI tools (144k stars)
- [prompts.chat](https://github.com/f/prompts.chat) — Community prompt curation (172k stars)
